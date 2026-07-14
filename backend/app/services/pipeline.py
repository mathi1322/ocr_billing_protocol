"""Extraction pipeline — OpenAI first, validate, fall back to Claude when poor."""

import logging
import time
from dataclasses import dataclass

from app.config import get_settings
from app.schemas.bill import ExtractedBill, ValidationResult
from app.services.extract_claude import extract_with_claude
from app.services.extract_openai import extract_with_openai
from app.services.normalize import NormalizedDoc
from app.services.validator import validate_extraction

logger = logging.getLogger(__name__)


@dataclass
class Attempt:
    provider: str
    bill: ExtractedBill | None
    validation: ValidationResult | None
    latency_ms: int
    error: str | None = None


@dataclass
class PipelineResult:
    status: str  # "extracted" | "failed"
    bill: ExtractedBill | None
    validation: ValidationResult | None
    winning_provider: str | None
    attempts: list[Attempt]


def _attempt(provider: str, fn, doc: NormalizedDoc) -> Attempt:
    start = time.monotonic()
    try:
        bill = fn(doc)
        return Attempt(
            provider=provider,
            bill=bill,
            validation=validate_extraction(bill),
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as exc:  # provider/network/parse errors must not kill the job
        logger.exception("%s extraction failed", provider)
        return Attempt(
            provider=provider,
            bill=None,
            validation=None,
            latency_ms=int((time.monotonic() - start) * 1000),
            error=str(exc),
        )


def run_pipeline(doc: NormalizedDoc) -> PipelineResult:
    settings = get_settings()
    attempts: list[Attempt] = []

    primary = _attempt("openai", extract_with_openai, doc)
    attempts.append(primary)

    best = primary
    score = primary.validation.score if primary.validation else 0.0

    if score < settings.extraction_fallback_threshold:
        logger.info("OpenAI score %.2f below fallback threshold — trying Claude", score)
        fallback = _attempt("anthropic", extract_with_claude, doc)
        attempts.append(fallback)
        fb_score = fallback.validation.score if fallback.validation else 0.0
        if fb_score > score:
            best, score = fallback, fb_score

    if best.bill is None:
        return PipelineResult("failed", None, None, None, attempts)

    # Low-confidence results are still 'extracted' — confidence_score and
    # flagged_fields carry the quality signal to the UI.
    return PipelineResult("extracted", best.bill, best.validation, best.provider, attempts)

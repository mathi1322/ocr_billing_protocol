"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { DuplicateInvoiceError, uploadInvoice } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface DuplicatePrompt {
  fileName: string;
  info: DuplicateInvoiceError;
  resolve: (proceed: boolean) => void;
}

export function UploadZone({
  onUploaded,
  onComplete,
}: {
  onUploaded: () => void;
  onComplete?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<DuplicatePrompt | null>(null);
  const promptRef = useRef<DuplicatePrompt | null>(null);

  const askDuplicate = useCallback(
    (fileName: string, info: DuplicateInvoiceError): Promise<boolean> =>
      new Promise((resolve) => {
        const p = { fileName, info, resolve };
        promptRef.current = p;
        setPrompt(p);
      }),
    []
  );

  const answerDuplicate = useCallback((proceed: boolean) => {
    promptRef.current?.resolve(proceed);
    promptRef.current = null;
    setPrompt(null);
  }, []);

  const onDrop = useCallback(
    async (files: File[]) => {
      setBusy(true);
      try {
        let done = 0;
        let skipped = 0;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(files.length > 1 ? `Extracting ${i + 1}/${files.length}…` : "Extracting…");
          try {
            await uploadInvoice(file);
            done++;
            onUploaded();
          } catch (e) {
            if (e instanceof DuplicateInvoiceError) {
              const proceed = await askDuplicate(file.name, e);
              if (proceed) {
                setProgress("Re-extracting…");
                await uploadInvoice(file, true);
                done++;
                onUploaded();
              } else {
                skipped++;
              }
            } else {
              throw e;
            }
          }
        }
        if (done > 0) {
          toast("success", done === 1 ? "Bill extracted" : `${done} bills extracted`);
          onComplete?.(); // e.g. close the surrounding modal — the toast is the feedback
        }
        if (skipped > 0) {
          toast("info", skipped === 1 ? "Duplicate skipped — nothing spent" : `${skipped} duplicates skipped`);
        }
      } catch (e) {
        toast("error", e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [onUploaded, onComplete, askDuplicate, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: busy,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`group flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragActive
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
            : busy
              ? "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
              : "border-neutral-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-500/5"
        }`}
      >
        <input {...getInputProps()} capture="environment" />
        {busy ? (
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="font-medium text-neutral-700 dark:text-neutral-300">{progress}</p>
          </div>
        ) : (
          <>
            <div className="mb-2 rounded-full bg-emerald-100 p-3 text-emerald-600 transition-transform group-hover:scale-110 dark:bg-emerald-500/15 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              {isDragActive ? "Drop it here" : "Drop an invoice, or tap to choose / snap a photo"}
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              PDF · JPG · PNG · HEIC · DOCX — up to 25 MB
            </p>
          </>
        )}
      </div>

      {/* Duplicate confirmation dialog */}
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">This file was already uploaded</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {prompt.fileName}
                  </span>{" "}
                  matches an existing invoice
                  {prompt.info.vendor_name && <> from <b>{prompt.info.vendor_name}</b></>}
                  {prompt.info.invoice_number && <> (#{prompt.info.invoice_number})</>}
                  {prompt.info.invoice_date && <> dated {prompt.info.invoice_date}</>}.
                </p>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Upload it again anyway? This creates a new entry and costs one more AI extraction.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => answerDuplicate(false)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                No, skip
              </button>
              <button
                onClick={() => answerDuplicate(true)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Yes, upload again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

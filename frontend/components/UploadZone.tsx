"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadInvoice } from "@/lib/api";

export function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      setError(null);
      setNotice(null);
      setBusy(true);
      try {
        let duplicates = 0;
        for (let i = 0; i < files.length; i++) {
          setProgress(files.length > 1 ? `Extracting ${i + 1}/${files.length}…` : "Extracting…");
          const result = await uploadInvoice(files[i]);
          if (result.duplicate) duplicates++;
          onUploaded();
        }
        if (duplicates > 0) {
          setNotice(
            duplicates === 1
              ? "That document was already uploaded — showing the existing extraction (no AI cost)."
              : `${duplicates} documents were already uploaded — existing extractions reused.`
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [onUploaded]
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
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
          {notice}
        </p>
      )}
    </div>
  );
}

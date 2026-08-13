"use client";

import { useRef, useState } from "react";

export interface ExcelUploaderProps {
  readonly onFileSelected: (file: File) => void;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"];

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

/**
 * Drag & drop Excel file (spec "knowledge/page.tsx" mockup: "Drop Excel file di sini · atau klik
 * untuk pilih file · Supported: .xlsx, .xls"). No `aaos-api` endpoint currently backs a knowledge
 * upload/publish flow (not one of AAOS-W4A's 7 new endpoints — see `README.md`'s "Known
 * limitations"), so `onFileSelected` is caller-supplied local state only; wiring a real upload
 * endpoint is follow-up work.
 */
export function ExcelUploader({ onFileSelected }: ExcelUploaderProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined): void {
    if (file === undefined) {
      return;
    }
    if (!isAcceptedFile(file)) {
      setError("File harus berformat .xlsx atau .xls");
      return;
    }
    setError(undefined);
    onFileSelected(file);
  }

  return (
    <div>
      <div
        data-testid="excel-dropzone"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed p-8 text-center text-sm ${
          isDragging ? "border-brand-primary bg-brand-primary/5" : "border-hairline bg-surface-card"
        }`}
      >
        <p className="text-ink">📎 Drop Excel file di sini</p>
        <p className="text-ink-muted">atau klik untuk pilih file</p>
        <p className="mt-1 text-xs text-ink-muted">Supported: .xlsx, .xls</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        aria-label="Pilih file Excel"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {error !== undefined ? <p className="mt-2 text-sm text-brand-danger">{error}</p> : null}
    </div>
  );
}

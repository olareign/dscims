"use client";

import { useRef, useState } from "react";
import { Camera, FileText, UploadSimple, X } from "@phosphor-icons/react";
import type { FileDto } from "@dscims/shared";

/** Shrinks a photo before it is sent (PWA-5: 3G connections, INV-5: compressed on upload). PDFs and failures pass through untouched. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 300_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function uploadFile(kind: FileDto["kind"], file: File): Promise<FileDto> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", await compress(file));
  let res: Response;
  try {
    res = await fetch("/api/files", { method: "POST", body });
  } catch {
    throw new Error("We could not reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as FileDto & { message?: string };
  if (!res.ok) throw new Error(json.message ?? "The upload did not work. Try again.");
  return json;
}

/** One tap to take or choose a photo; calls back with the stored file. */
export function UploadButton({ kind, label, onUploaded, accept = "image/jpeg,image/png", capture, id }: { kind: FileDto["kind"]; label: string; onUploaded: (file: FileDto) => void; accept?: string; capture?: boolean; id: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label className="upl" htmlFor={id} aria-busy={busy}>
        {busy ? "Uploading..." : <>{capture ? <Camera className="i" aria-hidden /> : <UploadSimple className="i" aria-hidden />} {label}</>}
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          capture={capture ? "environment" : undefined}
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onUploaded(await uploadFile(kind, file));
            } catch (err) {
              setError(err instanceof Error ? err.message : "The upload did not work. Try again.");
            } finally {
              setBusy(false);
              if (input.current) input.current.value = "";
            }
          }}
        />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

export function FileThumb({ file, onRemove, size = 72 }: { file: Pick<FileDto, "id" | "mime" | "filename">; onRemove?: () => void; size?: number }) {
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {file.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element -- private files are served through our own route, not the image optimiser
        <img src={`/api/files/${file.id}`} alt={file.filename} />
      ) : (
        <FileText className="i" aria-label={file.filename} />
      )}
      {onRemove && <button type="button" className="x" onClick={onRemove} aria-label={`Remove ${file.filename}`}><X className="i s" style={{ width: 12, height: 12 }} /></button>}
    </span>
  );
}

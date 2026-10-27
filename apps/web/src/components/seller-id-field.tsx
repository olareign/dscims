"use client";

import { useState } from "react";
import type { FileDto } from "@dscims/shared";
import { FileThumb, UploadButton } from "./upload";

/** Photo of the seller's ID. The stored file's id travels with the form as a hidden field. */
export function SellerIdField() {
  const [file, setFile] = useState<FileDto | null>(null);
  return (
    <div>
      <div className="lbl">Photo of the seller&apos;s ID</div>
      <input type="hidden" name="idFileId" value={file?.id ?? ""} />
      <div className="row" style={{ gap: 10 }}>
        {file && <FileThumb file={file} onRemove={() => setFile(null)} />}
        <UploadButton id="seller-id" kind="seller_id" label={file ? "Replace photo" : "Take photo"} accept="image/jpeg,image/png,application/pdf" capture onUploaded={setFile} />
      </div>
      <p className="hint">National ID, driver&apos;s licence, voter&apos;s card or passport. Stored privately; only the owner and managers can open it.</p>
    </div>
  );
}

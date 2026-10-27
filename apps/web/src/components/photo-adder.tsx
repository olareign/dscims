"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDevicePhoto } from "@/app/(app)/stock/actions";
import { UploadButton } from "./upload";

export function PhotoAdder({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ width: 140 }}>
      <UploadButton
        id="photo-add"
        kind="device_photo"
        label="Add photo"
        capture
        onUploaded={async (file) => {
          setError(null);
          const res = await addDevicePhoto(deviceId, file.id);
          if (res.error) setError(res.error); else router.refresh();
        }}
      />
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS } from "@dscims/shared";
import type { DeviceDto } from "@dscims/shared";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/form";
import { ApiError, api } from "@/lib/api";
import { nairaInputValue } from "@/lib/format";
import { requireMe } from "@/lib/session";
import { updateDevice } from "../../actions";

export const metadata = { title: "Edit phone" };

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (me.user.role === "staff") redirect("/stock");
  const { id } = await params;
  let d: DeviceDto;
  try {
    d = await api<DeviceDto>(`/devices/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return (
    <>
      <div className="pghead"><div><h1>Edit {d.brand} {d.model}</h1><p className="mut" style={{ margin: "6px 0 0" }}>IMEI {d.imei} cannot be changed. Changes are saved in the phone&apos;s history and the audit log.</p></div></div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <ActionForm action={updateDevice}>
          <input type="hidden" name="id" value={d.id} />
          <div className="fgrid two"><Field name="brand" label="Brand" defaultValue={d.brand} /><Field name="model" label="Model" defaultValue={d.model} /></div>
          <div className="fgrid two"><Field name="storage" label="Storage" defaultValue={d.storage} /><Field name="colour" label="Colour" defaultValue={d.colour} /></div>
          <SelectField name="condition" label="Condition" defaultValue={d.condition} options={DEVICE_CONDITIONS.map((c) => ({ value: c, label: DEVICE_CONDITION_LABELS[c] }))} />
          <div className="fgrid two"><Field name="sellingPrice" label="Selling price (₦)" defaultValue={nairaInputValue(d.sellingKobo)} inputMode="numeric" />{d.costKobo !== undefined && <Field name="costPrice" label="Buying price (₦)" defaultValue={nairaInputValue(d.costKobo)} inputMode="numeric" />}</div>
          <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
          <Link href={`/stock/${d.id}`} className="btn" style={{ borderColor: "transparent" }}>Cancel</Link>
        </ActionForm>
      </div>
    </>
  );
}

import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ActionForm, Field, SelectField, Segmented, SubmitButton } from "@/components/form";
import { api } from "@/lib/api";
import { requireOwner } from "@/lib/session";
import type { Paginated, ShopDto } from "@dscims/shared";
import { inviteUser } from "../actions";

export const metadata = { title: "Add user" };

export default async function NewUserPage() {
  const me = await requireOwner();
  const shops = await api<Paginated<ShopDto>>("/shops", { query: { pageSize: 50 } });
  return (
    <>
      <div className="pghead"><div><h1>Add a user</h1><p className="mut" style={{ margin: "6px 0 0" }}>They get an email with a link to set their own password. It works for 24 hours.</p></div></div>
      <div className="panel" style={{ maxWidth: 520 }}>
        <ActionForm action={inviteUser}>
          <input type="hidden" name="key" value={randomUUID()} />
          <Field name="name" label="Full name" autoComplete="off" />
          <Field name="email" label="Email" type="email" autoComplete="off" inputMode="email" hint="They sign in with this email." />
          <Segmented name="role" label="Role" defaultValue="staff" options={[{ value: "manager", label: "Manager" }, { value: "staff", label: "Sales staff" }]} />
          <SelectField name="shopId" label="Works in" defaultValue={me.shops[0]?.id} options={shops.items.map((s) => ({ value: s.id, label: s.name }))} />
          <SubmitButton pendingText="Sending invite...">Send invite</SubmitButton>
          <Link href="/users" className="btn" style={{ borderColor: "transparent" }}>Cancel</Link>
        </ActionForm>
      </div>
    </>
  );
}

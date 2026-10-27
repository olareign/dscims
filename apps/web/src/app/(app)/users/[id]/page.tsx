import { notFound } from "next/navigation";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { ROLE_LABELS, formatDateTimeZone } from "@dscims/shared";
import type { Paginated, ShopDto, UserDto } from "@dscims/shared";
import { ActionForm, Field, SelectField, Segmented, SubmitButton } from "@/components/form";
import { ApiError, api } from "@/lib/api";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { requireOwner } from "@/lib/session";
import { deactivateUser, reactivateUser, resendInvite, updateUser } from "../actions";

export const metadata = { title: "Manage user" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const me = await requireOwner();
  const { id } = await params;
  const done = one((await searchParams).done);
  let user: UserDto;
  try {
    user = await api<UserDto>(`/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const shops = await api<Paginated<ShopDto>>("/shops", { query: { pageSize: 50 } });
  const isOwner = user.role === "owner";
  const self = user.id === me.user.id;
  return (
    <>
      <Link href="/users" className="row b" style={{ gap: 4, color: "var(--navy)", textDecoration: "none", minHeight: 44 }}><CaretLeft className="i s" aria-hidden /> Users</Link>
      <div className="pghead"><div><h1>{user.name}</h1><p className="mut" style={{ margin: "6px 0 0", overflowWrap: "anywhere" }}>{user.email} · {ROLE_LABELS[user.role]} · {user.status === "active" ? "Active" : user.status === "invited" ? "Invited, has not set a password" : "Deactivated"}</p></div></div>
      {done === "deactivate" && <div className="ban ok" role="status">Access turned off. {user.name} is signed out.</div>}
      {done === "reactivate" && <div className="ban ok" role="status">Access turned back on.</div>}
      <div className="fx">
        <div className="panel c" style={{ flex: "1 1 360px" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Details</h2>
          {isOwner ? <p className="mut">The owner account cannot be changed here.</p> : (
            <ActionForm action={updateUser}>
              <input type="hidden" name="id" value={user.id} />
              <Field name="name" label="Full name" defaultValue={user.name} />
              <Segmented name="role" label="Role" defaultValue={user.role} options={[{ value: "manager", label: "Manager" }, { value: "staff", label: "Sales staff" }]} />
              <SelectField name="shopId" label="Works in" defaultValue={user.shopId ?? undefined} options={shops.items.map((s) => ({ value: s.id, label: s.name }))} />
              <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
            </ActionForm>
          )}
          <p className="sm faint" style={{ margin: 0 }}>Last sign-in: {user.lastSignInAt ? formatDateTimeZone(user.lastSignInAt) : "never"}</p>
        </div>
        {!isOwner && !self && (
          <div className="panel c" style={{ flex: "1 1 360px" }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Access</h2>
            {user.status === "invited" && (
              <ActionForm action={resendInvite}>
                <input type="hidden" name="id" value={user.id} />
                <p className="mut" style={{ margin: 0 }}>They have not set a password yet. Send them a fresh link.</p>
                <SubmitButton className="btn g full" pendingText="Sending...">Send a new invite</SubmitButton>
              </ActionForm>
            )}
            {user.status === "deactivated" ? (
              <ActionForm action={reactivateUser}>
                <input type="hidden" name="id" value={user.id} />
                <p className="mut" style={{ margin: 0 }}>{user.name} cannot sign in right now. Turn access back on to let them in again.</p>
                <SubmitButton className="btn p full" pendingText="Turning on...">Turn access back on</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={deactivateUser}>
                <input type="hidden" name="id" value={user.id} />
                <p className="mut" style={{ margin: 0 }}>Signs {user.name} out within a minute and stops them signing in. Their past work stays in the records.</p>
                <SubmitButton className="btn d full" pendingText="Turning off...">Turn off access</SubmitButton>
              </ActionForm>
            )}
          </div>
        )}
      </div>
    </>
  );
}

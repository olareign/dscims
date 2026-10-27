import Link from "next/link";
import { ActionForm, PasswordField, SubmitButton } from "@/components/form";
import { ApiError, api } from "@/lib/api";
import { acceptInvite } from "../../actions";

export const metadata = { title: "Join your team" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: { name: string; email: string; business: string };
  try {
    info = await api("/auth/invite/" + encodeURIComponent(token), { scope: "none" });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500) throw err;
    return (
      <>
        <div className="logo"><b>d</b>d-scims</div>
        <h1 className="h1">This link has expired</h1>
        <p className="mut" style={{ margin: 0 }}>Invite links work for 24 hours and only once. Ask the owner to send you a new one. If you already set a password, sign in instead.</p>
        <Link className="btn p" href="/login">Go to sign in</Link>
      </>
    );
  }
  return (
    <>
      <div className="logo"><b>d</b>d-scims</div>
      <div>
        <h1 className="h1">Welcome, {info.name.split(" ")[0]}</h1>
        <p className="mut" style={{ margin: "6px 0 0" }}>{info.business} added you to d-scims. Choose a password to finish. You will sign in with <b>{info.email}</b>.</p>
      </div>
      <ActionForm action={acceptInvite}>
        <input type="hidden" name="token" value={token} />
        <PasswordField name="password" label="Password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers." />
        <PasswordField name="confirm" label="Type it again" autoComplete="new-password" />
        <SubmitButton pendingText="Saving...">Save and continue</SubmitButton>
      </ActionForm>
    </>
  );
}

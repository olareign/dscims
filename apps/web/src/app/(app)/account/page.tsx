import { ROLE_LABELS } from "@dscims/shared";
import { ActionForm, PasswordField, SubmitButton } from "@/components/form";
import { requireMe } from "@/lib/session";
import { changePassword } from "./actions";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const me = await requireMe();
  return (
    <>
      <div className="pghead"><div><h1>Your account</h1><p className="mut" style={{ margin: "6px 0 0" }}>Your sign-in details. Password changes are recorded in the audit log.</p></div></div>
      <div className="panel" style={{ maxWidth: 560, display: "grid", gap: 6 }}>
        <div className="b">{me.user.name}</div>
        <div className="sm mut" style={{ overflowWrap: "anywhere" }}>{me.user.email}</div>
        <div><span className="badge">{ROLE_LABELS[me.user.role]}</span></div>
      </div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <h2 className="b" style={{ margin: "0 0 12px", fontSize: 18 }}>Change password</h2>
        <ActionForm action={changePassword}>
          <PasswordField name="currentPassword" label="Current password" />
          <PasswordField name="password" label="New password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers." />
          <PasswordField name="confirm" label="Type the new password again" autoComplete="new-password" />
          <SubmitButton pendingText="Saving...">Change password</SubmitButton>
        </ActionForm>
        <p className="sm mut" style={{ margin: "12px 0 0" }}>Forgot it? Sign out and use &ldquo;Forgot password?&rdquo; on the sign-in page.</p>
      </div>
    </>
  );
}

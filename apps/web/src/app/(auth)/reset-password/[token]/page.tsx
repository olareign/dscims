import { ActionForm, PasswordField, SubmitButton } from "@/components/form";
import { resetPassword } from "../../actions";

export const metadata = { title: "New password" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <div className="logo"><b>d</b>d-scims</div>
      <div>
        <h1 className="h1">New password</h1>
        <p className="mut" style={{ margin: "6px 0 0" }}>Choose a password you have not used before. You will be signed out on your other devices.</p>
      </div>
      <ActionForm action={resetPassword}>
        <input type="hidden" name="token" value={token} />
        <PasswordField name="password" label="New password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers." />
        <PasswordField name="confirm" label="Type it again" autoComplete="new-password" />
        <SubmitButton pendingText="Saving...">Save password</SubmitButton>
      </ActionForm>
    </>
  );
}

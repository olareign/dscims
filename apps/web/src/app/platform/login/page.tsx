import { ActionForm, Field, PasswordField, SubmitButton } from "@/components/form";
import { platformLogin } from "../actions";

export const metadata = { title: "Platform sign in" };

export default function PlatformLoginPage() {
  return (
    <div className="auth"><div className="box">
      <div className="logo"><b>d</b>d-scims <span style={{ fontWeight: 500, color: "var(--muted)" }}>Platform</span></div>
      <h1 className="h1">Pacifylabs team</h1>
      <ActionForm action={platformLogin}>
        <Field name="email" label="Email" type="email" autoComplete="username" inputMode="email" />
        <PasswordField />
        <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
      </ActionForm>
    </div></div>
  );
}

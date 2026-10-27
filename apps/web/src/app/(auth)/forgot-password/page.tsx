import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { forgotPassword } from "../actions";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="logo"><b>d</b>d-scims</div>
      <div>
        <h1 className="h1">Reset password</h1>
        <p className="mut" style={{ margin: "6px 0 0" }}>Enter the email on your account and we will send a link to set a new password.</p>
      </div>
      <ActionForm action={forgotPassword}>
        <Field name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
        <SubmitButton pendingText="Sending...">Send reset link</SubmitButton>
      </ActionForm>
      <p className="sm mut" style={{ margin: 0 }}>Cannot get into your email? Ask the owner to send you a new invite link.</p>
      <Link href="/login" className="b" style={{ textAlign: "center", color: "var(--navy)", textDecoration: "none" }}>Back to sign in</Link>
    </>
  );
}

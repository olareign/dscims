import Link from "next/link";
import { ActionForm, Field, PasswordField, SubmitButton } from "@/components/form";
import { one } from "@/lib/href";
import type { SearchParams } from "@/lib/href";
import { login } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="logo"><b>d</b>d-scims</div>
      <div>
        <h1 className="h1">Welcome back</h1>
        <p className="mut" style={{ margin: "6px 0 0" }}>Sign in to your stock, sales and debts.</p>
      </div>
      {one(sp.expired) && <div className="ban warn" role="status">Your session ended. Sign in again to continue.</div>}
      {one(sp.reset) && <div className="ban ok" role="status">Password saved. Sign in with your new password.</div>}
      <ActionForm action={login}>
        <Field name="email" label="Email" type="email" autoComplete="username" inputMode="email" />
        <PasswordField />
        <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
      </ActionForm>
      <Link href="/forgot-password" className="b" style={{ textAlign: "center", color: "var(--navy)", padding: 10, textDecoration: "none" }}>Forgot password?</Link>
      <p className="sm mut" style={{ textAlign: "center", margin: 0 }}>New dealer? Pacifylabs sets up your account. Contact us to get started.</p>
    </>
  );
}

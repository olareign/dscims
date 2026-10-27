"use client";

import { createContext, useActionState, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import type { ActionState, FormAction } from "@/lib/action";

const Ctx = createContext<ActionState>({});

/** A form wired to a server action. Shows the error, keeps typed values, and exposes field errors to <Field>. */
export function ActionForm({ action, children, className }: { action: FormAction; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  return (
    <form action={formAction} className={className} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
      <Ctx.Provider value={state}>
        {state.error && (
          <div role="alert" className="ban bad">
            <WarningCircle className="i" aria-hidden /> <span>{state.error}</span>
          </div>
        )}
        {state.ok && state.message && (
          <div role="status" className="ban ok">
            {state.message}
          </div>
        )}
        {state.link && (
          <div role="status" className="ban info" style={{ flexDirection: "column" }}>
            <span>Email is not set up yet. Send this link to them yourself:</span>
            <input readOnly className="inp" value={state.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
        {children}
      </Ctx.Provider>
    </form>
  );
}

export function useFormState() {
  return useContext(Ctx);
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: "text" | "email" | "numeric" | "tel";
  rows?: number;
}

export function Field({ name, label, type = "text", defaultValue, hint, rows, ...rest }: FieldProps) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  const value = state.values?.[name] ?? (defaultValue ?? "");
  const common = { id: name, name, className: "inp", defaultValue: value, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${name}-err` : undefined, ...rest };
  return (
    <div>
      <label className="lbl" htmlFor={name}>{label}</label>
      {rows ? <textarea {...common} rows={rows} /> : <input {...common} type={type} />}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p id={`${name}-err`} className="err">{error}</p>}
    </div>
  );
}

export function PasswordField({ name = "password", label = "Password", autoComplete = "current-password", hint }: { name?: string; label?: string; autoComplete?: string; hint?: string }) {
  const state = useFormState();
  const [show, setShow] = useState(false);
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <label className="lbl" htmlFor={name}>{label}</label>
      <div style={{ position: "relative" }}>
        <input id={name} name={name} className="inp" type={show ? "text" : "password"} autoComplete={autoComplete} style={{ paddingRight: 56 }} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-err` : undefined} />
        <button type="button" className="ib" style={{ position: "absolute", right: 2, top: 2 }} onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeSlash className="i" /> : <Eye className="i" />}
        </button>
      </div>
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p id={`${name}-err`} className="err">{error}</p>}
    </div>
  );
}

export function SelectField({ name, label, options, defaultValue }: { name: string; label: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <label className="lbl" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="inp" defaultValue={state.values?.[name] ?? defaultValue} aria-invalid={error ? true : undefined}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="err">{error}</p>}
    </div>
  );
}

export function Segmented({ name, label, options, defaultValue }: { name: string; label: string; options: { value: string; label: string }[]; defaultValue: string }) {
  const state = useFormState();
  const current = state.values?.[name] ?? defaultValue;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="lbl">{label}</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={o.value}><input type="radio" name={name} value={o.value} defaultChecked={current === o.value} /><span>{o.label}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

export function SubmitButton({ children, className = "btn p full", pendingText = "Please wait" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

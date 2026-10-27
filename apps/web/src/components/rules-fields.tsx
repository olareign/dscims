"use client";

import type { SettingsDto } from "@dscims/shared";
import { Field, useFormState } from "./form";

/** Discount limit, default credit due date and receipt text. Used by setup and by Sales rules. */
export function RulesFields({ settings }: { settings: SettingsDto }) {
  const state = useFormState();
  const days = state.values?.creditDueDays ?? String(settings.creditDueDays);
  return (
    <>
      <div className="card">
        <Field name="discountLimitPercent" label="Discount limit (%)" type="number" inputMode="numeric" defaultValue={settings.discountLimitPercent} hint="Staff cannot go above this. A manager or you must approve more." />
      </div>
      <fieldset className="card" style={{ margin: 0 }}>
        <legend className="b" style={{ padding: "0 6px" }}>Selling on credit</legend>
        <p className="sm mut" style={{ margin: "0 0 10px" }}>Customer ID details are always taken before credit is given. Due date starts at:</p>
        <div className="chips">
          {[14, 30, 60].map((d) => (
            <label key={d} className="chip"><input type="radio" name="creditDueDays" value={d} defaultChecked={days === String(d)} />{d} days</label>
          ))}
        </div>
        {state.fieldErrors?.creditDueDays && <p className="err">{state.fieldErrors.creditDueDays}</p>}
      </fieldset>
      <Field name="receiptText" label="Words at the bottom of every receipt" rows={4} defaultValue={settings.receiptText} hint="It should say the receipt does not prove a device is not stolen." />
    </>
  );
}

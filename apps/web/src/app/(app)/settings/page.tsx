import { ActionForm, Field, SubmitButton } from "@/components/form";
import { RulesFields } from "@/components/rules-fields";
import { requireOwner } from "@/lib/session";
import { saveRules } from "../setup/actions";

export const metadata = { title: "Sales rules" };

export default async function SettingsPage() {
  const me = await requireOwner();
  return (
    <>
      <div className="pghead"><div><h1>Sales rules and receipt</h1><p className="mut" style={{ margin: "6px 0 0" }}>Set once. Everything else follows these rules. Changes are recorded in the audit log.</p></div></div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <ActionForm action={saveRules}>
          <Field name="businessName" label="Business name" defaultValue={me.settings.businessName} />
          <RulesFields settings={me.settings} />
          <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}

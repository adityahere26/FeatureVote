import { ActionForm } from "@/components/action-form";
import { inputClass, primaryButtonClass } from "@/components/workspace/styles";

export function RequestForm({ action, slug, hiddenFields, title = "", body = "", submitLabel }) {
  return (
    <ActionForm action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Title
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={title}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Details
        <textarea
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={body}
          className={inputClass}
        />
      </label>
      <div>
        <button type="submit" className={primaryButtonClass}>
          {submitLabel}
        </button>
      </div>
    </ActionForm>
  );
}

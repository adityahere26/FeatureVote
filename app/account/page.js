import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/workspace/styles";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount, updateDisplayName } from "./actions";

export const metadata = { title: "Account · FeatureVote" };

export default async function AccountPage() {
  const userId = await requireUserId("/account");
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  if (error) {
    throw new Error("Could not load profile");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-semibold">Account</h1>

        <ActionForm action={updateDisplayName} className="flex flex-col items-start gap-3">
          <label className="flex w-full flex-col gap-1 text-sm font-medium">
            Display name
            <input
              name="displayName"
              required
              maxLength={80}
              defaultValue={profile.display_name}
              className={inputClass}
            />
          </label>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Shown publicly next to your requests and comments.
          </p>
          <button type="submit" className={primaryButtonClass}>
            Save
          </button>
        </ActionForm>

        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Delete account</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This permanently removes your account, profile, votes and workspace memberships.
            Requests and comments you wrote stay on their boards, shown as written by
            &quot;Deleted user&quot;. Delete anything you want removed first.
          </p>
          <ActionForm action={deleteAccount} className="flex flex-col items-start gap-2">
            <label className="flex w-full flex-col gap-1 text-sm font-medium">
              Type &quot;delete my account&quot; to confirm
              <input name="confirmation" required autoComplete="off" className={inputClass} />
            </label>
            <button type="submit" className={dangerButtonClass}>
              Delete account
            </button>
          </ActionForm>
        </section>
      </main>
    </>
  );
}

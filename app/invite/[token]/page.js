import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import { primaryButtonClass } from "@/components/workspace/styles";
import { requireUserId } from "@/lib/auth";
import { acceptInvite } from "./actions";

// The URL carries a secret, so keep it out of Referer headers and search engines.
export const metadata = {
  title: "Workspace invite · FeatureVote",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }) {
  const { token } = await params;
  await requireUserId(`/invite/${token}`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-semibold">You&apos;ve been invited to a workspace</h1>
        {/* Accepting needs a click, so link previews can't use up the invite. */}
        <ActionForm action={acceptInvite} className="flex flex-col items-start gap-3">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={primaryButtonClass}>
            Accept invite
          </button>
        </ActionForm>
      </main>
    </>
  );
}

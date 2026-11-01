import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import { InvitePanel } from "@/components/workspace/invite-panel";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/workspace/styles";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspaces";
import {
  changeMemberRole,
  deleteWorkspace,
  removeMember,
  revokeInvite,
  updateWorkspace,
} from "./actions";

export const metadata = { title: "Settings · FeatureVote" };

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function WorkspaceFields({ workspace }) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <input type="hidden" name="slug" value={workspace.slug} />
    </>
  );
}

export default async function SettingsPage({ params }) {
  const { slug } = await params;
  await requireUserId(`/w/${slug}/settings`);

  const workspace = await getWorkspace(slug);
  if (!workspace?.role) {
    notFound();
  }
  const isOwner = workspace.role === "owner";
  const isAdmin = isOwner || workspace.role === "admin";

  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("workspace_memberships")
    .select("user_id, role, profiles (display_name)")
    .eq("workspace_id", workspace.id)
    .order("created_at");
  if (error) {
    throw new Error("Could not load members");
  }

  let invites = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("workspace_invites")
      .select("id, role, expires_at")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    invites = data ?? [];
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <Link href={`/w/${slug}`} className="text-sm">
            {workspace.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
        </div>

        {isAdmin && (
          <Section title="General">
            <ActionForm action={updateWorkspace} className="flex flex-col gap-3">
              <WorkspaceFields workspace={workspace} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                Name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={workspace.name}
                  className={inputClass}
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  name="isPublic"
                  type="checkbox"
                  defaultChecked={workspace.is_public}
                  className="mt-0.5"
                />
                <span>Public: anyone can read this board, and anyone signed in can take part.</span>
              </label>
              <div>
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </div>
            </ActionForm>
          </Section>
        )}

        <Section title="Members">
          <ul className="flex flex-col gap-2">
            {members.map((member) => {
              const isSelf = member.user_id === workspace.userId;
              const canRemove =
                !isSelf && (isOwner || (isAdmin && member.role === "member"));
              const label = member.profiles?.display_name ?? "Member";

              return (
                <li
                  key={member.user_id}
                  data-testid="member"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                >
                  <span>
                    {label}
                    {isSelf && " (you)"}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {isOwner ? (
                      <ActionForm action={changeMemberRole} className="flex items-center gap-2">
                        <WorkspaceFields workspace={workspace} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          aria-label={`Role for ${label}`}
                          className={inputClass}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                        <button type="submit" className={secondaryButtonClass}>
                          Update
                        </button>
                      </ActionForm>
                    ) : (
                      <span className="text-neutral-600 dark:text-neutral-400">{member.role}</span>
                    )}
                    {canRemove && (
                      <ActionForm action={removeMember}>
                        <WorkspaceFields workspace={workspace} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <button type="submit" className={dangerButtonClass}>
                          Remove
                        </button>
                      </ActionForm>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        {isAdmin && (
          <Section title="Invites">
            <InvitePanel workspaceId={workspace.id} slug={slug} canInviteAdmins={isOwner} />
            {invites.length > 0 && (
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    data-testid="invite"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                  >
                    <span>
                      {invite.role} invite, expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </span>
                    <ActionForm action={revokeInvite}>
                      <WorkspaceFields workspace={workspace} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className={secondaryButtonClass}>
                        Revoke
                      </button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section title="Leave workspace">
          <ActionForm action={removeMember} className="flex flex-col items-start gap-2">
            <WorkspaceFields workspace={workspace} />
            <input type="hidden" name="userId" value={workspace.userId} />
            <input type="hidden" name="leaving" value="true" />
            <button type="submit" className={secondaryButtonClass}>
              Leave workspace
            </button>
          </ActionForm>
        </Section>

        {isOwner && (
          <Section title="Delete workspace">
            <ActionForm action={deleteWorkspace} className="flex flex-col items-start gap-2">
              <WorkspaceFields workspace={workspace} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                This permanently deletes every request, vote and comment. Type {slug} to confirm.
                <input name="confirmation" required autoComplete="off" className={inputClass} />
              </label>
              <button type="submit" className={dangerButtonClass}>
                Delete workspace
              </button>
            </ActionForm>
          </Section>
        )}
      </main>
    </>
  );
}

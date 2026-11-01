import { expect } from "@playwright/test";

const password = "correct-horse-battery";

export function uniqueId(label) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export async function signUp(page) {
  await page.getByLabel("Email").fill(`${uniqueId("e2e")}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signUpAt(page, path = "/workspaces") {
  await page.goto(path);
  await signUp(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function createWorkspace(page, { isPublic = false } = {}) {
  const slug = uniqueId("ws");
  await page.goto("/workspaces/new");
  await page.getByLabel("Name").fill(`Workspace ${slug}`);
  await page.getByLabel("URL").fill(slug);
  if (isPublic) {
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(`/w/${slug}`);
  return slug;
}

export async function createInvitePath(page, slug, role = "member") {
  await page.goto(`/w/${slug}/settings`);
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = await page.getByLabel("Invite link").inputValue();
  return new URL(link).pathname;
}

import { expect, test } from "@playwright/test";
import { createInvitePath, createWorkspace, signUpAt, uniqueId } from "./helpers";

async function newUser(browser, path) {
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const page = await context.newPage();
  await signUpAt(page, path);
  return page;
}

test("private workspaces are hidden until someone is invited", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);

  const outsider = await newUser(browser);
  await outsider.goto(`/w/${slug}`);
  await expect(outsider.getByText("Could not be found", { exact: false })).toBeVisible();
  await outsider.goto(`/w/${slug}/settings`);
  await expect(outsider.getByRole("heading", { name: "Settings" })).toHaveCount(0);

  const invitePath = await createInvitePath(owner, slug);
  const member = await newUser(browser, invitePath);
  await member.getByRole("button", { name: "Accept invite" }).click();
  await expect(member).toHaveURL(`/w/${slug}`);

  await member.goto(`/w/${slug}/settings`);
  await expect(member.getByTestId("member")).toHaveCount(2);
  await expect(member.getByRole("heading", { name: "Invites" })).toHaveCount(0);
  await expect(member.getByRole("heading", { name: "General" })).toHaveCount(0);

  await outsider.goto(invitePath);
  await outsider.getByRole("button", { name: "Accept invite" }).click();
  await expect(outsider.getByText("invalid, already used, or expired")).toBeVisible();
});

test("owners manage roles and removing someone ends their access", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);
  const invitePath = await createInvitePath(owner, slug);

  const member = await newUser(browser, invitePath);
  await member.getByRole("button", { name: "Accept invite" }).click();
  await expect(member).toHaveURL(`/w/${slug}`);

  await owner.goto(`/w/${slug}/settings`);
  const row = owner.getByTestId("member").nth(1);
  await row.getByRole("combobox").selectOption("admin");
  await row.getByRole("button", { name: "Update" }).click();
  await expect(row.getByRole("combobox")).toHaveValue("admin");

  await member.goto(`/w/${slug}/settings`);
  await expect(member.getByRole("heading", { name: "Invites" })).toBeVisible();
  await expect(member.getByRole("heading", { name: "Delete workspace" })).toHaveCount(0);

  await row.getByRole("button", { name: "Remove" }).click();
  await expect(owner.getByTestId("member")).toHaveCount(1);

  await member.goto(`/w/${slug}`);
  await expect(member.getByText("Could not be found", { exact: false })).toBeVisible();
});

test("revoked invites stop working", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);
  const invitePath = await createInvitePath(owner, slug);

  await owner.goto(`/w/${slug}/settings`);
  await owner.getByRole("button", { name: "Revoke" }).click();
  await expect(owner.getByTestId("invite")).toHaveCount(0);

  const visitor = await newUser(browser, invitePath);
  await visitor.getByRole("button", { name: "Accept invite" }).click();
  await expect(visitor.getByText("invalid, already used, or expired")).toBeVisible();
});

test("public workspaces can be read without signing in", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });

  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const visitor = await context.newPage();
  await visitor.goto(`/w/${slug}`);
  await expect(visitor.getByText("Public board")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("a taken URL is refused, and the last owner cannot leave", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);

  await owner.goto("/workspaces/new");
  await owner.getByLabel("Name").fill("Duplicate");
  await owner.getByLabel("URL").fill(slug);
  await owner.getByRole("button", { name: "Create workspace" }).click();
  await expect(owner.getByText("already taken")).toBeVisible();

  await owner.goto(`/w/${slug}/settings`);
  await owner.getByRole("button", { name: "Leave workspace" }).click();
  await expect(owner.getByText("must keep at least one owner")).toBeVisible();
  await expect(owner).toHaveURL(`/w/${slug}/settings`);
});

test("deleting a workspace needs the URL typed exactly", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);

  await owner.goto(`/w/${slug}/settings`);
  await owner.getByLabel("Type", { exact: false }).fill(uniqueId("wrong"));
  await owner.getByRole("button", { name: "Delete workspace" }).click();
  await expect(owner.getByText("exactly to confirm")).toBeVisible();

  await owner.getByLabel("Type", { exact: false }).fill(slug);
  await owner.getByRole("button", { name: "Delete workspace" }).click();
  await expect(owner).toHaveURL("/workspaces");
  await owner.goto(`/w/${slug}`);
  await expect(owner.getByText("Could not be found", { exact: false })).toBeVisible();
});

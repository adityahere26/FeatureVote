import { expect, test } from "@playwright/test";
import { createInvitePath, createWorkspace, signUpAt, uniqueId } from "./helpers";

async function newUser(browser, path) {
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const page = await context.newPage();
  await signUpAt(page, path);
  return page;
}

async function anonymous(browser) {
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  return context.newPage();
}

async function submitRequest(page, slug, title, body = "") {
  await page.goto(`/w/${slug}/requests/new`);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Details").fill(body);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return page.url();
}

test("a customer submits a request that anyone can read", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });

  const customer = await newUser(browser);
  const url = await submitRequest(customer, slug, "Dark mode", "Please add a dark theme.");

  const visitor = await anonymous(browser);
  await visitor.goto(`/w/${slug}`);
  await expect(visitor.getByRole("link", { name: "Dark mode" })).toBeVisible();
  await visitor.goto(url);
  await expect(visitor.getByText("Please add a dark theme.")).toBeVisible();
  await expect(visitor.getByRole("link", { name: /Sign in to vote/ })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Sign in to comment" })).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Update status" })).toHaveCount(0);
});

test("each person gets one vote, and can take it back", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });
  const url = await submitRequest(owner, slug, "CSV export");

  const voter = await newUser(browser);
  await voter.goto(url);
  await voter.getByRole("button", { name: "Vote, 0 votes" }).click();
  await expect(voter.getByRole("button", { name: "Remove your vote, 1 vote" })).toBeVisible();

  await owner.goto(url);
  await owner.getByRole("button", { name: "Vote, 1 vote" }).click();
  await expect(owner.getByRole("button", { name: "Remove your vote, 2 votes" })).toBeVisible();

  await voter.reload();
  await voter.getByRole("button", { name: "Remove your vote, 2 votes" }).click();
  await expect(voter.getByRole("button", { name: "Vote, 1 vote" })).toBeVisible();
});

test("search, status filter and sort work together", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });
  const first = await submitRequest(owner, slug, "Slack alerts", "Notify our channel");
  await submitRequest(owner, slug, "Billing page", "Show invoices");
  const third = await submitRequest(owner, slug, "Audit log", "Notifies admins about changes");

  await owner.goto(third);
  await owner.getByRole("button", { name: "Vote, 0 votes" }).click();
  await expect(owner.getByRole("button", { name: /Remove your vote/ })).toBeVisible();

  await owner.goto(first);
  await owner.getByLabel("Status", { exact: false }).selectOption("planned");
  await owner.getByRole("button", { name: "Update status" }).click();
  await expect(owner.getByText("Status updated.")).toBeVisible();

  await owner.goto(`/w/${slug}`);
  await expect(owner.getByTestId("request").first()).toContainText("Audit log");
  await expect(owner.getByTestId("request")).toHaveCount(3);

  await owner.getByLabel("Search").fill("notify");
  await owner.getByRole("button", { name: "Apply" }).click();
  await expect(owner.getByTestId("request")).toHaveCount(2);

  await owner.getByRole("combobox", { name: "Status", exact: false }).selectOption("planned");
  await owner.getByRole("button", { name: "Apply" }).click();
  await expect(owner.getByTestId("request")).toHaveCount(1);
  await expect(owner.getByTestId("request")).toContainText("Slack alerts");

  await owner.getByLabel("Search").fill("nothing matches this");
  await owner.getByRole("button", { name: "Apply" }).click();
  await expect(owner.getByText("No requests match these filters.")).toBeVisible();
});

test("only admins change status, and only authors or admins moderate", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });

  const author = await newUser(browser);
  const url = await submitRequest(author, slug, "Webhooks");
  await expect(author.getByRole("button", { name: "Update status" })).toHaveCount(0);
  await author.getByLabel("Add a comment").fill("My own comment");
  await author.getByRole("button", { name: "Post comment" }).click();
  await expect(author.getByTestId("comment")).toHaveCount(1);

  const stranger = await newUser(browser);
  await stranger.goto(url);
  await expect(stranger.getByRole("link", { name: "Edit request" })).toHaveCount(0);
  await expect(stranger.getByRole("button", { name: "Delete comment" })).toHaveCount(0);
  await stranger.goto(`${url}/edit`);
  await expect(stranger.getByRole("button", { name: "Save changes" })).toHaveCount(0);

  await author.goto(`${url}/edit`);
  await author.getByLabel("Title").fill("Outgoing webhooks");
  await author.getByRole("button", { name: "Save changes" }).click();
  await expect(author.getByRole("heading", { name: "Outgoing webhooks" })).toBeVisible();

  await owner.goto(url);
  await owner.getByRole("button", { name: "Delete comment" }).click();
  await expect(owner.getByTestId("comment")).toHaveCount(0);

  await owner.getByText("Delete request").click();
  await owner.getByRole("button", { name: "Confirm delete" }).click();
  await expect(owner).toHaveURL(`/w/${slug}`);
  await expect(owner.getByText("No requests yet.")).toBeVisible();
});

test("private boards stay private, even with a direct link", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner);
  const url = await submitRequest(owner, slug, "Secret plan", "Do not share");

  const outsider = await newUser(browser);
  await outsider.goto(url);
  await expect(outsider.getByText("Could not be found", { exact: false })).toBeVisible();
  await expect(outsider.getByText("Do not share")).toHaveCount(0);

  const member = await newUser(browser, await createInvitePath(owner, slug));
  await member.getByRole("button", { name: "Accept invite" }).click();
  await expect(member).toHaveURL(`/w/${slug}`);
  await member.goto(url);
  await expect(member.getByText("Do not share")).toBeVisible();
});

test("a request cannot be opened through another workspace's URL", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });
  const url = await submitRequest(owner, slug, "Belongs to the first board");
  const otherSlug = await createWorkspace(owner, { isPublic: true });

  await owner.goto(url.replace(`/w/${slug}/`, `/w/${otherSlug}/`));
  await expect(owner.getByText("Could not be found", { exact: false })).toBeVisible();

  await owner.goto(`/w/${slug}/requests/not-a-uuid`);
  await expect(owner.getByText("Could not be found", { exact: false })).toBeVisible();
});

test("user text is shown as text, never run as code", async ({ browser }) => {
  const owner = await newUser(browser);
  const slug = await createWorkspace(owner, { isPublic: true });
  const marker = uniqueId("xss");
  const title = `<img src=x onerror="window.pwned=1"> ${marker}`;
  await submitRequest(owner, slug, title, `<script>window.pwned=1</script>`);

  await owner.goto(`/w/${slug}`);
  await expect(owner.getByRole("link", { name: title })).toBeVisible();
  expect(await owner.evaluate(() => window.pwned)).toBeUndefined();
});

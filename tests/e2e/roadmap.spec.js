import { expect, test } from "@playwright/test";
import { createWorkspace, signUpAt } from "./helpers";

async function newContext(browser) {
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  return context.newPage();
}

async function addRequest(page, slug, title, status) {
  await page.goto(`/w/${slug}/requests/new`);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  if (status) {
    await page.getByRole("combobox", { name: "Status", exact: false }).selectOption(status);
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText("Status updated.")).toBeVisible();
  }
}

test("the roadmap shows each request under its status, publicly", async ({ browser }) => {
  const owner = await newContext(browser);
  await signUpAt(owner);
  const slug = await createWorkspace(owner, { isPublic: true });

  await addRequest(owner, slug, "Fresh idea");
  await addRequest(owner, slug, "Coming soon", "planned");
  await addRequest(owner, slug, "Being built", "in_progress");
  await addRequest(owner, slug, "Shipped thing", "released");
  await addRequest(owner, slug, "Not doing this", "declined");

  const visitor = await newContext(browser);
  await visitor.goto(`/w/${slug}/roadmap`);
  await expect(visitor.getByTestId("roadmap-under_review")).toContainText("Fresh idea");
  await expect(visitor.getByTestId("roadmap-planned")).toContainText("Coming soon");
  await expect(visitor.getByTestId("roadmap-in_progress")).toContainText("Being built");
  await expect(visitor.getByTestId("roadmap-released")).toContainText("Shipped thing");
  await expect(visitor.getByTestId("roadmap-declined")).toContainText("Not doing this");
});

test("a private roadmap is hidden from outsiders", async ({ browser }) => {
  const owner = await newContext(browser);
  await signUpAt(owner);
  const slug = await createWorkspace(owner);
  await addRequest(owner, slug, "Secret item");

  const visitor = await newContext(browser);
  await visitor.goto(`/w/${slug}/roadmap`);
  await expect(visitor.getByText("Could not be found", { exact: false })).toBeVisible();
  await expect(visitor.getByText("Secret item")).toHaveCount(0);
});

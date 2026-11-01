import { expect, test } from "@playwright/test";
import { createWorkspace, signUpAt } from "./helpers";

const password = "correct-horse-battery";

test("a display name can be changed and appears on requests", async ({ page }) => {
  await signUpAt(page);
  const slug = await createWorkspace(page, { isPublic: true });

  await page.goto("/account");
  await page.getByLabel("Display name").fill("Sam from Acme");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(`/w/${slug}/requests/new`);
  await page.getByLabel("Title").fill("Named request");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText(/Sam from Acme/)).toBeVisible();
});

test("a sole owner must hand over before deleting their account", async ({ page }) => {
  await signUpAt(page);
  const slug = await createWorkspace(page);

  await page.goto("/account");
  await page.getByLabel(/to confirm/).fill("delete my account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText(`Workspace ${slug}`)).toBeVisible();
  await expect(page).toHaveURL("/account");
});

test("deleting an account signs out, blocks login and keeps feedback", async ({ browser }) => {
  const newPage = async () =>
    (await browser.newContext({ baseURL: "http://localhost:3100" })).newPage();

  const owner = await newPage();
  await signUpAt(owner);
  const slug = await createWorkspace(owner, { isPublic: true });

  const customer = await newPage();
  const email = `e2e-delete-${Date.now()}@example.com`;
  await customer.goto("/login");
  await customer.getByLabel("Email").fill(email);
  await customer.getByLabel("Password").fill(password);
  await customer.getByRole("button", { name: "Create account" }).click();
  await customer.waitForURL("/workspaces");

  await customer.goto(`/w/${slug}/requests/new`);
  await customer.getByLabel("Title").fill("Feedback that should stay");
  await customer.getByRole("button", { name: "Submit request" }).click();
  await customer.getByRole("button", { name: "Vote, 0 votes" }).click();
  await expect(customer.getByRole("button", { name: /Remove your vote/ })).toBeVisible();

  await customer.goto("/account");
  await customer.getByLabel(/to confirm/).fill("wrong words");
  await customer.getByRole("button", { name: "Delete account" }).click();
  await expect(customer.getByText("to confirm.")).toBeVisible();

  await customer.getByLabel(/to confirm/).fill("delete my account");
  await customer.getByRole("button", { name: "Delete account" }).click();
  await customer.waitForURL("/");
  await customer.goto("/workspaces");
  await expect(customer).toHaveURL(/\/login/);

  await customer.getByLabel("Email").fill(email);
  await customer.getByLabel("Password").fill(password);
  await customer.getByRole("button", { name: "Sign in" }).click();
  await expect(customer.getByText("Those details didn't work")).toBeVisible();

  await owner.goto(`/w/${slug}`);
  const request = owner.getByTestId("request");
  await expect(request).toContainText("Feedback that should stay");
  await expect(request).toContainText("Deleted user");
  await expect(request.getByRole("button", { name: "Vote, 0 votes" })).toBeVisible();
});

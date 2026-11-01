import { expect, test } from "@playwright/test";

const password = "correct-horse-battery";

async function fillCredentials(page, email) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

test("signing up, out and back in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login\?next=%2Fworkspaces/);

  await fillCredentials(page, email);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login/);

  await fillCredentials(page, email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await fillCredentials(page, "nobody@example.com");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Those details didn't work")).toBeVisible();
});

test("a crafted next link cannot leave the site", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await fillCredentials(page, `e2e-next-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/workspaces");
});

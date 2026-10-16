import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("protected routes redirect to login and back", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/);
  await login(page, "sam@brightline.demo", "/leads");
  await expect(page).toHaveURL(/\/leads/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("sam@brightline.demo");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("rep lands on desk, manager lands on team", async ({ page, context }) => {
  await login(page, "sam@brightline.demo");
  await expect(page).toHaveURL(/\/desk/);
  await context.clearCookies();
  await login(page, "dana@brightline.demo");
  await expect(page).toHaveURL(/\/team/);
});

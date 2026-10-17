import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("reps cannot open the manager dashboard", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/sales-floor");
  await expect(page).toHaveURL(/\/desk/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Team/ })).toHaveCount(0);
});

test("manager assigns an unassigned inbound lead from the Team dashboard", async ({ page }) => {
  await login(page, "dana@brightline.demo", "/sales-floor");
  const panel = page.getByRole("complementary", { name: "Needs attention" });
  const first = panel.locator("li").filter({ has: page.getByRole("button", { name: "Assign" }) }).first();
  test.skip((await first.count()) === 0, "no unassigned leads left");
  const name = (await first.getByRole("link").first().textContent())!.trim();
  await first.getByRole("combobox").selectOption({ label: "Marcus Lee" });
  await first.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText("Assigned to Marcus Lee")).toBeVisible();
  await expect(panel.getByRole("link", { name })).toHaveCount(0);
});

test("a meeting booked on the desk shows up in team metrics immediately", async ({ page, context }) => {
  await login(page, "dana@brightline.demo", "/sales-floor?period=today");
  const meetingsTile = page.locator("dl > div").filter({ hasText: "Meetings booked" }).locator("dd").first();
  const before = Number((await meetingsTile.textContent())!.replace(/\D/g, ""));

  await context.clearCookies();
  await login(page, "priya@brightline.demo", "/leads?owner=me&status=connected");
  await page.locator("tbody tr").first().locator("a").first().click();
  await page.getByRole("main").getByRole("link", { name: "Call C", exact: true }).click();
  await expect(page).toHaveURL(/\/desk\?lead=/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Why this lead now")).toBeVisible();
  await page.keyboard.press("7");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Deal added to pipeline/)).toBeVisible();

  await context.clearCookies();
  await login(page, "dana@brightline.demo", "/sales-floor?period=today");
  await expect(meetingsTile).toHaveText(String(before + 1));
});

test("analytics renders for reps scoped to themselves", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/analytics?period=7d");
  await expect(page.getByRole("heading", { name: "Analytics · You" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When people pick up" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Call outcomes" })).toBeVisible();
});

test("owner adds a team member who can then sign in", async ({ page, context }) => {
  const email = `new.rep.${Date.now()}@brightline.demo`;
  await login(page, "jordan@brightline.demo", "/settings");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a team member" });
  await dialog.getByLabel("Full name").fill("Taylor New");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Temporary password").fill("welcome-123");
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(/Taylor New added/)).toBeVisible();

  await context.clearCookies();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("welcome-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/desk/);
  await expect(page.getByRole("heading", { name: "Calling Desk" })).toBeVisible();

  // Clean up: remove the member again so repeated runs don't accumulate users.
  await context.clearCookies();
  await login(page, "jordan@brightline.demo", "/settings");
  await page.locator("li").filter({ hasText: email }).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/Member removed/)).toBeVisible();
});

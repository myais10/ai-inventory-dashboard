import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("lead database: search, open, add note → appears on timeline", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/leads");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const firstCompany = (await rows.first().locator("td").nth(1).locator("span").first().textContent())!.trim();
  await page.getByLabel("Search leads").fill(firstCompany);
  await expect(page).toHaveURL(/q=/);
  await expect(rows.first()).toContainText(firstCompany);

  await rows.first().locator("a").first().click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}/);
  await expect(page.getByRole("region", { name: "Next action" })).toBeVisible();
  const note = `E2E note ${Date.now()}`;
  await page.getByLabel("Add a note").fill(note);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText(note)).toBeVisible();
});

test("manager bulk-assigns unassigned leads; the assignment shows on the lead timeline", async ({ page }) => {
  await login(page, "dana@brightline.demo", "/leads?owner=unassigned&status=new");
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "no unassigned leads left in this database");
  const name = (await rows.first().locator("td").nth(1).locator("a").textContent())!.trim();
  await rows.first().locator('input[type="checkbox"]').check();
  await page.getByLabel("Assign selected leads to").selectOption({ label: "Priya Shah" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/1 lead assigned/)).toBeVisible();
  await page.goto(`/leads?owner=all&q=${encodeURIComponent(name)}`);
  await page.locator("tbody tr").first().locator("a").first().click();
  await expect(page.getByText("Assigned to Priya Shah").first()).toBeVisible();
});

test("status change is recorded and keyboard navigation works", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/leads?status=attempting");
  await page.keyboard.press("j");
  await expect(page.locator("tbody tr.outline")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await page.getByLabel("Lead status").selectOption("nurture");
  await expect(page.getByText("Status set to Nurture")).toBeVisible();
  await expect(page.getByText("Status changed to Nurture").first()).toBeVisible();
});

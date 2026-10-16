import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("rep moves a deal forward from the board; stage change lands on the deal timeline", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/pipeline?owner=me");
  const firstMove = page.locator('select[id^="mv-"]').first();
  await expect(firstMove).toBeVisible();
  const dealLink = page.locator("li").filter({ has: firstMove }).getByRole("link").first();
  const company = (await dealLink.textContent())!.trim();
  const href = (await dealLink.getAttribute("href"))!;
  const options = await firstMove.locator("option").allTextContents();
  const target = options.find((o) => o === "Proposal" || o === "Demo" || o === "Negotiation")!;
  await firstMove.selectOption({ label: target });
  await expect(page.getByText(`${company} → ${target}`)).toBeVisible();
  await page.goto(href);
  await expect(page.getByText(`Deal moved to ${target}`).first()).toBeVisible();
});

test("marking a deal lost requires a reason and closes it", async ({ page }) => {
  await login(page, "dana@brightline.demo", "/pipeline?owner=all");
  const href = await page.getByRole("listitem", { name: /^Meeting Booked:/ }).getByRole("link").first().getAttribute("href");
  await page.goto(href!);
  await page.getByRole("button", { name: "Mark lost" }).click();
  await expect(page.getByRole("dialog", { name: "Why was this deal lost?" })).toBeVisible();
  await page.getByRole("button", { name: "Went dark" }).click();
  await expect(page.getByText("Moved to Closed Lost", { exact: true })).toBeVisible();
  await expect(page.getByText("Lost reason: Went dark").first()).toBeVisible();
});

test("completing a task removes it from the list and records it on the timeline", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/tasks?bucket=upcoming");
  const first = page.locator("main li").first();
  const title = (await first.locator("div.font-medium").first().textContent())!.trim();
  await first.getByRole("checkbox").click();
  await expect(page.getByText("Task completed").first()).toBeVisible();
  await page.goto("/tasks?bucket=done");
  await expect(page.getByText(title).first()).toBeVisible();
});

test("a callback logged on the desk appears in Tasks", async ({ page }) => {
  await login(page, "elena@brightline.demo", "/leads?owner=me&status=attempting");
  const row = page.locator("tbody tr").nth(2);
  const name = (await row.locator("a").first().textContent())!.trim();
  await row.locator("a").first().click();
  await page.getByRole("main").getByRole("link", { name: "Call C", exact: true }).click();
  await expect(page).toHaveURL(/\/desk\?lead=/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Why this lead now")).toBeVisible();
  await page.keyboard.press("6");
  await expect(page.getByRole("button", { name: /Callback requested/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByText(new RegExp(`${name}: Callback requested`))).toBeVisible();
  await page.goto("/tasks?bucket=upcoming");
  await expect(page.getByText(`Call back ${name} (requested)`).first()).toBeVisible();
});

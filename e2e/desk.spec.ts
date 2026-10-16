import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function currentLead(page: Page) {
  // After hours the queue can be empty; "Work ahead" pulls the next scheduled lead forward.
  const workAhead = page.getByRole("button", { name: /Work ahead/ });
  if (await workAhead.isVisible().catch(() => false)) {
    await workAhead.click();
    await page.waitForURL(/lead=/);
  }
  const link = page.getByRole("region", { name: "Current lead" }).getByRole("heading", { level: 2 }).getByRole("link");
  await expect(link).toBeVisible();
  return { name: (await link.textContent())!.trim(), href: (await link.getAttribute("href"))! };
}

/** Lead Database → Lead Detail → Call: opens a specific lead in the desk regardless of queue state. */
async function openInDesk(page: Page, listUrl: string, row = 0) {
  await page.goto(listUrl);
  await page.locator("tbody tr").nth(row).locator("a").first().click();
  await page.getByRole("main").getByRole("link", { name: /^Call\b/ }).click();
  await expect(page).toHaveURL(/\/desk\?lead=/);
  await page.waitForLoadState("networkidle");
  return currentLead(page);
}

test("dial → hang up → no answer → saved to timeline, next lead loads", async ({ page }) => {
  await login(page, "sam@brightline.demo", "/desk");
  const lead = await currentLead(page);
  await page.keyboard.press("c");
  await expect(page.getByText(/^Live · /)).toBeVisible();
  await page.getByLabel("Call notes").fill("E2E: rang out, no voicemail box");
  await page.getByLabel("Call notes").blur();
  await page.keyboard.press("h");
  await expect(page.getByText(/^Ended · /)).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByText(/escalating cadence/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(new RegExp(`${lead.name}: No answer`))).toBeVisible();
  await expect.poll(async () => (await currentLead(page)).name).not.toBe(lead.name);

  await page.goto(lead.href);
  const activity = page.getByRole("region", { name: "Next action" });
  await expect(activity).toContainText(/Call \(attempt \d+\)/);
  await expect(page.getByText("E2E: rang out, no voicemail box")).toBeVisible();
});

test("callback requested schedules a callback task and next action", async ({ page }) => {
  await login(page, "priya@brightline.demo", "/desk");
  const lead = await currentLead(page);
  await page.keyboard.press("6");
  await expect(page.getByLabel(/Callback time/)).not.toHaveValue("");
  await page.getByRole("button", { name: /Save & next/ }).click();
  await expect(page.getByText(new RegExp(`${lead.name}: Callback requested`))).toBeVisible();
  await page.goto(lead.href);
  await expect(page.getByRole("region", { name: "Next action" })).toContainText("Callback");
  await expect(page.getByText(/Call back .* \(requested\)/).first()).toBeVisible();
});

test("not interested requires a reason; meeting booked opens a deal", async ({ page }) => {
  await login(page, "marcus@brightline.demo");
  let lead = await openInDesk(page, "/leads?owner=me&status=attempting", 0);
  await page.keyboard.press("8");
  await expect(page.getByRole("button", { name: /Save & next/ })).toBeDisabled();
  await page.getByRole("radio", { name: "Bad timing" }).click();
  await page.keyboard.press("Enter");
  await expect(page.getByText(new RegExp(`${lead.name}: Not interested`))).toBeVisible();

  lead = await openInDesk(page, "/leads?owner=me&status=attempting", 1);
  await page.keyboard.press("7");
  await expect(page.getByText(/opens a deal/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Deal added to pipeline/)).toBeVisible();
  await page.goto(lead.href);
  await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();
  await expect(page.getByText("Meeting Booked").first()).toBeVisible();
  await expect(page.getByText("Qualified").first()).toBeVisible();
});

test("skip moves to the next lead without logging", async ({ page }) => {
  await login(page, "elena@brightline.demo", "/desk");
  const lead = await currentLead(page);
  await page.keyboard.press("s");
  await expect.poll(async () => (await currentLead(page)).name).not.toBe(lead.name);
  await expect(page.getByText(/1 skipped/).last()).toBeVisible();
});

// Smoke test of the screens ported from main (regulated compliance, mUSD
// subscriptions) against `npm run deploy:compliance:local`. Run on its own:
//   E2E_NO_REVERT=1 npx playwright test e2e/03-regulated.spec.ts
import { expect, test, type Page } from "@playwright/test";
import { accounts, connect, nav, walletPage } from "./wallet";

test.skip(!process.env.E2E_NO_REVERT, "Needs deploy:compliance:local state");
test.describe.configure({ mode: "serial" });

const attestor = accounts.investor1; // Hardhat account 2 in deployCompliance.ts
const approved = accounts.investor2; // account 3
const out = "../docs/frontend-screenshots";
const errors: string[] = [];
const watch = (page: Page) => {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
};
async function shoot(page: Page, name: string, width: number) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page
    .waitForFunction(() => !document.querySelector(".skeleton"), null, {
      timeout: 20_000,
    })
    .catch(() => undefined);
  await page.screenshot({
    path: `${out}/${name}-${width}.png`,
    fullPage: true,
  });
}

for (const width of [1440, 390]) {
  test(`approved investor sees compliance and offerings at ${width}px`, async ({
    browser,
  }) => {
    const page = watch(await walletPage(browser, approved, { width }));
    await nav(page, "/compliance");
    await connect(page);
    await expect(
      page.getByRole("heading", { name: "Your investor identity" }),
    ).toBeVisible();
    await expect(
      page.getByText("Valid", { exact: true }).first(),
    ).toBeVisible();
    // No admin controls for an ordinary investor.
    await expect(
      page.getByRole("button", { name: "Trust attestor" }),
    ).toHaveCount(0);
    await shoot(page, "investor-compliance", width);
    await nav(page, "/subscriptions");
    await expect(
      page.getByRole("heading", { level: 1, name: "Subscription offerings" }),
    ).toBeVisible();
    await shoot(page, "investor-subscription-offerings", width);
    await page.context().close();
  });

  test(`attestor sees credential controls at ${width}px`, async ({
    browser,
  }) => {
    const page = watch(await walletPage(browser, attestor, { width }));
    await nav(page, "/compliance");
    await connect(page);
    await expect(
      page.getByRole("button", { name: "Register identity" }),
    ).toBeVisible();
    await shoot(page, "attestor-compliance", width);
    await page.context().close();
  });

  test(`issuer sees regulated issuance and offering creation at ${width}px`, async ({
    browser,
  }) => {
    const page = watch(await walletPage(browser, accounts.issuer, { width }));
    await nav(page, "/issuer/create");
    await connect(page);
    await expect(page.getByLabel("Compliance mode")).toBeVisible();
    await shoot(page, "issuer-create-fund-regulated", width);
    await nav(page, "/issuer/0/offering");
    await expect(
      page.getByRole("heading", { name: "Create a subscription offering" }),
    ).toBeVisible();
    await shoot(page, "issuer-offering-with-subscriptions", width);
    await nav(page, "/issuer/0/registry");
    await expect(page.getByText("Regulated fund")).toBeVisible();
    await page.context().close();
  });
}

test("issuer creates a subscription offering end to end", async ({
  browser,
}) => {
  const page = watch(await walletPage(browser, accounts.issuer));
  await nav(page, "/issuer/0/offering");
  await connect(page);
  await page
    .getByRole("button", { name: "Create subscription offering" })
    .click();
  await expect(
    page.getByText("Create subscription offering: Confirmed"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Fund and manage the offering" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Manage offering" }),
  ).toBeVisible();
  await shoot(page, "issuer-subscription-offering", 1440);
  await page.context().close();
});

test("no console errors or warnings", async () => {
  expect(errors).toEqual([]);
});

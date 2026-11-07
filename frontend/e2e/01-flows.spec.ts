// End-to-end flows on a seeded local chain (scripts/seedLocal.ts): CPT has 5,000
// units on sale; investor1 and investor2 are verified; `unapproved` is not.
import { expect, test, type Page } from "@playwright/test";
import { accounts, connect, nav, walletPage } from "./wallet";

const PAUSED = "This asset is paused by its issuer. No tokens can move until it is unpaused.";
test.describe.configure({ mode: "serial" });

const confirmed = (page: Page, label: string) =>
  expect(page.getByText(`${label}: Confirmed`)).toBeVisible();
const errors: string[] = [];
const watch = (page: Page) => {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return page;
};

let issuer: Page, investor: Page;
test.beforeAll(async ({ browser }) => {
  issuer = watch(await walletPage(browser, accounts.issuer));
  investor = watch(await walletPage(browser, accounts.investor1));
});

test("1. connect wallet shows address, role and network", async () => {
  await nav(investor, "/funds/0");
  await connect(investor);
  await expect(investor.getByText("0x3C44…93BC").first()).toBeVisible();
  await expect(investor.locator(".pill", { hasText: /^Investor · CPT$/ })).toBeVisible();
  await expect(investor.getByText("Local Ethereum").first()).toBeVisible();
});

test("2. issuer verifies an investor", async () => {
  await nav(issuer, "/issuer/0/registry");
  await connect(issuer);
  await issuer.getByLabel("Investor address").fill(accounts.unapproved);
  await expect(issuer.getByText("Not verified for CPT")).toBeVisible();
  await issuer.getByRole("button", { name: "Verify investor" }).click();
  await confirmed(issuer, "Verify investor");
  await expect(issuer.getByText("Verified investor in CPT")).toBeVisible();
});

test("3. investor subscribes (DvP: ETH paid and units delivered in one transaction)", async () => {
  await nav(investor, "/funds/0/subscribe");
  await investor.getByLabel("Units to subscribe").fill("100");
  await expect(investor.getByText("You will pay 0.1000 ETH and receive 100 CPT.")).toBeVisible();
  await investor.getByRole("button", { name: "Subscribe" }).click();
  await confirmed(investor, "Subscription");
  await expect(investor.getByText(/Confirmed in block \d+/)).toBeVisible();
  await nav(investor, "/portfolio");
  await expect(
    investor.getByRole("table", { name: "Positions" }).getByText("100 CPT"),
  ).toBeVisible();
});

test("4. investor transfers to another verified investor", async () => {
  await nav(investor, "/funds/0/transfer");
  await investor.getByLabel("Recipient address").fill(accounts.investor2);
  await expect(investor.getByText("Recipient is a verified investor in CPT.")).toBeVisible();
  await investor.getByLabel("Units to send").fill("20");
  await investor.getByRole("button", { name: "Transfer" }).click();
  await confirmed(investor, "Transfer");
});

test("5. transfer to an unverified address is blocked with the reason", async () => {
  await nav(investor, "/funds/0/transfer");
  await investor.getByLabel("Recipient address").fill(accounts.outsider);
  await investor.getByLabel("Units to send").fill("1");
  await expect(
    investor.getByText("Recipient is not a verified investor in CPT. A transfer to it would be rejected."),
  ).toBeVisible();
  const button = investor.getByRole("button", { name: "Transfer" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription(/Recipient is not a verified investor in CPT/);
});

test("6. issuer revokes (freezes) an investor's eligibility", async () => {
  await nav(issuer, "/issuer/0/registry");
  await issuer.getByLabel("Investor address").fill(accounts.investor2);
  await expect(issuer.getByText("Verified investor in CPT")).toBeVisible();
  await issuer.getByRole("button", { name: "Revoke eligibility", exact: true }).click();
  await expect(issuer.getByRole("dialog")).toContainText("even if it already holds tokens");
  await issuer.getByRole("dialog").getByRole("button", { name: "Revoke eligibility" }).click();
  await confirmed(issuer, "Revoke eligibility");
});

test("7. a revoked (frozen) holder cannot transfer", async ({ browser }) => {
  const holder = watch(await walletPage(browser, accounts.investor2));
  await nav(holder, "/funds/0/transfer");
  await connect(holder);
  await holder.getByLabel("Recipient address").fill(accounts.investor1);
  await holder.getByLabel("Units to send").fill("1");
  const button = holder.getByRole("button", { name: "Transfer" });
  await expect(button).toHaveAccessibleDescription(/eligibility for this fund has been revoked/);
  await expect(button).toBeDisabled();
  await holder.context().close();
});

test("7b. issuer force-transfers the revoked holding to a verified investor", async () => {
  await nav(issuer, `/issuer/0/controls?from=${accounts.investor2}`);
  await issuer.getByLabel("To (verified recipient)").fill(accounts.investor1);
  await issuer.getByRole("button", { name: /^Max/ }).click();
  await expect(issuer.getByLabel("Units to move")).toHaveValue("20");
  await issuer.getByRole("button", { name: "Force transfer" }).click();
  await issuer.getByRole("dialog").getByRole("button", { name: "Force transfer" }).click();
  await confirmed(issuer, "Forced transfer");
});

test("8. pause blocks transfers and subscriptions, unpause restores them", async () => {
  await nav(issuer, "/issuer/0/controls");
  await issuer.getByRole("button", { name: "Pause transfers" }).click();
  await issuer.getByRole("dialog").getByRole("button", { name: "Pause" }).click();
  await confirmed(issuer, "Pause");
  await nav(investor, "/funds/0/transfer");
  // Verified in test 2 (investor2 was revoked in test 6).
  await investor.getByLabel("Recipient address").fill(accounts.unapproved);
  await investor.getByLabel("Units to send").fill("1");
  await expect(investor.getByRole("button", { name: "Transfer" })).toHaveAccessibleDescription(PAUSED);
  await nav(investor, "/funds/0/subscribe");
  await investor.getByLabel("Units to subscribe").fill("1");
  await expect(investor.getByRole("button", { name: "Subscribe" })).toHaveAccessibleDescription(PAUSED);
  await nav(issuer, "/issuer/0/controls");
  await issuer.getByRole("button", { name: "Unpause transfers" }).click();
  await issuer.getByRole("dialog").getByRole("button", { name: "Unpause" }).click();
  await confirmed(issuer, "Unpause");
});

test("9. activity log labels every operation from real logs", async () => {
  await nav(investor, "/activity?fund=0");
  const table = investor.getByRole("table", { name: "Event log" });
  for (const type of ["Purchase", "Transfer", "Forced transfer", "Paused", "Unpaused", "Eligibility revoked"])
    await expect(table.getByText(type, { exact: true }).first()).toBeVisible();
});

test("10. issuer funds more inventory with approve, then deposit", async () => {
  await nav(issuer, "/issuer/0/offering");
  await issuer.getByLabel("Deposit quantity").fill("100");
  await issuer.getByRole("button", { name: "1. Approve" }).click();
  await confirmed(issuer, "Approve sale contract");
  await expect(issuer.getByText(/Current allowance: 100 CPT/)).toBeVisible();
  await expect(issuer.getByLabel("Deposit quantity")).toHaveValue("100");
  await issuer.getByRole("button", { name: "2. Deposit" }).click();
  await confirmed(issuer, "Inventory deposit");
});

test("no console errors or warnings", async () => {
  expect(errors).toEqual([]);
});

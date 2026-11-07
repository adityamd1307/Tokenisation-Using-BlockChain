// Screenshots of every page at 1440 and 390 px in the states the brief lists.
// Saved to docs/frontend-screenshots/<state>-<page>-<width>.png.
import { test, type Page } from "@playwright/test";
import { accounts, connect, nav, noWalletPage, walletPage } from "./wallet";

const out = "../docs/frontend-screenshots";
const widths = [1440, 390];
const investorPages: [string, string][] = [
  ["fund-registry", "/"],
  ["fund-overview", "/funds/0"],
  ["subscribe", "/funds/0/subscribe"],
  ["transfer", "/funds/0/transfer"],
  ["holdings", "/portfolio"],
  ["activity", "/activity"],
];
const issuerPages: [string, string][] = [
  ...investorPages,
  ["investor-registry", "/issuer/0/registry"],
  ["offering", "/issuer/0/offering"],
  ["token-controls", "/issuer/0/controls"],
  ["create-fund", "/issuer/create"],
];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Client-side navigation renders before its reads start; let them begin.
  await page.waitForTimeout(1000);
  await page
    .waitForFunction(() => !document.querySelector(".skeleton"), null, {
      timeout: 20_000,
    })
    .catch(() => undefined);
}
async function shoot(page: Page, name: string, width: number) {
  await settle(page);
  await page.screenshot({
    path: `${out}/${name}-${width}.png`,
    fullPage: true,
  });
}

for (const width of widths) {
  test(`connected investor at ${width}px`, async ({ browser }) => {
    const page = await walletPage(browser, accounts.investor1, { width });
    await nav(page, "/");
    await connect(page);
    for (const [name, path] of investorPages) {
      await nav(page, path);
      if (name === "subscribe")
        await page.getByLabel("Units to subscribe").fill("250");
      if (name === "transfer") {
        await page.getByLabel("Recipient address").fill(accounts.outsider);
        await page.getByLabel("Units to send").fill("10");
      }
      await shoot(page, `investor-${name}`, width);
    }
    if (width === 390) {
      await nav(page, "/");
      await settle(page);
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.screenshot({
        path: `${out}/investor-navigation-open-390.png`,
      });
    }
    await page.context().close();
  });

  test(`connected issuer at ${width}px`, async ({ browser }) => {
    const page = await walletPage(browser, accounts.issuer, { width });
    await nav(page, "/");
    await connect(page);
    for (const [name, path] of issuerPages) {
      await nav(page, path);
      if (name === "offering")
        await page.getByLabel("Deposit quantity").fill("500");
      await shoot(page, `issuer-${name}`, width);
    }
    await page.context().close();
  });

  test(`administrator at ${width}px`, async ({ browser }) => {
    const page = await walletPage(browser, accounts.admin, { width });
    await nav(page, "/admin");
    await connect(page);
    await shoot(page, "admin-issuer-authorisations", width);
    await page.context().close();
  });

  test(`not connected at ${width}px`, async ({ browser }) => {
    const page = await noWalletPage(browser, width);
    for (const [name, path] of [
      ["fund-registry", "/"],
      ["fund-overview", "/funds/0"],
      ["holdings", "/portfolio"],
    ]) {
      await nav(page, path);
      await shoot(page, `not-connected-${name}`, width);
    }
    await page.getByRole("button", { name: "Connect wallet" }).first().click();
    await shoot(page, "not-connected-no-wallet-error", width);
    await page.context().close();
  });

  test(`wrong network at ${width}px`, async ({ browser }) => {
    const page = await walletPage(browser, accounts.investor1, {
      chain: "0x1",
      width,
    });
    await nav(page, "/funds/0/subscribe");
    await page.getByRole("button", { name: "Connect wallet" }).first().click();
    await page.getByText(/Your wallet is on chain 1\./).waitFor();
    await shoot(page, "wrong-network-subscribe", width);
    await page.context().close();
  });
}

import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, setup } from "./helpers";

test.beforeEach(async ({ page }, testInfo) => setup(page, testInfo));

test("deployed: homepage 200, REPLAY badge, plan yields validation", async ({
  page,
}) => {
  const assertClean = expectNoConsoleErrors(page);

  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/REPLAY ·/).first()).toBeVisible();

  await page.getByLabel("Scenario").selectOption("north-roof");
  await page
    .getByRole("button", { name: "Inspect the north roof, stay below 40 m" })
    .click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await expect(page.getByText(/✗ GEOFENCE/)).toBeVisible();
  assertClean();
});

import { expect, test } from "@playwright/test";
import { expectNoConsoleErrors, setup } from "./helpers";

test.beforeEach(async ({ page }, testInfo) => setup(page, testInfo));

test("full demo: plan, repair, approve, replay, report, frame seek", async ({
  page,
}) => {
  const assertClean = expectNoConsoleErrors(page);
  await page.goto("/");

  const live = process.env.E2E_EXPECT_LIVE === "1";
  await expect(
    page.getByText(live ? /LIVE/ : /REPLAY ·/).first(),
  ).toBeVisible();

  await page.getByLabel("Scenario").selectOption("north-roof");
  await page
    .getByRole("button", { name: "Inspect the north roof, stay below 40 m" })
    .click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await expect(page.getByText(/✗ GEOFENCE/)).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve" });
  await expect(approve).toBeDisabled();

  await page.getByRole("button", { name: /^Repair/ }).click();
  await expect(
    page.getByRole("cell", { name: "wp7", exact: true }),
  ).toBeVisible();
  await expect(page.locator("li", { hasText: /^✗/ })).toHaveCount(0);
  await expect(approve).toBeEnabled();
  await approve.click();

  const player = page.getByRole("region", { name: "Replay player" });
  await expect(player.getByRole("status")).toContainText(
    /RECORDED SITL|SYNTHETIC/,
  );
  await player.getByRole("button", { name: "4×" }).click();
  const slider = player.getByRole("slider");
  const before = await slider.inputValue();
  const toggle = player.getByRole("button", { name: /^(Play|Pause)$/ });
  if ((await toggle.textContent()) === "Play") await toggle.click();
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(Number(before));

  const report = page.getByRole("region", { name: "Mission report" });
  await expect(report.getByText(/[1-9]\d* observed/)).toBeVisible();
  await expect(report.getByText(/HVAC 3/)).toBeVisible();

  const chip = report.getByRole("button", { name: /^\d{6} ·/ }).first();
  const id = (await chip.textContent())?.slice(0, 6) ?? "";
  await chip.click();
  await expect(player.getByText(`Frame ${id}`)).toBeVisible();
  assertClean();
});

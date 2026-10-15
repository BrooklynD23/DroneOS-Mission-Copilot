import { expect, test } from "@playwright/test";

test("home page shows the app heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "DroneOS Mission Copilot", level: 1 }),
  ).toBeVisible();
});

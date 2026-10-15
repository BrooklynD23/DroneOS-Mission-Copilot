import { expect, test } from "@playwright/test";

const regions = ["Plan", "Review", "Fly", "Report"] as const;

test.describe("page shell landmarks", () => {
  for (const name of regions) {
    test(`"${name}" region is reachable by role and name`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("region", { name })).toBeVisible();
    });
  }

  test("header shows product name, footer shows simulation disclaimer", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("banner").getByRole("heading", {
        name: "DroneOS Mission Copilot",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      "Simulation only. LLM drafts, validator checks, you approve.",
    );
  });

  test("Tab moves focus to an element with a visible outline", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", {
      name: "Skip to mission planner",
    });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).not.toHaveCSS("outline-style", "none");
  });
});

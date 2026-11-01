import { test, expect } from "@playwright/test";

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`signed-in profile next to Share at ${size.width}px; broken images fall back to initials`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const user = {
      issuer: "https://gravitas.example",
      sub: "stable-account",
      name: "Ada Lovelace",
      picture: "/auth/gravitas/picture",
    };
    await page.route("**/auth/gravitas/config", (route) =>
      route.fulfill({
        json: { enabled: true, defaultDomain: "gravitas.example" },
      }),
    );
    await page.route("**/auth/gravitas/session", (route) =>
      route.fulfill({ json: { user } }),
    );
    await page.route("**/auth/gravitas/picture", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.goto("/");
    const avatar = page.locator(".account-avatar");
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute("aria-label", "Ada Lovelace");
    await expect(avatar.locator("img")).toBeVisible();
    await expect(page.locator(".share-button + .account-avatar")).toBeVisible();
    await page.route("**/auth/gravitas/picture", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.reload();
    await expect(avatar).toHaveText("AL");
    user.picture = "";
    user.name = "";
    await page.reload();
    await expect(avatar).toHaveText("?");
    await expect(page.locator("body")).not.toContainText("Guest account");
  });
}

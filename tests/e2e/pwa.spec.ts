import { test, expect } from "@playwright/test";
import { newDocument, newBlock } from "./office-fixtures";

test.use({ hasTouch: true });

for (const [width, height] of [
  [320, 900],
  [393, 852],
  [540, 960],
  [768, 1024],
  [1024, 768],
  [1280, 400],
  [1920, 1080],
]) {
  test(`editor and app controls fit ${width} × ${height}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height });
    await newDocument(page, request, `Layout ${width} ${Date.now()}`);
    await newBlock(page, "Doc", "Responsive document");
    const editor = page.getByLabel("Document text", { exact: true });
    await editor.fill("A usable editor on every screen.");
    await expect(editor).toBeInViewport();
    const bounds = await editor.boundingBox();
    expect(bounds!.width).toBeGreaterThan(120);
    expect(bounds!.height).toBeGreaterThan(60);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/office-${width}x${height}.png`,
    });
    await page.getByLabel("App and offline settings").click();
    const keep = page.getByRole("button", { name: "Keep data on this device" });
    await keep.scrollIntoViewIfNeeded();
    await expect(keep).toBeInViewport();
    const panel = await page.locator(".pwa-panel").boundingBox();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(height);
  });
}

test("documents reopen, edit, and survive a second reload offline, then sync", async ({
  page,
  context,
  request,
}) => {
  const id = await newDocument(page, request, `Offline ${Date.now()}`);
  await newBlock(page, "Doc", "Offline draft");
  const editor = page.getByLabel("Document text", { exact: true });
  await editor.fill("Saved before disconnecting.");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(editor).toHaveText("Saved before disconnecting.");
  await editor.fill("Edited offline and kept after reload.");
  await page.reload();
  await expect(editor).toHaveText("Edited offline and kept after reload.");
  await context.setOffline(false);
  await expect(page.getByText("All changes saved")).toBeVisible({
    timeout: 20000,
  });
  const other = await context.browser()!.newContext();
  const verify = await other.newPage();
  await verify.goto(`http://127.0.0.1:4318/#document=${id}`);
  await expect(verify.getByLabel("Document text", { exact: true })).toHaveText(
    "Edited offline and kept after reload.",
  );
  await other.close();
});

test("federated sign-in restores only the saved account offline and rejects a revoked session", async ({
  page,
  context,
  request,
}) => {
  const config = "**/auth/gravitas/config",
    session = "**/auth/gravitas/session";
  await context.route(config, (route) =>
    route.fulfill({
      json: { enabled: true, defaultDomain: "example.test", autoSignIn: false },
    }),
  );
  await context.route(session, (route) =>
    route.fulfill({
      json: {
        user: {
          issuer: "https://example.test",
          sub: "offline-test",
          user_id: "offline@example.test",
          username: "offline",
        },
      },
    }),
  );
  await newDocument(page, request, `Federated offline ${Date.now()}`);
  await newBlock(page, "Doc", "Federated draft");
  const editor = page.getByLabel("Document text", { exact: true });
  await editor.fill("Private draft for the signed-in account.");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.unroute(config);
  await context.unroute(session);
  await context.setOffline(true);
  await page.reload();
  await expect(editor).toHaveText("Private draft for the signed-in account.");
  await editor.fill("Draft edited offline after authenticated restart.");
  await page.reload();
  await expect(editor).toHaveText(
    "Draft edited offline after authenticated restart.",
  );
  await context.route(config, (route) =>
    route.fulfill({
      json: { enabled: true, defaultDomain: "example.test", autoSignIn: false },
    }),
  );
  await context.route(session, (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A place to work together." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("office:offline-session")),
  ).toBeNull();
  await context.setOffline(true);
  await page.reload();
  await expect(editor).toHaveCount(0);
});

test("notification permission is requested only after the user opts in", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).permissionCalls = 0;
    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: async () => {
          (window as any).permissionCalls++;
          return "denied";
        },
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("App and offline settings").waitFor();
  expect(await page.evaluate(() => (window as any).permissionCalls)).toBe(0);
  await page.getByLabel("App and offline settings").click();
  await page
    .getByRole("button", { name: "Enable notifications", exact: true })
    .click();
  await expect(
    page.getByText("Notifications are off.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).permissionCalls)).toBe(1);
});

test("Web Push subscribes explicitly and delivers with no app page open, gated by account", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["notifications"]);
  let subscriptions = 0,
    removals = 0;
  await page.addInitScript(() => {
    let subscription: any = sessionStorage.getItem("push-fixture")
      ? makeSubscription()
      : null;
    function makeSubscription() {
      return {
        endpoint: "https://fcm.googleapis.com/browser-fixture",
        toJSON: () => ({
          endpoint: "https://fcm.googleapis.com/browser-fixture",
          keys: { auth: "fixture", p256dh: "fixture" },
        }),
        unsubscribe: async () => {
          subscription = null;
          sessionStorage.removeItem("push-fixture");
          return true;
        },
      };
    }
    const manager = {
      getSubscription: async () => subscription,
      subscribe: async () => {
        sessionStorage.setItem("push-fixture", "on");
        return (subscription = makeSubscription());
      },
    };
    Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
      get: () => manager,
    });
  });
  await context.route("**/api/push/key", (route) =>
    route.fulfill({ json: { owner: "alice", publicKey: "BAAA" } }),
  );
  await context.route("**/api/push/subscription", async (route) => {
    if (route.request().method() === "POST") subscriptions++;
    if (route.request().method() === "DELETE") removals++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  expect(subscriptions).toBe(0);
  await page.getByLabel("App and offline settings").click();
  await page
    .getByRole("button", { name: "Enable notifications", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Turn off notifications" }),
  ).toBeVisible();
  expect(subscriptions).toBeGreaterThanOrEqual(1);
  const worker = context.serviceWorkers()[0];
  // Chromium private contexts deny native worker notifications. Capture the
  // notification transport while exercising the real push event and account gate.
  await worker.evaluate(() => {
    (self as any).shownNotices = [];
    (self as any).registration.showNotification = async (
      title: string,
      options: NotificationOptions,
    ) => {
      (self as any).shownNotices.push({ title, ...options });
    };
  });
  const count = () => worker.evaluate(() => (self as any).shownNotices.length);
  await page.goto("about:blank"); // No app client remains; only the worker receives the push.
  const deliver = (account: string) =>
    worker.evaluate(async (account) => {
      // PushEvent dispatch exercises the installed worker without contacting a
      // real push provider or requiring push support in a private test context.
      let work = Promise.resolve();
      const event = new (self as any).PushEvent("push", {
        data: JSON.stringify({
          account,
          title: "Office collaborator updates",
          body: "Changes are ready.",
          url: "/",
          tag: "office-collaboration",
        }),
      });
      Object.defineProperty(event, "waitUntil", {
        value: (promise: Promise<void>) => {
          work = promise;
        },
      });
      self.dispatchEvent(event);
      await work;
    }, account);
  await deliver("another-account");
  expect(await count()).toBe(0);

  await deliver("alice");
  await expect.poll(count).toBe(1);
  await worker.evaluate(() => {
    (self as any).shownNotices = [];
  });
  await page.goto("/");
  await page.getByLabel("App and offline settings").click();
  await page.getByRole("button", { name: "Turn off notifications" }).click();
  await expect(
    page.getByRole("button", { name: "Enable notifications", exact: true }),
  ).toBeVisible();
  expect(removals).toBe(1);
  await page.goto("about:blank");
  await deliver("alice");
  expect(await count()).toBe(0);
});

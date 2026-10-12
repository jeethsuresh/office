import { partitionableSession } from "./network";
import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
const root = path.resolve(import.meta.dirname, "../..");
test("Electron launches its bundled Go/UI and quits its owned backend", async () => {
  test.skip(
    process.platform !== "darwin",
    "Native smoke test currently targets macOS",
  );
  const data = await mkdtemp(path.join(os.tmpdir(), "office-electron-"));
  const app = await electron.launch({
    executablePath:
      process.env.OFFICE_PACKAGED_PATH ??
      path.join(
        root,
        "apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      ),
    args: process.env.OFFICE_PACKAGED_PATH
      ? []
      : [path.join(root, "apps/desktop")],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "",
      OFFICE_DATA: data,
      OFFICE_PROFILE: path.join(data, "profile"),
    },
  });
  let url = "";
  try {
    const page = await app.firstWindow();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("Good things happen");
    url = page.url();
    const security = await app.evaluate(({ BrowserWindow }) => {
      const prefs = (
        BrowserWindow.getAllWindows()[0].webContents as unknown as {
          getLastWebPreferences: () => Record<string, boolean>;
        }
      ).getLastWebPreferences();
      return {
        sandbox: prefs.sandbox,
        nodeIntegration: prefs.nodeIntegration,
        contextIsolation: prefs.contextIsolation,
      };
    });
    expect(security).toEqual({
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    });
    expect(await page.evaluate(() => (window as any).office.desktop)).toBe(
      true,
    );
    await page
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    const browser = page.getByRole("region", {
      name: "Workspace browser",
      exact: true,
    });
    await browser
      .getByRole("button", { name: "Open folder: Studio", exact: true })
      .click();
    await browser
      .getByRole("button", { name: "Icon view", exact: true })
      .click();
    await expect(browser.locator(".browser-card")).toHaveCount(1);
    await browser
      .getByRole("button", {
        name: "Open document: A place for connected thoughts",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("Good things happen");
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.classList.contains("fullscreen-host"),
        ),
      )
      .toBe(true);
    await page.screenshot({ path: "test-results/electron-fullscreen.png" });
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    await expect(
      page.getByRole("button", { name: /Go to canvas block/ }),
    ).toBeVisible();
    // Entering element focus from an already-fullscreen native window must
    // also exit cleanly, without waiting for an event that will not occur.
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win.isFullScreen())
        await new Promise<void>((resolve) => {
          win.once("enter-full-screen", () => resolve());
          win.setFullScreen(true);
        });
    });
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .click();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    // Keep the same native fullscreen host while the map changes the focused
    // editor; no additional macOS Space transition should happen.
    await page.evaluate(() => {
      (window as any).nativeEntry = new Promise<void>((resolve) => {
        const entered = () => {
          if (
            document.fullscreenElement?.classList.contains("fullscreen-host")
          ) {
            document.removeEventListener("fullscreenchange", entered);
            resolve();
          }
        };
        document.addEventListener("fullscreenchange", entered);
      });
    });
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await page.evaluate(() => (window as any).nativeEntry);
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.classList.contains("fullscreen-host"),
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      (window as any).nativeHost = document.fullscreenElement;
      (window as any).nativeChanges = 0;
      document.addEventListener(
        "fullscreenchange",
        () => (window as any).nativeChanges++,
      );
    });
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    const map = page.getByRole("complementary", {
      name: "Fullscreen document minimap",
      exact: true,
    });
    await map.getByRole("button", { name: /Go to canvas block/ }).click();
    await expect(
      page.locator(".canvas-editor.editor-fullscreen"),
    ).toBeVisible();
    await page.locator(".fullscreen-navigator").hover();
    await map.getByRole("button", { name: /Go to slides block/ }).click();
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    await page.locator(".fullscreen-navigator").hover();
    await map
      .getByRole("button", { name: "Map: slide 2", exact: true })
      .click();
    await expect(page.locator(".slide-card").nth(1)).toHaveClass(/current/);
    await expect(
      map.getByRole("button", { name: "Map: slide 2", exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.fullscreenElement === (window as any).nativeHost,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => (window as any).nativeChanges)).toBe(0);
    await page.screenshot({ path: "test-results/electron-fullscreen-map.png" });
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .click();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    await page.screenshot({ path: "test-results/electron.png" });
  } finally {
    await app.close();
    await expect
      .poll(async () => {
        try {
          await fetch(new URL("/api/health", url));
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
    await rm(data, { recursive: true, force: true });
  }
});
async function startServer(data: string, port: number) {
  const proc = spawn(
    path.join(root, "apps/desktop/resources/bin/office-server"),
    [
      "-listen",
      `127.0.0.1:${port}`,
      "-data",
      data,
      "-web",
      path.join(root, "apps/web/dist"),
    ],
  );
  const url = await new Promise<string>((resolve, reject) => {
    const lines = createInterface({ input: proc.stdout });
    lines.on("line", (line) => {
      const info = JSON.parse(line);
      if (info.event === "ready") {
        lines.close();
        resolve(info.url);
      }
    });
    proc.once("error", reject);
    proc.once("exit", (code) => reject(new Error(`Server exited: ${code}`)));
  });
  return { proc, url };
}
async function stop(proc: ChildProcess) {
  const exited = once(proc, "exit");
  proc.kill("SIGTERM");
  await exited;
}
test("rich text, canvas, and slide content survive a Go server restart", async ({
  browser,
}) => {
  const data = await mkdtemp(path.join(os.tmpdir(), "office-restart-"));
  let server = await startServer(data, 4319);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(server.url);
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page
      .getByLabel("Document text", { exact: true })
      .press("ControlOrMeta+End");
    await page
      .getByLabel("Document text", { exact: true })
      .pressSequentially("Persisted across a restart.");
    await page.getByRole("button", { name: /Go to canvas block/ }).click();
    await page
      .locator(".block-canvas input.block-title")
      .fill("Durable drawing");
    await page.getByRole("button", { name: /Go to slides block/ }).click();
    await page
      .getByLabel("Slide title", { exact: true })
      .first()
      .fill("A durable story");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await stop(server.proc);
    server = await startServer(data, 4319);
    await page.reload();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("Persisted across a restart.");
    await expect(page.locator(".block-canvas input.block-title")).toHaveValue(
      "Durable drawing",
    );
    await expect(
      page.getByLabel("Slide title", { exact: true }).first(),
    ).toHaveValue("A durable story");
    expect(await page.locator(".block-canvas [data-shape-id]").count()).toBe(6);
  } finally {
    await context.close();
    await stop(server.proc);
    await rm(data, { recursive: true, force: true });
  }
});

test("Electron retains unsent offline content and its origin across relaunches", async () => {
  test.skip(
    process.platform !== "darwin",
    "Native smoke test currently targets macOS",
  );
  const data = await mkdtemp(path.join(os.tmpdir(), "office-offline-"));
  const launch = () =>
    electron.launch({
      executablePath:
        process.env.OFFICE_PACKAGED_PATH ??
        path.join(
          root,
          "apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
        ),
      args: process.env.OFFICE_PACKAGED_PATH
        ? []
        : [path.join(root, "apps/desktop")],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "",
        OFFICE_DATA: data,
        OFFICE_PROFILE: path.join(data, "profile"),
      },
    });
  let app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByText("All changes saved")).toBeVisible();
    const origin = new URL(page.url()).origin;
    const network = await partitionableSession(page);
    await page.reload();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await network.pause();
    const journalSize = (await stat(path.join(data, "journals/welcome.ylog")))
      .size;
    await expect(page.getByText("Saved on this device")).toBeVisible();
    const note = page.getByLabel("Document text", { exact: true });
    await note.press("ControlOrMeta+End");
    await note.pressSequentially("Unsent offline thought.");
    // Wait for a read transaction behind the pending IndexedDB writes before quitting.
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .filter((db) => db.name?.startsWith("office:"))
          .map(
            (db) =>
              new Promise<void>((resolve, reject) => {
                const request = indexedDB.open(db.name!);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                  const store = request.result.transaction(
                    "updates",
                    "readonly",
                  );
                  store.objectStore("updates").getAll();
                  store.oncomplete = () => {
                    request.result.close();
                    resolve();
                  };
                };
              }),
          ),
      );
    });
    expect((await stat(path.join(data, "journals/welcome.ylog"))).size).toBe(
      journalSize,
    );
    await app.close();
    app = await launch();
    const restored = await app.firstWindow();
    expect(new URL(restored.url()).origin).toBe(origin);
    await expect(restored.getByText("All changes saved")).toBeVisible();
    await expect(
      restored.getByLabel("Document text", { exact: true }),
    ).toContainText("Unsent offline thought.");
  } finally {
    await app.close();
    await rm(data, { recursive: true, force: true });
  }
});

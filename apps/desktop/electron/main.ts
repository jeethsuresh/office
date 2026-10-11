import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
let backend: ChildProcess | null = null;
let window: BrowserWindow | null = null;
let backendURL = "";
let quitting = false;
app.setName("Office");
if (process.env.OFFICE_PROFILE) {
  mkdirSync(process.env.OFFICE_PROFILE, { recursive: true });
  app.setPath("userData", process.env.OFFICE_PROFILE);
}
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  window?.show();
  window?.focus();
});
async function startBackend(): Promise<string> {
  const data =
    process.env.OFFICE_DATA ?? path.join(app.getPath("userData"), "workspace");
  const portFile = path.join(data, "desktop-port");
  let port = 0;
  if (!process.env.OFFICE_DEV_URL) {
    try {
      const stored = Number(await readFile(portFile, "utf8"));
      if (Number.isInteger(stored) && stored >= 1024 && stored <= 65535)
        port = stored;
    } catch {}
  }
  const resources = app.isPackaged
    ? process.resourcesPath
    : path.join(here, "../resources");
  const bin = path.join(
    resources,
    "bin",
    process.platform === "win32" ? "office-server.exe" : "office-server",
  );
  const args = [
    "-listen",
    process.env.OFFICE_DEV_URL ? "127.0.0.1:4317" : `127.0.0.1:${port}`,
    "-data",
    data,
    "-web",
    path.join(resources, "web"),
  ];
  if (process.env.OFFICE_DEV_URL)
    args.push("-allow-origin", process.env.OFFICE_DEV_URL);
  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  backend = proc;
  proc.stderr?.on("data", (data) =>
    console.error("[office-server]", data.toString()),
  );
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Office backend did not become ready"));
      proc.kill();
    }, 15000);
    const lines = createInterface({ input: proc.stdout! });
    lines.on("line", async (line) => {
      try {
        const message = JSON.parse(line);
        if (message.event === "ready") {
          clearTimeout(timeout);
          lines.close();
          // IndexedDB is origin-scoped: keep the loopback origin stable across launches.
          if (!process.env.OFFICE_DEV_URL) {
            await mkdir(data, { recursive: true });
            await writeFile(portFile, new URL(message.url).port, {
              mode: 0o600,
            });
          }
          resolve(message.url);
        }
      } catch (error) {
        reject(error);
      }
    });
    proc.once("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    proc.once("exit", (code) => {
      clearTimeout(timeout);
      if (!quitting) {
        reject(new Error(`Office backend exited (${code})`));
        if (window) {
          void dialog.showMessageBox(window, {
            type: "error",
            message: "The Office server stopped.",
            detail: "Restart Office to reconnect to your saved workspace.",
          });
        }
      }
    });
  });
}
async function createWindow() {
  if (!backendURL) backendURL = await startBackend();
  const origin = process.env.OFFICE_DEV_URL ?? backendURL;
  window = new BrowserWindow({
    title: "Office",
    width: 1440,
    height: 950,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#f5f4f0",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.on("closed", () => (window = null));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== new URL(origin).origin) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  await window.loadURL(origin);
}
app.whenReady().then(async () => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Office",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
      },
    ]),
  );
  try {
    await createWindow();
  } catch (e) {
    dialog.showErrorBox("Office could not start", String(e));
    app.quit();
  }
});
app.on("activate", () => {
  if (!window) void createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  quitting = true;
  const proc = backend;
  if (proc) {
    proc.kill("SIGTERM");
    const force = setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 2000);
    force.unref();
  }
  backend = null;
});

import { mkdirSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
const children: Bun.Subprocess[] = [];
let stopping = false;
function spawn(
  cmd: string[],
  cwd = root,
  env: Record<string, string | undefined> = {},
) {
  const child = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  children.push(child);
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
async function waitFor(url: string) {
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
try {
  const build = spawn(["bun", "scripts/build.ts", "backend"]);
  if ((await build.exited) !== 0) throw new Error("Backend build failed");
  const web = spawn(["bun", "run", "dev"], path.join(root, "apps/web"));
  await waitFor("http://127.0.0.1:5174");
  if (process.argv[2] === "web") {
    const backend = spawn([
      path.join(
        root,
        "apps/desktop/resources/bin",
        process.platform === "win32" ? "office-server.exe" : "office-server",
      ),
      "-listen",
      "127.0.0.1:4317",
      "-data",
      process.env.OFFICE_DATA ?? path.join(root, ".office-data"),
      "-allow-origin",
      "http://127.0.0.1:5174",
    ]);
    await waitFor("http://127.0.0.1:4317/api/health");
    console.log("Office web → http://127.0.0.1:5174");
    stop(await Promise.race([web.exited, backend.exited]));
  } else {
    mkdirSync(path.join(root, "apps/desktop/dist-electron"), {
      recursive: true,
    });
    const main = spawn(
      [
        "bun",
        "build",
        "./electron/main.ts",
        "--outdir",
        "dist-electron",
        "--target",
        "node",
        "--format",
        "esm",
        "--external",
        "electron",
      ],
      path.join(root, "apps/desktop"),
    );
    if ((await main.exited) !== 0) throw new Error("Electron build failed");
    const preload = spawn(
      [
        "bun",
        "build",
        "./electron/preload.ts",
        "--outfile",
        "dist-electron/preload.cjs",
        "--target",
        "node",
        "--format",
        "cjs",
        "--external",
        "electron",
      ],
      path.join(root, "apps/desktop"),
    );
    if ((await preload.exited) !== 0) throw new Error("Preload build failed");
    const electron = spawn(
      [
        "bun",
        path.join(root, "apps/desktop/node_modules/electron/cli.js"),
        path.join(root, "apps/desktop"),
      ],
      root,
      { OFFICE_DEV_URL: "http://127.0.0.1:5174", ELECTRON_RUN_AS_NODE: "" },
    );
    stop(await Promise.race([web.exited, electron.exited]));
  }
} catch (e) {
  console.error(e);
  stop(1);
}

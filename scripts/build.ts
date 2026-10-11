import { mkdirSync, cpSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
async function run(cmd: string[], cwd = root) {
  const child = Bun.spawn(cmd, {
    cwd,
    env: {
      ...process.env,
      GOCACHE: process.env.GOCACHE ?? path.join(root, ".cache/go-build"),
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await child.exited) !== 0)
    throw new Error(`Build failed: ${cmd.join(" ")}`);
}
const binary =
  process.platform === "win32" ? "office-server.exe" : "office-server";
mkdirSync(path.join(root, "apps/desktop/resources/bin"), { recursive: true });
await run(
  [
    "go",
    "build",
    "-trimpath",
    "-o",
    path.join(root, "apps/desktop/resources/bin", binary),
    "./cmd/server",
  ],
  path.join(root, "backend"),
);
if (process.argv[2] !== "backend") {
  await run(["bun", "run", "build"], path.join(root, "apps/web"));
  mkdirSync(path.join(root, "apps/desktop/resources/web"), { recursive: true });
  cpSync(
    path.join(root, "apps/web/dist"),
    path.join(root, "apps/desktop/resources/web"),
    { recursive: true },
  );
  await run(
    [
      "bun",
      "build",
      "./electron/main.ts",
      "--outdir",
      "./dist-electron",
      "--target",
      "node",
      "--format",
      "esm",
      "--external",
      "electron",
    ],
    path.join(root, "apps/desktop"),
  );
  await run(
    [
      "bun",
      "build",
      "./electron/preload.ts",
      "--outfile",
      "./dist-electron/preload.cjs",
      "--target",
      "node",
      "--format",
      "cjs",
      "--external",
      "electron",
    ],
    path.join(root, "apps/desktop"),
  );
}

import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
const proc = Bun.spawn(
  [
    "bun",
    path.join(root, "apps/desktop/node_modules/electron/cli.js"),
    path.join(root, "apps/desktop"),
  ],
  {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());
process.exit(await proc.exited);

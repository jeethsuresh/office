import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
const bin = path.join(
  root,
  "apps/desktop/resources/bin",
  process.platform === "win32" ? "office-server.exe" : "office-server",
);
const proc = Bun.spawn(
  [
    bin,
    "-listen",
    process.env.OFFICE_LISTEN ?? "127.0.0.1:4317",
    "-data",
    process.env.OFFICE_DATA ?? path.join(root, ".office-data"),
    "-web",
    path.join(root, "apps/web/dist"),
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());
process.exit(await proc.exited);

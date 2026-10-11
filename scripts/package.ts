import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
for (const [cmd, cwd] of [
  [["bun", "run", "build"], root],
  [
    ["bun", "run", process.argv.includes("--dir") ? "package:dir" : "package"],
    path.join(root, "apps/desktop"),
  ],
] as [string[], string][]) {
  const child = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) process.exit(1);
}

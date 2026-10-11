import path from "node:path";
const root = path.resolve(import.meta.dir, "..");
const child = Bun.spawn(
  [
    "go",
    "test",
    ...(process.argv.includes("--race") ? ["-race"] : []),
    "./...",
  ],
  {
    cwd: path.join(root, "backend"),
    env: {
      ...process.env,
      GOCACHE: process.env.GOCACHE ?? path.join(root, ".cache/go-build"),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.exit(await child.exited);

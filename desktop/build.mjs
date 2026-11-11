import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", env: { ...process.env, SELLORA_DESKTOP_BUILD: "1" } });
  if (result.status !== 0) throw new Error(`Build falhou: ${file}`);
};
run("node_modules/next/dist/bin/next", ["build"]);
const target = path.resolve(".desktop-web");
await mkdir(target, { recursive: true });
await cp(".next/standalone", target, { recursive: true });
await cp(".next/static", path.join(target, ".next/static"), { recursive: true });
await cp("public", path.join(target, "public"), { recursive: true });
async function removeEnv(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await removeEnv(file);
    else if (item.name === ".env" || item.name.startsWith(".env.")) await unlink(file);
  }
}
await removeEnv(target);
run("node_modules/electron-builder/cli.js", ["--config", "desktop/builder.json", "--win", "portable", "--x64", "--publish", "never"]);

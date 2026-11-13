import { createHash } from "node:crypto";
import { readFile, writeFile, open, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { displayVersion, nextVersion, packageVersion, releaseIsCurrent } from "../src/lib/release-version.ts";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const paths = ["version.json", "package.json", "package-lock.json", "CHANGELOG.md"];
const excluded = new Set(["version.json", "CHANGELOG.md"]);

export async function sourceFingerprint() {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Não foi possível listar os arquivos para identificar a atualização.");
  const hash = createHash("sha256");
  for (const name of [...new Set(result.stdout.split("\0").filter(Boolean))].sort()) {
    if (excluded.has(name)) continue;
    let data = await readFile(name);
    if (["package.json", "package-lock.json"].includes(name)) {
      const json = JSON.parse(data);
      delete json.version;
      if (json.packages?.[""]) delete json.packages[""].version;
      data = Buffer.from(JSON.stringify(json));
    }
    hash.update(name).update(data);
  }
  return hash.digest("hex");
}

function run(file, args) {
  const result = spawnSync(file, args, { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`Validação falhou: ${file} ${args.join(" ")}`);
}
const npm = (script) => run(process.execPath, [process.env.npm_execpath, "run", script]);

async function release() {
  const idIndex = process.argv.indexOf("--id");
  const id = process.argv[idIndex + 1];
  if (idIndex < 0 || !id || id.startsWith("--")) throw new Error("Informe um identificador estável da atualização com --id.");
  const lockPath = path.join(root, ".sellora-release.lock");
  const lock = await open(lockPath, "wx");
  let backup;
  try {
    backup = new Map(await Promise.all(paths.map(async (name) => [name, await readFile(name, "utf8")])));
    const previous = JSON.parse(backup.get("version.json"));
    npm("version:check");
    npm("test:version");
    const fingerprint = await sourceFingerprint();
    if (releaseIsCurrent(previous, fingerprint)) {
      console.log(`Sellora ${displayVersion(previous)} já corresponde aos arquivos validados. Nenhum incremento necessário.`);
      return;
    }
    const changelog = backup.get("CHANGELOG.md");
    if (!changelog.includes("## Próxima atualização")) throw new Error("Descreva esta atualização em CHANGELOG.md sob ## Próxima atualização.");
    npm("test");
    npm("lint");
    npm("typecheck");
    const candidate = nextVersion(previous);
    const version = displayVersion(candidate);
    await writeFile("version.json", JSON.stringify({ ...candidate, lastRelease: { id, fingerprint } }, null, 2) + "\n");
    for (const name of ["package.json", "package-lock.json"]) {
      const json = JSON.parse(backup.get(name));
      json.version = packageVersion(candidate);
      if (json.packages?.[""]) json.packages[""].version = json.version;
      await writeFile(name, JSON.stringify(json, null, 2) + "\n");
    }
    npm("desktop:build");
    npm("desktop:verify");
    if (await sourceFingerprint() !== fingerprint) throw new Error("Os arquivos mudaram durante a validação. Execute a atualização novamente.");
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    await writeFile("CHANGELOG.md", changelog.replace("## Próxima atualização", `## ${version} — ${date}`));
    run("powershell.exe", ["-NoProfile", "-File", path.join(root, "scripts/update-shortcut.ps1"), "-Version", version]);
    console.log(`Sellora ${displayVersion(previous)} → ${version}. Atualização validada e atalho atualizado.`);
  } catch (error) {
    if (backup) for (const [name, contents] of backup) await writeFile(name, contents);
    throw error;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, "scripts/release.mjs")) {
  release().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

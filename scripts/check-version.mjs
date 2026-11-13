import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { displayVersion, nextVersion, packageVersion, validateVersion } from "../src/lib/release-version.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");

export function validateVersionFiles({ version, manifest, lockfile, previousVersion, sources = [] }) {
  if (!version || typeof version !== "object") throw new Error("version.json deve conter major e minor inteiros.");
  if (Object.keys(version).some((key) => !["major", "minor", "lastRelease"].includes(key))) throw new Error("version.json aceita major, minor e os metadados lastRelease. Patch independente é inválido.");
  validateVersion(version);
  const expected = packageVersion(version);
  if (manifest?.version !== expected || lockfile?.version !== expected || lockfile?.packages?.[""]?.version !== expected) {
    throw new Error(`Metadados divergentes. package.json e os dois campos raiz de package-lock.json devem usar ${expected}, derivado de version.json.`);
  }
  if (previousVersion !== undefined) {
    validateVersion(previousVersion);
    const current = displayVersion(version);
    const previous = displayVersion(previousVersion);
    if (current !== previous && current !== displayVersion(nextVersion(previousVersion))) {
      throw new Error(`Sequência inválida: ${previous} → ${current}. O próximo valor permitido é ${displayVersion(nextVersion(previousVersion))}.`);
    }
  }
  for (const { name, contents } of sources) {
    if (/\bSellora\s+v?\d+\.\d+(?:\.\d+)?\b/.test(contents)) {
      throw new Error(`Versão fixa em ${name}. Use APP_LABEL/APP_VERSION ou derive de version.json no desktop.`);
    }
  }
  return displayVersion(version);
}

function previousVersionAt(root, ref) {
  if (!ref || /^0+$/.test(ref)) return undefined;
  if (ref.startsWith("-") || !/^[a-zA-Z0-9_./-]+$/.test(ref)) throw new Error("Referência base inválida.");
  const commit = spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], { cwd: root, encoding: "utf8" });
  if (commit.status !== 0) throw new Error("A referência base não está disponível. Busque o histórico antes da checagem.");
  const tree = spawnSync("git", ["ls-tree", "--name-only", ref, "--", "version.json"], { cwd: root, encoding: "utf8" });
  if (tree.status !== 0) throw new Error("Não foi possível consultar a versão base.");
  // A primeira adoção da convenção preserva a versão existente do projeto.
  if (!tree.stdout.trim()) return undefined;
  const result = spawnSync("git", ["show", `${ref}:version.json`], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("Não foi possível ler version.json na referência base.");
  return JSON.parse(result.stdout);
}

async function runtimeSources(root, directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await runtimeSources(root, name));
    else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      files.push({ name, contents: await readFile(path.join(root, name), "utf8") });
    }
  }
  return files;
}

export async function checkProjectVersions(root = projectRoot, baseRef) {
  const [version, manifest, lockfile] = await Promise.all(["version.json", "package.json", "package-lock.json"].map(async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"))));
  const sources = (await Promise.all(["src", "desktop"].map((directory) => runtimeSources(root, directory)))).flat();
  return validateVersionFiles({ version, manifest, lockfile, previousVersion: previousVersionAt(root, baseRef), sources });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseIndex = process.argv.indexOf("--base");
  const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.VERSION_BASE_REF;
  if (baseIndex >= 0 && !baseRef) { console.error("Informe a referência após --base."); process.exitCode = 1; }
  else checkProjectVersions(projectRoot, baseRef).then((version) => console.log(`Versionamento válido e sincronizado: Sellora ${version}.`)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

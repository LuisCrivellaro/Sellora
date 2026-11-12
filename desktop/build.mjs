import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
const projectRoot = path.resolve(import.meta.dirname, "..");
if (process.cwd() !== projectRoot) throw new Error("Execute o build desktop na pasta do projeto Sellora.");
const standalone = path.join(projectRoot, ".next", "standalone");
if (!standalone.startsWith(projectRoot + path.sep)) throw new Error("Destino de build fora do projeto.");
// O Next mantém arquivos de rastreamentos anteriores. A distribuição deve conter apenas o build atual.
await rm(standalone, { recursive: true, force: true });
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", env: { ...process.env, SELLORA_DESKTOP_BUILD: "1" } });
  if (result.status !== 0) throw new Error(`Build falhou: ${file}`);
};
run("node_modules/next/dist/bin/next", ["build"]);
const target = path.join(projectRoot, ".desktop-web");
// O estágio anterior pode conter cache de rotas que ainda referencia o código antigo.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
// dereference: o standalone do Next cria links simbólicos (ex.: sharp); no Windows criar link exige privilégio, então copiamos o conteúdo real.
await cp(".next/standalone", target, { recursive: true, dereference: true });
await cp(".next/static", path.join(target, ".next/static"), { recursive: true });
await cp("public", path.join(target, "public"), { recursive: true });
await cp(".agents/skills/unique-site-designer", path.join(target, ".agents/skills/unique-site-designer"), { recursive: true });
// Guia de criação lido pelo gerador V6 a cada demo (src/lib/demos/v6/prompts.ts).
await cp(".agents/skills/demo-generator-v6", path.join(target, ".agents/skills/demo-generator-v6"), { recursive: true });
const unexpected = (await readdir(target)).filter((name) => [".sellora-data", "test-results", "release", "src"].includes(name));
if (unexpected.length) throw new Error(`O rastreamento incluiu artefatos locais: ${unexpected.join(", ")}`);
async function removeEnv(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await removeEnv(file);
    else if (item.name === ".env" || item.name.startsWith(".env.")) await unlink(file);
  }
}
await removeEnv(target);
run("node_modules/electron-builder/cli.js", ["--config", "desktop/builder.json", "--win", "portable", "--x64", "--publish", "never"]);

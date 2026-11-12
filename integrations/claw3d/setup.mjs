#!/usr/bin/env node
// Prepara o Claw3D (MIT, iamlukethedev/Claw3D) para a aba Cloud 3D da Sellora.
//
// Clona o upstream no commit fixado, instala as dependências (npm ci), copia o
// adaptador de gateway da Sellora para `server/` e gera o build de produção.
// Não altera nenhum arquivo do Claw3D: o adaptador entra como arquivo novo.
//
// Uso: node integrations/claw3d/setup.mjs [--dir <destino>] [--source <git url ou caminho>] [--skip-build]
// Padrão: destino `.claw3d/app` na raiz da Sellora (ignorado pelo Git).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const pin = JSON.parse(readFileSync(path.join(here, "claw3d.lock.json"), "utf8"));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const target = path.resolve(option("--dir", path.join(root, ".claw3d", "app")));
const source = option("--source", pin.repository);
const skipBuild = args.includes("--skip-build");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, commandArgs, cwd) {
  console.log(`> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" && command === npm });
  if (result.status !== 0) throw new Error(`Falhou: ${command} ${commandArgs.join(" ")}`);
}
function git(commandArgs, cwd) {
  return spawnSync("git", commandArgs, { cwd, encoding: "utf8" });
}

if (!existsSync(path.join(target, ".git"))) {
  mkdirSync(path.dirname(target), { recursive: true });
  run("git", ["clone", "--no-checkout", source, target], root);
}
const current = git(["rev-parse", "HEAD"], target).stdout?.trim();
if (!current?.startsWith(pin.commit)) {
  const dirty = git(["status", "--porcelain", "--untracked-files=no"], target).stdout?.trim();
  if (dirty) throw new Error(`O Claw3D em ${target} tem alterações locais; resolva antes de trocar de commit.`);
  if (git(["cat-file", "-e", `${pin.commit}^{commit}`], target).status !== 0) run("git", ["fetch", "origin"], target);
  run("git", ["checkout", "--detach", pin.commit], target);
}
const license = readFileSync(path.join(target, "LICENSE"), "utf8");
if (!/MIT License/i.test(license)) throw new Error("Licença do Claw3D diferente da MIT registrada: revise antes de continuar.");

if (!existsSync(path.join(target, "node_modules", "next"))) run(npm, ["ci", "--no-audit", "--no-fund"], target);
copyFileSync(path.join(here, "sellora-gateway-adapter.cjs"), path.join(target, "server", "sellora-gateway-adapter.cjs"));
copyFileSync(path.join(here, "sellora-gateway-core.cjs"), path.join(target, "server", "sellora-gateway-core.cjs"));
if (!skipBuild && !existsSync(path.join(target, ".next", "BUILD_ID"))) run(npm, ["run", "build"], target);
console.log(`Claw3D pronto em ${target} (commit ${pin.commit}).`);

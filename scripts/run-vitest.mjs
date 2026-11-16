// No Windows, abrir o projeto como "c:\..." (padrão do VS Code) faz o Vite enxergar "c:" e "C:" como caminhos
// diferentes e carregar o Vitest duas vezes ("Vitest failed to find the current suite"). Este lançador
// executa o Vitest com a letra do drive em maiúscula; nos demais sistemas o diretório não muda.
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.platform === "win32" ? process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase()) : process.cwd();
const cli = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);

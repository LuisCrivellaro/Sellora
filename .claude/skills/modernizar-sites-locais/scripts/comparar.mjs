import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [directory, business] = process.argv.slice(2);
if (!directory || !business?.trim() || process.argv.length !== 4) {
  throw new Error('Uso: node comparar.mjs <pasta-de-capturas> "Nome do negócio"');
}

const output = resolve(directory);
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const title = business.trim().replace(/[&<>"']/g, character => entities[character]);
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

async function loadCapture(stage, device) {
  const filename = `${stage}-${device}.png`;
  const bytes = await readFile(join(output, filename));
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(pngSignature) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`PNG inválido: ${filename}`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    source: `data:image/png;base64,${bytes.toString('base64')}`,
  };
}

const sections = [];
for (const [device, label] of [['desktop', 'Computador'], ['celular', 'Celular']]) {
  const [before, after] = await Promise.all([
    loadCapture('antes', device),
    loadCapture('depois', device),
  ]);
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(`As capturas de ${label.toLowerCase()} precisam ter as mesmas dimensões.`);
  }
  sections.push(`
    <section class="${device}">
      <h2>${label}</h2>
      <div class="pair">
        <figure><figcaption>Antes</figcaption><img alt="Site atual em ${label.toLowerCase()}" src="${before.source}"></figure>
        <figure><figcaption>Depois</figcaption><img alt="Prévia em ${label.toLowerCase()}" src="${after.source}"></figure>
      </div>
    </section>`);
}

const destination = join(output, 'antes-e-depois.html');
await writeFile(destination, `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} | Antes e depois</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f4ef; color: #182521; font: 1rem system-ui, sans-serif; }
    main { max-width: 76rem; margin: auto; padding: clamp(1rem, 4vw, 3rem); }
    header { border-bottom: 2px solid #35463e; padding-bottom: 1.25rem; }
    h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.8rem, 5vw, 3rem); }
    header p { margin: .5rem 0 0; color: #35463e; }
    section { margin-top: 2rem; }
    h2 { font-size: 1.15rem; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(.5rem, 2vw, 1.25rem); }
    .celular .pair { max-width: 47rem; }
    figure { margin: 0; border: 1px solid #a8b3aa; background: white; border-radius: .5rem; overflow: hidden; }
    figcaption { padding: .6rem .8rem; font-weight: 650; background: #e5e9e2; }
    figure + figure figcaption { background: #d3e9db; }
    img { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
    <header><h1>${title}</h1><p>Comparativo do site atual e da prévia</p></header>
    ${sections.join('\n')}
  </main>
</body>
</html>
`, 'utf8');
console.log(destination);

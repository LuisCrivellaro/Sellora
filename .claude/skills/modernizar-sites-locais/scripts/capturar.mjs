import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const [before, after, directory] = process.argv.slice(2);
if (!before || !after || !directory || process.argv.length !== 5) {
  throw new Error('Uso: node capturar.mjs <url-atual> <url-da-previa> <pasta>');
}

const pages = [['antes', new URL(before)], ['depois', new URL(after)]];
for (const [, url] of pages) {
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use URLs HTTP ou HTTPS sem credenciais.');
  }
}

const require = createRequire(join(process.cwd(), 'package.json'));
let packagePath = process.env.PLAYWRIGHT_MODULE;
if (!packagePath) {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      packagePath = require.resolve(name);
      break;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
}
if (!packagePath) {
  throw new Error('Playwright indisponível. Informe PLAYWRIGHT_MODULE ou use outro navegador para gerar as imagens.');
}

const { chromium } = require(packagePath);
const output = resolve(directory);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'celular', width: 390, height: 844, mobile: true },
];
const results = [];

try {
  for (const [stage, url] of pages) {
    for (const { name, width, height, mobile } of viewports) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        acceptDownloads: false,
      });
      try {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error') errors.push(message.text());
        });
        const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) {
          throw new Error(`Falha em ${stage}-${name}: HTTP ${response?.status() ?? 'indisponível'}`);
        }
        const file = `${stage}-${name}.png`;
        await page.screenshot({ path: join(output, file), animations: 'disabled', timeout: 15_000 });
        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.visualViewport.width + 1,
        );
        results.push({ file, url: page.url(), width, height, horizontalOverflow, errors });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));

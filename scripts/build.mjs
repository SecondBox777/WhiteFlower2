import { questions } from '../questions.js';
import { mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { renderLanding } from '../seo.js';
import { languages } from '../i18n.js';

// Only public website assets belong in the deployment directory.
// Never copy the repository root: it can contain dependencies and secrets.
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const assets = ['naver366e597dfb634369d3031aa2cccfd6b3.html', 'google8e1ad6d7f4037882.html', 'seo.js', 'robots.txt', 'sitemap.xml', 'api-response.js', 'index.html', 'i18n.js', 'translations.js', 'report-locales.js', 'question-locales.js', 'favicon.svg', 'report-content.js', 'report-export.js', 'style.css', 'design-ui.css', 'app.js', 'share-copy.js', 'share-menu.js', 'questions.js', 'scoring.js', ...questions.map(q => q.image)];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let bytes = 0;
for (const asset of assets) {
  await copyFile(new URL(asset, root), new URL(asset, output));
  bytes += (await stat(new URL(asset, output))).size;
}
console.log(`Built ${assets.length} public assets in dist/ (${(bytes / 1024).toFixed(1)} KiB total).`);
await mkdir(new URL('_home/',output),{recursive:true});
const landing=await readFile(new URL('index.html',root),'utf8');
for(const code of Object.keys(languages)) await writeFile(new URL(`_home/${code}.html`,output),renderLanding(landing,code));

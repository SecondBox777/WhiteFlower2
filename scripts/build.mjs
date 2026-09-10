import { mkdir, copyFile, rm, stat } from 'node:fs/promises';

// Only public website assets belong in the deployment directory.
// Never copy the repository root: it can contain dependencies and secrets.
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const assets = ['index.html', 'style.css', 'app.js', 'questions.js', ...Array.from({ length: 10 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}.png`)];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let bytes = 0;
for (const asset of assets) {
  await copyFile(new URL(asset, root), new URL(asset, output));
  bytes += (await stat(new URL(asset, output))).size;
}
console.log(`Built ${assets.length} public assets in dist/ (${(bytes / 1024).toFixed(1)} KiB total).`);

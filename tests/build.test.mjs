import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('deployment contains only public assets and removes stale output', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'mindscope-build-'));
  const root = new URL('../', import.meta.url);
  const assets = ['app.js', 'index.html', 'questions.js', 'style.css', ...Array.from({ length: 10 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}.png`)].sort();
  try {
    await mkdir(join(fixture, 'scripts'));
    await copyFile(new URL('scripts/build.mjs', root), join(fixture, 'scripts/build.mjs'));
    for (const file of assets) await copyFile(new URL(file, root), join(fixture, file));
    await mkdir(join(fixture, 'node_modules/workerd/bin'), { recursive: true });
    await writeFile(join(fixture, 'node_modules/workerd/bin/workerd'), 'not a website asset');
    await writeFile(join(fixture, '.env'), 'PRIVATE_VALUE=excluded');
    await mkdir(join(fixture, 'dist'));
    await writeFile(join(fixture, 'dist/stale.txt'), 'old deployment file');
    execFileSync(process.execPath, [join(fixture, 'scripts/build.mjs')]);
    assert.deepEqual((await readdir(join(fixture, 'dist'))).sort(), assets);
    for (const file of assets) {
      const published = await readFile(join(fixture, 'dist', file));
      assert.deepEqual(published, await readFile(new URL(file, root)));
      assert.ok(published.length < 25 * 1024 * 1024);
    }
    const config = JSON.parse(await readFile(new URL('wrangler.jsonc', root), 'utf8'));
    assert.equal(config.assets.directory, './dist');
    assert.equal(config.build.command, 'npm run build');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

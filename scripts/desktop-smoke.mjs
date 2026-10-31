import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('desktop-release.config.json', 'utf8'));
const { _electron } = await import(config.slug === 'office' ? '@playwright/test' : 'playwright');
const profile = await mkdtemp(path.join(os.tmpdir(), config.slug + '-native-'));
let executable = path.resolve(process.argv[2]);
if (process.platform === 'darwin') {
  const directory = path.join(executable, 'Contents/MacOS');
  const files = await readdir(directory);
  assert.equal(files.length, 1);
  executable = path.join(directory, files[0]);
}
const launch = () => _electron.launch({
  executablePath: executable,
  args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '',
    OFFICE_DATA: path.join(profile, 'workspace'), OFFICE_PROFILE: path.join(profile, 'profile'),
    RSS_PROFILE: path.join(profile, 'profile') },
  timeout: 60000,
});
let app;
try {
  app = await launch();
  let page = await app.firstWindow();
  assert.equal(await page.evaluate(() => typeof require), 'undefined', 'renderer has no Node integration');
  if (config.slug === 'office') {
    await page.getByText('All changes saved', { exact: true }).waitFor();
    const note = page.getByLabel('Document text', { exact: true }).first();
    await note.fill('This native workspace survives a Store update.');
    await page.getByText('All changes saved', { exact: true }).waitFor();
    // Wait behind IndexedDB and Go journal writes before a clean shutdown.
    await page.waitForTimeout(750);
  } else {
    await page.waitForFunction(() => !!window.rss);
    const folders = await page.evaluate(async () => {
      await window.rss.folders.create('Native desktop smoke');
      return window.rss.folders.list();
    });
    assert.ok(folders.some(folder => folder.name === 'Native desktop smoke'));
    assert.ok((await page.locator('body').innerText()).trim().length > 20, 'native reader rendered');
  }
  await app.close(); app = undefined;
  // OS process exit and sidecar listener cleanup may arrive in separate events.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      app = await launch();
      page = await app.firstWindow();
      if (config.slug === 'office') {
        await page.getByText('All changes saved', { exact: true }).waitFor({ timeout: 10000 });
        assert.ok((await page.getByLabel('Document text', { exact: true }).first().innerText()).includes('This native workspace survives a Store update.'));
      } else {
        await page.waitForFunction(() => !!window.rss);
        const folders = await page.evaluate(() => window.rss.folders.list());
        assert.ok(folders.some(folder => folder.name === 'Native desktop smoke'));
      }
      break;
    } catch (error) {
      await app?.close().catch(() => {}); app = undefined;
      if (attempt === 19) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  console.log(config.name + ': packaged native UI, local backend and persistence across relaunch passed');
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}

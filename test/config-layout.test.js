const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paperdeck-config-'));
process.env.DASHBOARD_DATA_DIR = dataDir;
after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const config = require('../backend/config');

test('normalizeHeader keeps known flags and trims the custom text', () => {
  assert.deepEqual(config.normalizeHeader(undefined), { showDate: true, showTime: true, showBattery: true, text: '' });
  assert.deepEqual(
    config.normalizeHeader({ showBattery: false, text: '  Office   desk  ', extra: 1 }),
    { showDate: true, showTime: true, showBattery: false, text: 'Office desk' },
  );
  assert.equal(config.normalizeHeader({ text: 'x'.repeat(100) }).text.length, 40);
});

test('normalizeLayout clamps grid spans and drops unknown fields', () => {
  const layout = config.normalizeLayout({
    mode: 'custom',
    blocks: [
      { id: 'a', tool: 'network', w: 30, h: 0, evil: '<script>' },
      { id: 'b', tool: 'storage', width: 'full', height: 'tall' },
      { tool: 'missing-id' },
      null,
    ],
  });
  assert.equal(layout.mode, 'custom');
  assert.deepEqual(layout.blocks, [
    { id: 'a', tool: 'network', width: 'half', height: 'standard', w: 12, h: 1 },
    { id: 'b', tool: 'storage', width: 'full', height: 'tall' },
  ]);
  assert.equal(config.normalizeLayout({ mode: 'weird' }).mode, 'preset');
  assert.equal(config.normalizeLayout(null), undefined);
});

test('writeConfig persists title, header and grid layout from the on-screen editor', () => {
  const saved = config.writeConfig({
    activeWidgets: ['network', 'storage'],
    dashboardTitle: '   Minha   mesa   ',
    header: { showDate: false, text: 'Home' },
    layout: { mode: 'custom', blocks: [{ id: 'n', tool: 'network', w: 8, h: 2 }, { id: 's', tool: 'storage', w: 4, h: 2 }] },
  });
  assert.equal(saved.dashboardTitle, 'Minha mesa');
  assert.deepEqual(saved.header, { showDate: false, showTime: true, showBattery: true, text: 'Home' });

  const read = config.readConfig();
  assert.deepEqual(read.layout.blocks.map((b) => [b.tool, b.w, b.h]), [['network', 8, 2], ['storage', 4, 2]]);
  assert.equal(read.header.text, 'Home');

  // Título vazio volta ao padrão.
  assert.equal(config.writeConfig({ dashboardTitle: '   ' }).dashboardTitle, 'PaperDeck');
});

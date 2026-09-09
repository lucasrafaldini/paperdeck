const assert = require('node:assert/strict');
const { test } = require('node:test');
const tamagotchi = require('../backend/collectors/tamagotchi');
const sitescraper = require('../backend/collectors/sitescraper');
const { createServer } = require('../backend/server');

test('tamagotchi collector returns valid pet state and reacts to actions', async () => {
  const initial = await tamagotchi.collect();
  assert.equal(initial.tool, 'tamagotchi');
  assert.ok(initial.name);
  assert.equal(typeof initial.hunger, 'number');
  assert.equal(typeof initial.happiness, 'number');
  assert.equal(typeof initial.energy, 'number');
  assert.ok(initial.statusText);
  assert.ok(initial.spriteAscii);

  // Test action feed
  const fed = tamagotchi.performAction('feed');
  assert.ok(fed.hunger <= initial.hunger);

  // Test action pet
  const petted = tamagotchi.performAction('pet');
  assert.ok(petted.happiness >= fed.happiness);

  // Test action bath
  const bathed = tamagotchi.performAction('bath');
  assert.equal(bathed.cleanliness, 100);

  // Test action setCharacter
  const switched = tamagotchi.performAction('setCharacter', { character: 'kuchipatchi' });
  assert.equal(switched.character, 'kuchipatchi');
  assert.equal(switched.name, 'Kuchipatchi');
  assert.ok(switched.svgMono.includes('<svg'));
});

test('sitescraper collector returns valid site data structure', async () => {
  const data = await sitescraper.collect();
  assert.equal(data.tool, 'sitescraper');
  assert.ok(Array.isArray(data.sites));
  if (data.sites.length > 0) {
    const first = data.sites[0];
    assert.ok(first.name);
    assert.ok(first.url);
    assert.ok(Array.isArray(first.posts));
  }
});

test('tamagotchi HTTP action endpoint performs pet care', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${baseUrl}/api/tamagotchi/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok);
    assert.ok(data.pet);
    assert.ok(data.pet.happiness > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

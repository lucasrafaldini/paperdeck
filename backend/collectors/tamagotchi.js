// Coletor do Mascote Virtual (Tamagotchi) para o Kindle Dashboard
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../config');
const sprites = require('./tamagotchi-sprites');

function getPetFile() {
  return path.join(getDataDir(), 'tamagotchi-state.json');
}

const DEFAULT_PET = {
  name: 'Mametchi',
  character: 'mametchi', // 'mametchi' | 'kuchipatchi' | 'mimitchi' | 'cat' | 'dog'
  type: 'mametchi',
  bornAt: Date.now() - 3 * 86400 * 1000,
  lastFed: Date.now() - 3600 * 1000,
  lastPetted: Date.now() - 1800 * 1000,
  lastPlayed: Date.now() - 7200 * 1000,
  lastBathed: Date.now() - 3600 * 1000,
  hunger: 25,       // 0 = cheio, 100 = morrendo de fome
  happiness: 90,    // 0 = triste, 100 = extasiado
  energy: 85,       // 0 = exausto, 100 = cheio de energia
  cleanliness: 95,  // 0 = sujo/precisa banho, 100 = impecável
  feedCount: 12,
  petCount: 25,
  playCount: 10,
  bathCount: 5,
};

function readPetState() {
  try {
    const file = getPetFile();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ...DEFAULT_PET, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_PET };
}

function writePetState(state) {
  try {
    const file = getPetFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  } catch {}
}

function computeDecay(pet) {
  const now = Date.now();
  const hoursSinceFed = Math.max(0, (now - (pet.lastFed || now)) / (3600 * 1000));
  const hoursSincePet = Math.max(0, (now - (pet.lastPetted || now)) / (3600 * 1000));
  const hoursSinceBathed = Math.max(0, (now - (pet.lastBathed || pet.bornAt || now)) / (3600 * 1000));

  // Fome: +4% por hora
  let currentHunger = Math.min(100, Math.round((pet.hunger ?? 25) + hoursSinceFed * 4));

  // Limpeza: cai 2% por hora
  let currentCleanliness = Math.max(0, Math.round((pet.cleanliness ?? 95) - hoursSinceBathed * 2));

  // Felicidade: cai 3% por hora sem carinho/brincadeira; penalidades se com fome ou sujo
  let penalty = (currentHunger > 70 ? 2 : 0) + (currentCleanliness < 30 ? 2 : 0);
  let currentHappiness = Math.max(0, Math.round((pet.happiness ?? 90) - hoursSincePet * 3 - penalty));

  // Energia: recupera à noite (23h-07h), gasta um pouco de dia
  const localHour = new Date().getHours();
  const isNight = localHour >= 23 || localHour < 7;
  let currentEnergy = isNight
    ? Math.min(100, (pet.energy ?? 80) + 10)
    : Math.max(10, (pet.energy ?? 80) - 5);

  let mood = 'normal';
  let statusText = 'Tranquilo e passeando 🐾';
  let spriteAscii = '(=^･ω･^=)';

  if (isNight) {
    mood = 'sleeping';
    statusText = 'Dormindo profundamente... 💤';
    spriteAscii = '(-.-) z Z';
  } else if (currentHunger >= 75) {
    mood = 'hungry';
    statusText = 'Com muita fome! Precisa de comida 🍲';
    spriteAscii = '(O_O) !?';
  } else if (currentCleanliness <= 25) {
    mood = 'dirty';
    statusText = 'Precisa de um banho urgente! 🧼';
    spriteAscii = '(~_~;) ♨';
  } else if (currentHappiness >= 80 && currentHunger < 40) {
    mood = 'happy';
    statusText = 'Muito feliz e radiante! ✨';
    spriteAscii = '(^.^)/ ♥';
  } else if (currentHappiness <= 30) {
    mood = 'sad';
    statusText = 'Sentindo-se sozinho... faça carinho ❤️';
    spriteAscii = '(T.T)';
  }

  const ageDays = Math.max(1, Math.floor((now - pet.bornAt) / (86400 * 1000)));
  const level = Math.max(1, Math.floor(ageDays / 2) + Math.floor((pet.feedCount || 0) / 10));
  const characterId = pet.character || pet.type || 'mametchi';
  const charDef = sprites.getCharacter(characterId);

  // Seleciona frame estático ideal para e-ink / snapshot
  let frameKey = 'idle_1';
  if (mood === 'sleeping') frameKey = 'sleep';
  else if (mood === 'hungry') frameKey = 'feed';
  else if (mood === 'dirty') frameKey = 'bath';
  else if (mood === 'happy') frameKey = 'pet';

  const grid = charDef.frames[frameKey] || charDef.frames.idle_1;
  const svgMono = sprites.renderSvg(grid, { size: 72, mono: true });
  const svgColor = sprites.renderSvg(grid, { size: 72, mono: false });

  return {
    ...pet,
    character: characterId,
    characterName: charDef.name,
    hunger: currentHunger,
    happiness: currentHappiness,
    energy: currentEnergy,
    cleanliness: currentCleanliness,
    ageDays,
    level,
    mood,
    statusText,
    spriteAscii,
    svgMono,
    svgColor,
  };
}

function performAction(action, payload = {}) {
  const current = readPetState();
  const now = Date.now();
  let updated = { ...current };

  if (action === 'feed') {
    updated.hunger = Math.max(0, (current.hunger ?? 30) - 35);
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 10);
    updated.cleanliness = Math.max(0, (current.cleanliness ?? 90) - 5);
    updated.lastFed = now;
    updated.feedCount = (current.feedCount || 0) + 1;
  } else if (action === 'pet') {
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 25);
    updated.lastPetted = now;
    updated.petCount = (current.petCount || 0) + 1;
  } else if (action === 'play') {
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 30);
    updated.hunger = Math.min(100, (current.hunger ?? 30) + 10);
    updated.energy = Math.max(10, (current.energy ?? 80) - 15);
    updated.cleanliness = Math.max(0, (current.cleanliness ?? 90) - 10);
    updated.lastPlayed = now;
    updated.lastPetted = now;
    updated.playCount = (current.playCount || 0) + 1;
  } else if (action === 'bath') {
    updated.cleanliness = 100;
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 20);
    updated.lastBathed = now;
    updated.bathCount = (current.bathCount || 0) + 1;
  } else if (action === 'setCharacter' && payload.character) {
    updated.character = payload.character;
    updated.type = payload.character;
    const charDef = sprites.getCharacter(payload.character);
    if (charDef) updated.name = charDef.name;
  } else if (action === 'setName' && payload.name) {
    updated.name = String(payload.name).trim();
  }

  writePetState(updated);
  return computeDecay(updated);
}

async function collect() {
  const pet = readPetState();
  const state = computeDecay(pet);
  return {
    tool: 'tamagotchi',
    label: `${state.name} (Pet)`,
    confidence: 'live',
    name: state.name,
    type: state.type,
    character: state.character,
    characterName: state.characterName,
    level: state.level,
    ageDays: state.ageDays,
    hunger: state.hunger,
    happiness: state.happiness,
    energy: state.energy,
    cleanliness: state.cleanliness,
    mood: state.mood,
    statusText: state.statusText,
    spriteAscii: state.spriteAscii,
    svgMono: state.svgMono,
    svgColor: state.svgColor,
    feedCount: state.feedCount,
    petCount: state.petCount,
    playCount: state.playCount,
    bathCount: state.bathCount,
  };
}

module.exports = {
  collect,
  performAction,
  readPetState,
  writePetState,
  getCharacters: sprites.getCharacterList,
};

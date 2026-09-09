// Coletor do Mascote Virtual (Tamagotchi) para o Kindle Dashboard
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('../config');

function getPetFile() {
  return path.join(getDataDir(), 'tamagotchi-state.json');
}

const DEFAULT_PET = {
  name: 'Pixel',
  type: 'cat',
  bornAt: Date.now() - 3 * 86400 * 1000, // 3 dias de vida
  lastFed: Date.now() - 3600 * 1000,
  lastPetted: Date.now() - 1800 * 1000,
  lastPlayed: Date.now() - 7200 * 1000,
  hunger: 30,     // 0 = cheio, 100 = morrendo de fome
  happiness: 85,  // 0 = triste, 100 = extasiado
  energy: 80,     // 0 = exausto, 100 = cheio de energia
  feedCount: 12,
  petCount: 25,
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
  const hoursSinceFed = Math.max(0, (now - pet.lastFed) / (3600 * 1000));
  const hoursSincePet = Math.max(0, (now - pet.lastPetted) / (3600 * 1000));

  // Aumenta fome: +4% por hora sem comer
  let currentHunger = Math.min(100, Math.round(pet.hunger + hoursSinceFed * 4));

  // Diminui felicidade: -3% por hora sem carinho/brincadeira, e perde mais se estiver com fome
  let penalty = currentHunger > 70 ? 2 : 0;
  let currentHappiness = Math.max(0, Math.round(pet.happiness - hoursSincePet * 3 - penalty));

  // Energia varia com o ciclo circadiano e tempo
  const localHour = new Date().getHours();
  const isNight = localHour >= 23 || localHour < 7;
  let currentEnergy = isNight ? Math.min(100, pet.energy + 10) : Math.max(10, pet.energy - 5);

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
  const level = Math.max(1, Math.floor(ageDays / 2) + Math.floor(pet.feedCount / 10));

  return {
    ...pet,
    hunger: currentHunger,
    happiness: currentHappiness,
    energy: currentEnergy,
    ageDays,
    level,
    mood,
    statusText,
    spriteAscii,
  };
}

function performAction(action) {
  const current = readPetState();
  const now = Date.now();
  let updated = { ...current };

  if (action === 'feed') {
    updated.hunger = Math.max(0, current.hunger - 35);
    updated.happiness = Math.min(100, current.happiness + 10);
    updated.lastFed = now;
    updated.feedCount = (current.feedCount || 0) + 1;
  } else if (action === 'pet') {
    updated.happiness = Math.min(100, current.happiness + 25);
    updated.lastPetted = now;
    updated.petCount = (current.petCount || 0) + 1;
  } else if (action === 'play') {
    updated.happiness = Math.min(100, current.happiness + 30);
    updated.hunger = Math.min(100, current.hunger + 15);
    updated.energy = Math.max(10, current.energy - 20);
    updated.lastPlayed = now;
    updated.lastPetted = now;
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
    level: state.level,
    ageDays: state.ageDays,
    hunger: state.hunger,
    happiness: state.happiness,
    energy: state.energy,
    mood: state.mood,
    statusText: state.statusText,
    spriteAscii: state.spriteAscii,
    feedCount: state.feedCount,
    petCount: state.petCount,
  };
}

module.exports = {
  collect,
  performAction,
  readPetState,
  writePetState,
};

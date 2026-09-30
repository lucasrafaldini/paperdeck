// Coletor do Mascote Virtual (Tamagotchi) para o PaperDeck
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
  lastRested: Date.now() - 3600 * 1000,
  isSleeping: false,
  hunger: 25,       // 0 = cheio, 100 = morrendo de fome
  happiness: 90,    // 0 = triste, 100 = extasiado
  energy: 85,       // 0 = exausto, 100 = cheio de energia
  cleanliness: 95,  // 0 = sujo/precisa banho, 100 = impecável
  feedCount: 12,
  petCount: 25,
  playCount: 10,
  bathCount: 5,
  sleepCount: 3,
};

const MOTIVATIONAL_QUOTES = [
  'Codando igual um condenado? Beba água, senão mordo seu pé! ☕🐾',
  'Se o código não compilar de primeira, culpe o compilador e coma um lanche. 🍖',
  'Você é mais forte que um loop infinito sem condição de parada! 💪🚀',
  'Trabalhe duro hoje para poder me encher de petiscos gourmet amanhã! ✨',
  'Não desista! Se até eu aprendi a não sujar meu visor, você resolve esse bug. 🧼',
  'Errar é humano, colocar a culpa no cache é sabedoria divina. 🧠',
  'Um dia sem café é como um pixel sem contraste: simplesmente não funciona. ☕',
  'Foco no objetivo! Ou finja demência até o deploy passar nos testes. 🎯',
  'Inspira, expira e não surta com documentação desatualizada. 🧘‍♂️',
  'Grandes mentes pensam parecido... mentes brilhantes tiram uma soneca antes das 15h. 💤',
  'Hoje o universo conspira a seu favor! (Ou contra seu branch no Git). 🍀',
  'A vida é curta demais para dar merge sem rodar os testes antes! ⚡',
  'Você já sobreviveu a 100% dos seus dias difíceis. Agora me faça carinho! ❤️',
  'Meta de hoje: fingir que entendeu a reunião e resolver em 3 linhas. 🕶️',
  'Se o plano A falhar, lembre que o alfabeto tem mais 25 letras. Relaxa! 🔤',
  'Nem todo herói usa capa, alguns só acham o ponto e vírgula que faltava. 🦸',
  'Persistência é apertar "Retry" até a API ter vergonha na cara. 🔄',
  'Acredite no seu potencial! Eu acredito tanto que deixei você codar hoje. 🌟',
  'Trate seus problemas como commits antigos: rebase e finja que sumiram. 🤫',
  'Produtividade é a arte de fazer muito enquanto adia o mais chato! 🏃‍♂️',
  'Coragem! Até um pato de 16 pixels como eu tem orgulho da sua garra. 🦆',
  'Se nada der certo hoje, pelo menos a bateria do Kindle tá economizada! 🔋',
  'Sorria! Amanhã tem mais bugs novos que você mesmo vai inventar. 🐛',
  'Lembre-se: café + silêncio = superpoderes desbloqueados. ☕✨',
  'Foque no progresso, não na perfeição. Eu sou 16x16 e sou perfeito! 💎',
  'Seja a pessoa que seu pet acha que você é (ou pelo menos tente). 🐶',
  'Respira fundo: nenhum erro 500 dura para sempre no servidor. ☀️',
  'Menos reclamação, mais git push! O sucesso te espera logo ali. 🚀',
  'Não se preocupe com o futuro, ele ainda não foi renderizado na tela. 📺',
  'Você é o mestre da sua branch e o arquiteto dos seus deploys! 👑',
  'Dica de ouro: fechar 40 abas inúteis do browser reduz sua ansiedade em 73%. 🌐',
];

function getDailyQuote(now = Date.now()) {
  const d = new Date(now);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - startOfYear) / (86400 * 1000));
  return MOTIVATIONAL_QUOTES[Math.abs(dayOfYear) % MOTIVATIONAL_QUOTES.length];
}

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
  const hoursSinceRested = Math.max(0, (now - (pet.lastRested || pet.bornAt || now)) / (3600 * 1000));

  // Fome: +4% por hora
  let currentHunger = Math.min(100, Math.round((pet.hunger ?? 25) + hoursSinceFed * 4));

  // Limpeza: cai 2% por hora
  let currentCleanliness = Math.max(0, Math.round((pet.cleanliness ?? 95) - hoursSinceBathed * 2));

  // Felicidade: cai 3% por hora sem carinho/brincadeira; penalidades se com fome ou sujo
  let penalty = (currentHunger > 70 ? 2 : 0) + (currentCleanliness < 30 ? 2 : 0) + ((pet.energy ?? 80) < 25 ? 2 : 0);
  let currentHappiness = Math.max(0, Math.round((pet.happiness ?? 90) - hoursSincePet * 3 - penalty));

  // Energia: descanso recupera, acordado consome devagar
  const localHour = new Date(now).getHours();
  const isNight = localHour >= 23 || localHour < 7;
  const isSleeping = Boolean(pet.isSleeping || isNight);

  let currentEnergy = pet.energy ?? 80;
  if (isSleeping) {
    // Sono/descanso recupera 25% por hora de sono
    currentEnergy = Math.min(100, Math.round(currentEnergy + Math.max(0.5, hoursSinceRested) * 25));
  } else {
    // Acordado: gasta 2% por hora
    currentEnergy = Math.max(10, Math.round(currentEnergy - hoursSinceRested * 2));
  }

  let mood = 'normal';
  let statusText = 'Tranquilo e passeando 🐾';
  let spriteAscii = '(=^･ω･^=)';

  if (isSleeping) {
    mood = 'sleeping';
    statusText = pet.isSleeping ? 'Tirando uma soneca revigorante... 💤' : 'Dormindo profundamente... 💤';
    spriteAscii = '(-.-) z Z';
  } else if (currentEnergy <= 25) {
    mood = 'tired';
    statusText = 'Exausto e sonolento... Precisa de descanso! 💤';
    spriteAscii = '(-.-)';
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
  if (mood === 'sleeping' || mood === 'tired') frameKey = 'sleep';
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
    isSleeping,
    ageDays,
    level,
    mood,
    statusText,
    spriteAscii,
    svgMono,
    svgColor,
    dailyQuote: getDailyQuote(now),
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
    if (updated.isSleeping) updated.isSleeping = false;
  } else if (action === 'pet') {
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 25);
    updated.lastPetted = now;
    updated.petCount = (current.petCount || 0) + 1;
    if (updated.isSleeping) updated.isSleeping = false;
  } else if (action === 'play') {
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 30);
    updated.hunger = Math.min(100, (current.hunger ?? 30) + 10);
    updated.energy = Math.max(10, (current.energy ?? 80) - 20);
    updated.cleanliness = Math.max(0, (current.cleanliness ?? 90) - 10);
    updated.lastPlayed = now;
    updated.lastPetted = now;
    updated.playCount = (current.playCount || 0) + 1;
    if (updated.isSleeping) updated.isSleeping = false;
  } else if (action === 'bath') {
    updated.cleanliness = 100;
    updated.happiness = Math.min(100, (current.happiness ?? 80) + 20);
    updated.lastBathed = now;
    updated.bathCount = (current.bathCount || 0) + 1;
    if (updated.isSleeping) updated.isSleeping = false;
  } else if (action === 'sleep' || action === 'rest' || action === 'nap') {
    if (current.isSleeping) {
      updated.isSleeping = false;
      updated.energy = Math.min(100, (current.energy ?? 50) + 20);
      updated.lastRested = now;
    } else {
      updated.isSleeping = true;
      updated.energy = Math.min(100, (current.energy ?? 30) + 45);
      updated.happiness = Math.min(100, (current.happiness ?? 80) + 10);
      updated.lastRested = now;
      updated.sleepCount = (current.sleepCount || 0) + 1;
    }
  } else if (action === 'wake') {
    updated.isSleeping = false;
    updated.energy = Math.min(100, (current.energy ?? 50) + 15);
    updated.lastRested = now;
  } else if (action === 'setCharacter' && payload.character) {
    updated.character = payload.character;
    updated.type = payload.character;
    const charDef = sprites.getCharacter(payload.character);
    if (charDef && !updated.customName) {
      updated.name = charDef.name;
    }
  } else if (action === 'setName' && payload.name) {
    updated.name = String(payload.name).trim();
    updated.customName = true;
  } else if (action === 'setOptions') {
    if (payload.name) {
      updated.name = String(payload.name).trim();
      updated.customName = true;
    }
    if (payload.character) {
      updated.character = payload.character;
      updated.type = payload.character;
      if (!updated.customName) {
        const charDef = sprites.getCharacter(payload.character);
        if (charDef) updated.name = charDef.name;
      }
    }
    if (payload.animSpeed) updated.animSpeed = payload.animSpeed;
    if (payload.theme) updated.theme = payload.theme;
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
    isSleeping: Boolean(state.isSleeping),
    mood: state.mood,
    statusText: state.statusText,
    spriteAscii: state.spriteAscii,
    svgMono: state.svgMono,
    svgColor: state.svgColor,
    feedCount: state.feedCount,
    petCount: state.petCount,
    playCount: state.playCount,
    bathCount: state.bathCount,
    sleepCount: state.sleepCount || 0,
    animSpeed: state.animSpeed || 'normal',
    theme: state.theme || 'lcd',
    dailyQuote: state.dailyQuote,
  };
}

module.exports = {
  collect,
  performAction,
  readPetState,
  writePetState,
  getCharacters: sprites.getCharacterList,
};

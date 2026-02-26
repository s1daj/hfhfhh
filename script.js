const STORAGE_KEY = "metro_dash_legends_v1";

const characters = [
  { id: "nova", name: "Nova", cost: 0, color: "#ffcc66", speedBoost: 1 },
  { id: "blitz", name: "Blitz", cost: 350, color: "#5be0ff", speedBoost: 1.08 },
  { id: "rio", name: "Rio", cost: 4, gemCost: true, color: "#ff7de0", speedBoost: 1.12 },
  { id: "onyx", name: "Onyx", cost: 800, color: "#c7b8ff", speedBoost: 1.2 },
];

const storyModes = [
  {
    id: "street-sprint",
    name: "Street Sprint",
    desc: "Starter mode: reach 500m and gather 20 coins.",
    unlockLevel: 1,
    targetDistance: 500,
    targetCoins: 20,
    speedFactor: 1,
  },
  {
    id: "night-rush",
    name: "Night Rush",
    desc: "Dark city chaos: reach 900m and collect 5 gems.",
    unlockLevel: 2,
    targetDistance: 900,
    targetCoins: 0,
    targetGems: 5,
    speedFactor: 1.2,
  },
  {
    id: "train-heist",
    name: "Train Heist",
    desc: "Expert chapter: 1300m without crashing twice.",
    unlockLevel: 4,
    targetDistance: 1300,
    targetCoins: 45,
    speedFactor: 1.35,
  },
];

const defaultData = {
  coins: 250,
  gems: 2,
  xp: 0,
  level: 1,
  selectedCharacter: "nova",
  ownedCharacters: ["nova"],
  selectedMode: "street-sprint",
  unlockedModes: ["street-sprint"],
  modeCompletions: {},
  upgrades: { magnet: 1, gemFinder: 1 },
};

const state = loadState();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  coinsTotal: document.getElementById("coinsTotal"),
  gemsTotal: document.getElementById("gemsTotal"),
  playerLevel: document.getElementById("playerLevel"),
  playerXp: document.getElementById("playerXp"),
  runCoins: document.getElementById("runCoins"),
  runGems: document.getElementById("runGems"),
  runDistance: document.getElementById("runDistance"),
  scoreMult: document.getElementById("scoreMult"),
  runMessage: document.getElementById("runMessage"),
  modesList: document.getElementById("modesList"),
  charactersList: document.getElementById("charactersList"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  packBtn: document.getElementById("packBtn"),
  magnetLevel: document.getElementById("magnetLevel"),
  gemLevel: document.getElementById("gemLevel"),
  upgradeMagnet: document.getElementById("upgradeMagnet"),
  upgradeGem: document.getElementById("upgradeGem"),
};

const game = {
  running: false,
  paused: false,
  speed: 6,
  laneX: [280, 480, 680],
  playerLane: 1,
  playerY: 390,
  vy: 0,
  isSliding: false,
  slideTimer: 0,
  distance: 0,
  runCoins: 0,
  runGems: 0,
  multiplier: 1,
  obstacleTimer: 0,
  collectTimer: 0,
  obstacles: [],
  pickups: [],
  maxCrashes: 1,
  crashes: 0,
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try {
    return { ...structuredClone(defaultData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function selectedCharacter() {
  return characters.find((c) => c.id === state.selectedCharacter) || characters[0];
}

function selectedMode() {
  return storyModes.find((m) => m.id === state.selectedMode) || storyModes[0];
}

function xpToNextLevel(level) {
  return 100 + (level - 1) * 60;
}

function grantXP(amount) {
  state.xp += amount;
  while (state.xp >= xpToNextLevel(state.level)) {
    state.xp -= xpToNextLevel(state.level);
    state.level += 1;
    showMessage(`Level up! You are now level ${state.level}.`, true);
    const unlockable = storyModes.filter((m) => m.unlockLevel <= state.level && !state.unlockedModes.includes(m.id));
    unlockable.forEach((m) => state.unlockedModes.push(m.id));
  }
}

function showMessage(text, positive = false) {
  ui.runMessage.textContent = text;
  ui.runMessage.style.color = positive ? "#5dff8a" : "#ff8484";
}

function updateStaticUI() {
  ui.coinsTotal.textContent = Math.floor(state.coins);
  ui.gemsTotal.textContent = Math.floor(state.gems);
  ui.playerLevel.textContent = state.level;
  ui.playerXp.textContent = `${state.xp}/${xpToNextLevel(state.level)}`;
  ui.magnetLevel.textContent = state.upgrades.magnet;
  ui.gemLevel.textContent = state.upgrades.gemFinder;
}

function renderModes() {
  ui.modesList.innerHTML = "";
  for (const mode of storyModes) {
    const unlocked = state.unlockedModes.includes(mode.id);
    const wrap = document.createElement("div");
    wrap.className = "card";

    const info = document.createElement("div");
    info.innerHTML = `<b>${mode.name}</b><div class="subtext">${mode.desc}</div>`;

    const button = document.createElement("button");
    const completed = !!state.modeCompletions[mode.id];
    button.textContent = !unlocked ? `Locked L${mode.unlockLevel}` : completed ? "Completed ✓" : "Select";
    button.disabled = !unlocked;
    if (mode.id === state.selectedMode) button.classList.add("selected");

    button.addEventListener("click", () => {
      state.selectedMode = mode.id;
      saveState();
      renderModes();
      showMessage(`Mode selected: ${mode.name}`, true);
    });

    wrap.append(info, button);
    ui.modesList.append(wrap);
  }
}

function renderCharacters() {
  ui.charactersList.innerHTML = "";
  for (const c of characters) {
    const owned = state.ownedCharacters.includes(c.id);
    const wrap = document.createElement("div");
    wrap.className = "card";

    const info = document.createElement("div");
    info.innerHTML = `<b>${c.name}</b><div class="subtext">Speed ${c.speedBoost.toFixed(2)}x</div>`;

    const button = document.createElement("button");
    if (owned) {
      button.textContent = c.id === state.selectedCharacter ? "Selected" : "Use";
      if (c.id === state.selectedCharacter) button.classList.add("selected");
    } else {
      button.textContent = c.gemCost ? `Buy ${c.cost} gems` : `Buy ${c.cost} coins`;
    }

    button.addEventListener("click", () => {
      if (owned) {
        state.selectedCharacter = c.id;
        showMessage(`${c.name} equipped.`, true);
      } else if (c.gemCost && state.gems >= c.cost) {
        state.gems -= c.cost;
        state.ownedCharacters.push(c.id);
        state.selectedCharacter = c.id;
        showMessage(`Unlocked ${c.name} with gems!`, true);
      } else if (!c.gemCost && state.coins >= c.cost) {
        state.coins -= c.cost;
        state.ownedCharacters.push(c.id);
        state.selectedCharacter = c.id;
        showMessage(`Unlocked ${c.name}!`, true);
      } else {
        showMessage("Not enough currency for this character.");
      }
      saveState();
      updateStaticUI();
      renderCharacters();
    });

    wrap.append(info, button);
    ui.charactersList.append(wrap);
  }
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const tall = Math.random() < 0.45;
  game.obstacles.push({ lane, y: -80, w: 90, h: tall ? 130 : 70, tall });
}

function spawnPickup() {
  const lane = Math.floor(Math.random() * 3);
  const isGem = Math.random() < 0.16 + state.upgrades.gemFinder * 0.015;
  game.pickups.push({ lane, y: -50, r: 16, isGem });
}

function startRun() {
  const mode = selectedMode();
  game.running = true;
  game.paused = false;
  game.speed = 6 * mode.speedFactor * selectedCharacter().speedBoost;
  game.playerLane = 1;
  game.playerY = 390;
  game.vy = 0;
  game.isSliding = false;
  game.slideTimer = 0;
  game.distance = 0;
  game.runCoins = 0;
  game.runGems = 0;
  game.multiplier = 1;
  game.obstacles = [];
  game.pickups = [];
  game.obstacleTimer = 0;
  game.collectTimer = 0;
  game.crashes = 0;
  game.maxCrashes = mode.id === "train-heist" ? 2 : 1;
  showMessage(`Running ${mode.name}. Complete objectives to finish chapter!`, true);
}

function endRun(crashed = false) {
  game.running = false;
  const mode = selectedMode();

  state.coins += game.runCoins;
  state.gems += game.runGems;
  grantXP(Math.floor(game.distance / 6) + game.runCoins + game.runGems * 10);

  const storyPassed =
    game.distance >= mode.targetDistance &&
    game.runCoins >= (mode.targetCoins || 0) &&
    game.runGems >= (mode.targetGems || 0);

  if (storyPassed) {
    state.modeCompletions[mode.id] = true;
    state.coins += 100;
    state.gems += 1;
    grantXP(40);
    showMessage(`Chapter complete! +100 coins, +1 gem bonus.`, true);
  } else if (crashed) {
    showMessage("Run over! Crash detected.");
  } else {
    showMessage("Run ended.");
  }

  saveState();
  updateStaticUI();
  renderModes();
  renderCharacters();
}

function laneProximity(a, b) {
  return Math.abs(game.laneX[a] - game.laneX[b]);
}

function update(dt) {
  if (!game.running || game.paused) return;

  game.distance += (game.speed * dt) / 20;
  game.multiplier = 1 + Math.floor(game.distance / 300);

  game.vy += 0.8;
  game.playerY += game.vy;
  if (game.playerY > 390) {
    game.playerY = 390;
    game.vy = 0;
  }

  if (game.slideTimer > 0) {
    game.slideTimer -= dt;
    if (game.slideTimer <= 0) game.isSliding = false;
  }

  game.obstacleTimer += dt;
  game.collectTimer += dt;
  if (game.obstacleTimer > 850) {
    spawnObstacle();
    game.obstacleTimer = 0;
  }
  if (game.collectTimer > 420) {
    spawnPickup();
    game.collectTimer = 0;
  }

  const scroll = game.speed * dt * 0.11;
  for (const o of game.obstacles) o.y += scroll;
  for (const p of game.pickups) p.y += scroll;

  game.obstacles = game.obstacles.filter((o) => o.y < canvas.height + 60);
  game.pickups = game.pickups.filter((p) => p.y < canvas.height + 60);

  for (const o of game.obstacles) {
    if (laneProximity(o.lane, game.playerLane) < 20 && Math.abs(o.y - game.playerY) < 45) {
      const avoidedByJump = !game.isSliding && game.playerY < 325 && !o.tall;
      const avoidedBySlide = game.isSliding && o.tall;
      if (!avoidedByJump && !avoidedBySlide) {
        game.crashes += 1;
        o.y = canvas.height + 100;
        if (game.crashes >= game.maxCrashes) {
          endRun(true);
          return;
        }
      }
    }
  }

  const magnetRadius = 30 + state.upgrades.magnet * 8;
  for (const p of game.pickups) {
    if (laneProximity(p.lane, game.playerLane) < magnetRadius && Math.abs(p.y - game.playerY) < 58) {
      p.y = canvas.height + 100;
      if (p.isGem) game.runGems += 1;
      else game.runCoins += 1 * game.multiplier;
    }
  }

  ui.runCoins.textContent = Math.floor(game.runCoins);
  ui.runGems.textContent = Math.floor(game.runGems);
  ui.runDistance.textContent = Math.floor(game.distance);
  ui.scoreMult.textContent = `${game.multiplier}x`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#262c3f";
  ctx.fillRect(200, 0, 560, canvas.height);
  ctx.strokeStyle = "#7f91c2";
  ctx.lineWidth = 3;
  for (const x of game.laneX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (const o of game.obstacles) {
    ctx.fillStyle = o.tall ? "#b33b3b" : "#913a7c";
    ctx.fillRect(game.laneX[o.lane] - o.w / 2, o.y - o.h / 2, o.w, o.h);
  }

  for (const p of game.pickups) {
    ctx.beginPath();
    ctx.arc(game.laneX[p.lane], p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.isGem ? "#53ffd9" : "#ffd25f";
    ctx.fill();
  }

  const player = selectedCharacter();
  const h = game.isSliding ? 45 : 90;
  ctx.fillStyle = player.color;
  ctx.fillRect(game.laneX[game.playerLane] - 30, game.playerY - h / 2, 60, h);

  if (!game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("Metro Dash Legends", 310, 250);
    ctx.font = "20px sans-serif";
    ctx.fillText("Press Start Run or Space", 360, 290);
  } else if (game.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("Paused", 430, 270);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(40, now - last);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!game.running) return;
  game.paused = !game.paused;
  showMessage(game.paused ? "Paused." : "Resumed.", true);
}

document.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "a", "A"].includes(e.key)) game.playerLane = Math.max(0, game.playerLane - 1);
  if (["ArrowRight", "d", "D"].includes(e.key)) game.playerLane = Math.min(2, game.playerLane + 1);
  if (["ArrowUp", "w", "W"].includes(e.key) && game.playerY >= 390) game.vy = -16;
  if (["ArrowDown", "s", "S"].includes(e.key) && !game.isSliding && game.playerY >= 390) {
    game.isSliding = true;
    game.slideTimer = 600;
  }
  if (e.code === "Space") {
    if (!game.running) startRun();
    else togglePause();
  }
});

ui.startBtn.addEventListener("click", () => {
  if (!game.running) startRun();
});
ui.pauseBtn.addEventListener("click", togglePause);

ui.packBtn.addEventListener("click", () => {
  const packCost = 120;
  if (state.coins < packCost) {
    showMessage("Need 120 coins to open pack.");
    return;
  }
  state.coins -= packCost;
  const rewardRoll = Math.random();
  if (rewardRoll < 0.5) {
    const reward = 80 + Math.floor(Math.random() * 90);
    state.coins += reward;
    showMessage(`Pack: ${reward} bonus coins!`, true);
  } else if (rewardRoll < 0.85) {
    const reward = 1 + Math.floor(Math.random() * 3);
    state.gems += reward;
    showMessage(`Pack: ${reward} gems!`, true);
  } else {
    const locked = characters.filter((c) => !state.ownedCharacters.includes(c.id));
    if (locked.length) {
      const unlock = locked[Math.floor(Math.random() * locked.length)];
      state.ownedCharacters.push(unlock.id);
      state.selectedCharacter = unlock.id;
      showMessage(`Legendary pack! Unlocked ${unlock.name}.`, true);
    } else {
      state.coins += 200;
      showMessage("Pack duplicate conversion: +200 coins.", true);
    }
  }
  saveState();
  updateStaticUI();
  renderCharacters();
});

ui.upgradeMagnet.addEventListener("click", () => {
  const cost = 75 + state.upgrades.magnet * 35;
  if (state.coins < cost) return showMessage(`Need ${cost} coins.`);
  state.coins -= cost;
  state.upgrades.magnet += 1;
  saveState();
  updateStaticUI();
  showMessage("Magnet upgraded!", true);
});

ui.upgradeGem.addEventListener("click", () => {
  const cost = 2 + Math.floor(state.upgrades.gemFinder / 2);
  if (state.gems < cost) return showMessage(`Need ${cost} gems.`);
  state.gems -= cost;
  state.upgrades.gemFinder += 1;
  saveState();
  updateStaticUI();
  showMessage("Gem Finder upgraded!", true);
});

updateStaticUI();
renderModes();
renderCharacters();
requestAnimationFrame(loop);

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameStatus = "menu" | "running" | "paused" | "gameover";

type Point = { x: number; y: number };
type Enemy = Point & { r: number; wobble: number; speed: number; vx: number; vy: number };
type Spark = Point & { spin: number };
type Particle = Point & {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};
type Impact = Point & { life: number; maxLife: number };
type PopText = Point & { life: number; text: string };
type Slash = Point & { angle: number; life: number; maxLife: number };
type Dust = Point & { vx: number; vy: number; size: number; phase: number };
type Smoke = Point & { vx: number; vy: number; life: number; maxLife: number; size: number };

type Game = {
  status: GameStatus;
  player: Point & { r: number; faceX: number; faceY: number; vx: number; vy: number };
  enemies: Enemy[];
  sparks: Spark[];
  particles: Particle[];
  impacts: Impact[];
  popTexts: PopText[];
  slashes: Slash[];
  dashTrails: Slash[];
  trailTimer: number;
  dust: Dust[];
  smoke: Smoke[];
  smokeTimer: number;
  camX: number;
  camY: number;
  score: number;
  best: number;
  combo: number;
  comboTimer: number;
  shields: number;
  light: number;
  fever: number;
  energy: number;
  superOn: boolean;
  elapsed: number;
  dashCooldown: number;
  dashReadyFlash: number;
  dashTime: number;
  dashX: number;
  dashY: number;
  invincible: number;
  spawnTimer: number;
  shake: number;
  flash: number;
  hitStop: number;
};

type UiState = {
  status: GameStatus;
  score: number;
  best: number;
  combo: number;
  shields: number;
  light: number;
  dash: number;
  stage: number;
  time: number;
  fever: number;
  energy: number;
  superOn: boolean;
};

const VIEW_W = 1280;
const VIEW_H = 800;
const W = 2200;
const H = 1400;
const DASH_COOLDOWN = 0.92;
const FEVER_DURATION = 6.2;
const ENERGY_PER_SPARK = 6;
const SUPER_DRAIN = 100 / 12;
const obstacles = [
  { x: 120, y: 180, w: 280, h: 78 },
  { x: 640, y: 120, w: 190, h: 64 },
  { x: 1250, y: 210, w: 300, h: 78 },
  { x: 1830, y: 150, w: 220, h: 70 },
  { x: 210, y: 640, w: 230, h: 74 },
  { x: 930, y: 540, w: 150, h: 48 },
  { x: 1520, y: 660, w: 280, h: 76 },
  { x: 150, y: 1120, w: 300, h: 80 },
  { x: 800, y: 1050, w: 240, h: 70 },
  { x: 1420, y: 1140, w: 260, h: 72 },
  { x: 1940, y: 980, w: 190, h: 64 },
];
const ambientLights = [
  { x: 330, y: 300, r: 330, rgb: "45,244,230" },
  { x: 1720, y: 330, r: 360, rgb: "255,78,104" },
  { x: 540, y: 1070, r: 330, rgb: "247,240,71" },
  { x: 1860, y: 1130, r: 320, rgb: "45,244,230" },
  { x: 1100, y: 720, r: 420, rgb: "242,236,216" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function circleHitsRect(point: Point, radius: number, rect: (typeof obstacles)[number]) {
  const cx = clamp(point.x, rect.x, rect.x + rect.w);
  const cy = clamp(point.y, rect.y, rect.y + rect.h);
  return Math.hypot(point.x - cx, point.y - cy) < radius + 8;
}

function randomOpenPoint(radius = 30): Point {
  for (let tries = 0; tries < 80; tries += 1) {
    const point = {
      x: radius + 34 + Math.random() * (W - (radius + 34) * 2),
      y: radius + 45 + Math.random() * (H - (radius + 45) * 2),
    };
    if (!obstacles.some((rect) => circleHitsRect(point, radius, rect))) return point;
  }
  return { x: W / 2, y: H / 2 };
}

function makeEnemy(elapsed = 0): Enemy {
  const point = randomOpenPoint(28);
  return {
    ...point,
    r: 21 + Math.random() * 7,
    wobble: Math.random() * Math.PI * 2,
    speed: 91 + Math.random() * 34 + Math.min(91, elapsed * 1.63),
    vx: 0,
    vy: 0,
  };
}

function makeDust(): Dust {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 16,
    vy: -8 - Math.random() * 16,
    size: 1 + Math.random() * 2.4,
    phase: Math.random() * Math.PI * 2,
  };
}

function makeSpark(): Spark {
  return { ...randomOpenPoint(18), spin: Math.random() * Math.PI * 2 };
}

function initialGame(best: number): Game {
  return {
    status: "menu",
    player: { x: W / 2, y: H / 2, r: 25, faceX: 1, faceY: 0, vx: 0, vy: 0 },
    enemies: Array.from({ length: 5 }, () => makeEnemy()),
    sparks: Array.from({ length: 17 }, makeSpark),
    particles: [],
    impacts: [],
    popTexts: [],
    slashes: [],
    dashTrails: [],
    trailTimer: 0,
    smoke: [],
    smokeTimer: 0,
    dust: Array.from({ length: 64 }, makeDust),
    camX: (W - VIEW_W) / 2,
    camY: (H - VIEW_H) / 2,
    score: 0,
    best,
    combo: 1,
    comboTimer: 0,
    shields: 3,
    light: 0,
    fever: 0,
    energy: 0,
    superOn: false,
    elapsed: 0,
    dashCooldown: 0,
    dashReadyFlash: 0,
    dashTime: 0,
    dashX: 1,
    dashY: 0,
    invincible: 0,
    spawnTimer: 0,
    shake: 0,
    flash: 0,
    hitStop: 0,
  };
}

const initialUi: UiState = {
  status: "menu",
  score: 0,
  best: 0,
  combo: 1,
  shields: 3,
  light: 0,
  dash: 1,
  stage: 1,
  time: 0,
  fever: 0,
  energy: 0,
  superOn: false,
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const dashRequestRef = useRef(false);
  const superRequestRef = useRef(false);
  const feverRequestRef = useRef(false);
  const gameRef = useRef<Game | null>(null);
  const startGameRef = useRef<() => void>(() => undefined);
  const togglePauseRef = useRef<() => void>(() => undefined);
  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  const [soundOn, setSoundOn] = useState(true);
  const [ui, setUi] = useState<UiState>(initialUi);

  const tone = useCallback((kind: "spark" | "dash" | "smash" | "hurt" | "fever" | "super") => {
    if (!soundOnRef.current || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const audio = audioRef.current ?? new AudioCtor();
      audioRef.current = audio;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const settings = {
        spark: [620, 0.055, "sine"],
        dash: [180, 0.09, "square"],
        smash: [115, 0.12, "sawtooth"],
        hurt: [72, 0.22, "square"],
        fever: [820, 0.32, "triangle"],
        super: [150, 0.42, "sawtooth"],
      } as const;
      const [frequency, duration, type] = settings[kind];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        kind === "fever" || kind === "super" ? 1320 : Math.max(45, frequency * 0.72),
        now + duration,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      // Audio is optional; the game remains fully playable when it is blocked.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let best = 0;
    try {
      best = Number(window.localStorage.getItem("glow-thief-best")) || 0;
    } catch {
      best = 0;
    }

    const game = initialGame(best);
    gameRef.current = game;
    setUi((previous) => ({ ...previous, best }));
    let last = performance.now();
    let uiTimer = 0;
    let frame = 0;

    const burst = (x: number, y: number, color: string, count: number, force = 210) => {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = force * (0.35 + Math.random() * 0.8);
        game.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.35 + Math.random() * 0.45,
          maxLife: 0.8,
          color,
          size: 2 + Math.random() * 4.5,
        });
      }
    };

    const syncUi = () => {
      game.best = Math.max(game.best, game.score);
      setUi({
        status: game.status,
        score: game.score,
        best: game.best,
        combo: game.combo,
        shields: game.shields,
        light: game.light,
        dash: clamp(1 - game.dashCooldown / DASH_COOLDOWN, 0, 1),
        stage: 1 + Math.floor(game.elapsed / 18),
        time: Math.floor(game.elapsed),
        fever: game.fever,
        energy: Math.round(game.energy),
        superOn: game.superOn,
      });
    };

    const startGame = () => {
      const currentBest = Math.max(game.best, game.score);
      Object.assign(game, initialGame(currentBest), { status: "running" as GameStatus });
      dashRequestRef.current = false;
      superRequestRef.current = false;
      feverRequestRef.current = false;
      tone("dash");
      syncUi();
    };

    const togglePause = () => {
      if (game.status === "running") game.status = "paused";
      else if (game.status === "paused") game.status = "running";
      syncUi();
    };

    startGameRef.current = startGame;
    togglePauseRef.current = togglePause;

    const movePlayer = (dx: number, dy: number) => {
      const player = game.player;
      const oldX = player.x;
      player.x = clamp(player.x + dx, player.r + 18, W - player.r - 18);
      if (obstacles.some((rect) => circleHitsRect(player, player.r, rect))) {
        player.x = oldX;
        player.vx = 0;
      }
      const oldY = player.y;
      player.y = clamp(player.y + dy, player.r + 22, H - player.r - 22);
      if (obstacles.some((rect) => circleHitsRect(player, player.r, rect))) {
        player.y = oldY;
        player.vy = 0;
      }
    };

    const smashEnemy = (index: number) => {
      const enemy = game.enemies[index];
      const points = 240 * game.combo * (game.fever > 0 || game.superOn ? 2 : 1);
      burst(enemy.x, enemy.y, "#ff4e68", 13, 260);
      burst(enemy.x, enemy.y, "#f2ecd8", 6, 160);
      game.impacts.push({ x: enemy.x, y: enemy.y, life: 0.34, maxLife: 0.34 });
      game.slashes.push({
        x: enemy.x,
        y: enemy.y,
        angle: Math.atan2(game.dashY, game.dashX) + (Math.random() - 0.5) * 0.2,
        life: 0.3,
        maxLife: 0.3,
      });
      game.popTexts.push({ x: enemy.x, y: enemy.y - 22, life: 0.72, text: `+${points}` });
      game.score += points;
      if (game.superOn) game.energy = Math.min(100, game.energy + 3);
      game.combo = Math.min(9, game.combo + 1);
      game.comboTimer = 2.85;
      game.shake = 8;
      game.hitStop = 0.055;
      game.enemies.splice(index, 1);
      game.spawnTimer = Math.min(game.spawnTimer, 0.28);
      tone("smash");
    };

    const update = (dt: number) => {
      if (game.status !== "running") return;
      if (game.hitStop > 0) {
        game.hitStop = Math.max(0, game.hitStop - dt);
        return;
      }
      game.elapsed += dt;
      const prevDashCooldown = game.dashCooldown;
      game.dashCooldown = Math.max(0, game.dashCooldown - dt);
      if (prevDashCooldown > 0 && game.dashCooldown === 0) game.dashReadyFlash = 0.45;
      game.dashReadyFlash = Math.max(0, game.dashReadyFlash - dt);
      const prevDashTime = game.dashTime;
      game.dashTime = Math.max(0, game.dashTime - dt);
      if (prevDashTime > 0 && game.dashTime === 0) {
        game.invincible = Math.max(game.invincible, 0.22);
      }
      game.invincible = Math.max(0, game.invincible - dt);
      const hadFever = game.fever > 0;
      game.fever = Math.max(0, game.fever - dt);
      if (hadFever && game.fever === 0) {
        game.invincible = Math.max(game.invincible, 0.45);
        burst(game.player.x, game.player.y, "#f2ecd8", 12, 150);
      }
      game.comboTimer = Math.max(0, game.comboTimer - dt);
      game.spawnTimer -= dt;
      game.shake = Math.max(0, game.shake - 26 * dt);
      game.flash = Math.max(0, game.flash - 2.8 * dt);

      if (game.comboTimer === 0) game.combo = 1;

      let mx = 0;
      let my = 0;
      const keys = keysRef.current;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
      if (mx || my) {
        const length = Math.hypot(mx, my);
        mx /= length;
        my /= length;
        const faceK = 1 - Math.exp(-13 * dt);
        game.player.faceX += (mx - game.player.faceX) * faceK;
        game.player.faceY += (my - game.player.faceY) * faceK;
        const faceLen = Math.hypot(game.player.faceX, game.player.faceY) || 1;
        game.player.faceX /= faceLen;
        game.player.faceY /= faceLen;
      }

      if (superRequestRef.current && !game.superOn && game.energy >= 100) {
        game.superOn = true;
        game.flash = 1;
        game.shake = 12;
        burst(game.player.x, game.player.y, "#f7f047", 30, 340);
        burst(game.player.x, game.player.y, "#2df4e6", 16, 240);
        game.popTexts.push({ x: game.player.x, y: game.player.y - 44, life: 0.9, text: "觉醒!!" });
        tone("super");
      }
      superRequestRef.current = false;

      if (game.superOn) {
        game.energy = Math.max(0, game.energy - SUPER_DRAIN * dt);
        game.dashCooldown = 0;
        if (game.energy === 0) {
          game.superOn = false;
          game.flash = 0.5;
          burst(game.player.x, game.player.y, "#f2ecd8", 14, 170);
          tone("dash");
        }
      }

      if (dashRequestRef.current && game.dashCooldown === 0) {
        game.dashTime = game.superOn ? 0.31 : 0.19;
        game.dashCooldown = game.superOn ? 0 : DASH_COOLDOWN;
        const hasMoveInput = Boolean(mx || my);
        const aimX = hasMoveInput ? mx + game.player.faceX * 0.55 : game.player.faceX;
        const aimY = hasMoveInput ? my + game.player.faceY * 0.55 : game.player.faceY;
        const aimLength = Math.hypot(aimX, aimY) || 1;
        game.dashX = aimX / aimLength;
        game.dashY = aimY / aimLength;
        game.player.faceX = game.dashX;
        game.player.faceY = game.dashY;
        burst(game.player.x, game.player.y, "#2df4e6", 9, 145);
        tone("dash");
      }
      dashRequestRef.current = false;

      const maxSpeed = game.superOn ? 507 : game.fever > 0 ? 478 : 390;
      if (game.dashTime > 0) {
        game.player.vx = game.dashX * 810;
        game.player.vy = game.dashY * 810;
      } else {
        const accelK = 1 - Math.exp(-(mx || my ? 8.4 : 5.9) * dt);
        game.player.vx += (mx * maxSpeed - game.player.vx) * accelK;
        game.player.vy += (my * maxSpeed - game.player.vy) * accelK;
      }
      movePlayer(game.player.vx * dt, game.player.vy * dt);

      if (game.superOn && game.dashTime > 0) {
        game.trailTimer -= dt;
        if (game.trailTimer <= 0) {
          game.trailTimer = 0.03;
          game.dashTrails.push({
            x: game.player.x,
            y: game.player.y,
            angle: Math.atan2(game.dashY, game.dashX),
            life: 1,
            maxLife: 1,
          });
        }
      } else {
        game.trailTimer = 0;
      }

      const targetCamX = clamp(game.player.x - VIEW_W / 2, 0, W - VIEW_W);
      const targetCamY = clamp(game.player.y - VIEW_H / 2, 0, H - VIEW_H);
      const camK = 1 - Math.exp(-5.5 * dt);
      game.camX += (targetCamX - game.camX) * camK;
      game.camY += (targetCamY - game.camY) * camK;

      for (let index = game.sparks.length - 1; index >= 0; index -= 1) {
        const spark = game.sparks[index];
        spark.spin += dt * 3.5;
        if (dist(game.player, spark) < game.player.r + 17) {
          burst(spark.x, spark.y, "#f7f047", 10, 155);
          game.score += 90 * game.combo;
          game.light = Math.min(100, game.light + 10);
          if (!game.superOn) game.energy = Math.min(100, game.energy + ENERGY_PER_SPARK);
          game.dashCooldown = Math.max(0, game.dashCooldown - 0.13);
          game.sparks[index] = makeSpark();
          tone("spark");
        }
      }

      if (feverRequestRef.current && game.fever === 0 && game.light >= 100) {
        game.light = 0;
        game.fever = FEVER_DURATION;
        game.flash = 1;
        game.popTexts.push({ x: game.player.x, y: game.player.y - 44, life: 0.9, text: "发光!!" });
        burst(game.player.x, game.player.y, "#f2ecd8", 34, 330);
        tone("fever");
      }
      feverRequestRef.current = false;

      const targetEnemies = Math.min(14, 5 + Math.floor(game.elapsed / 12));
      if (game.enemies.length < targetEnemies && game.spawnTimer <= 0) {
        let enemy = makeEnemy(game.elapsed);
        for (let tries = 0; tries < 24 && dist(enemy, game.player) < 560; tries += 1) {
          enemy = makeEnemy(game.elapsed);
        }
        game.enemies.push(enemy);
        game.spawnTimer = Math.max(0.38, 1.35 - game.elapsed * 0.012);
      }

      for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = game.enemies[index];
        const dx = game.player.x - enemy.x;
        const dy = game.player.y - enemy.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const sway = Math.sin(game.elapsed * 2.2 + enemy.wobble) * 0.28;
        const desiredX = (dx / length - (dy / length) * sway) * enemy.speed;
        const desiredY = (dy / length + (dx / length) * sway) * enemy.speed;
        const steerK = 1 - Math.exp(-3.1 * dt);
        enemy.vx += (desiredX - enemy.vx) * steerK;
        enemy.vy += (desiredY - enemy.vy) * steerK;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.x = clamp(enemy.x, enemy.r + 12, W - enemy.r - 12);
        enemy.y = clamp(enemy.y, enemy.r + 16, H - enemy.r - 16);

        const gap = dist(game.player, enemy);
        const touchRange = game.player.r + enemy.r - 4;
        const dashKillRange = touchRange + (game.superOn ? 10 : 0);
        if (game.dashTime > 0 && gap < dashKillRange) {
          smashEnemy(index);
        } else if (gap < touchRange) {
          if (game.dashTime === 0 && game.invincible === 0 && game.fever === 0) {
            game.shields -= 1;
            game.combo = 1;
            game.comboTimer = 0;
            game.invincible = 1.35;
            game.shake = 15;
            game.flash = 0.75;
            burst(game.player.x, game.player.y, "#ff4e68", 22, 300);
            game.player.vx = (-dx / length) * 560;
            game.player.vy = (-dy / length) * 560;
            tone("hurt");
            if (game.shields <= 0) {
              game.status = "gameover";
              game.best = Math.max(game.best, game.score);
              try {
                window.localStorage.setItem("glow-thief-best", String(game.best));
              } catch {
                // Local persistence is a convenience, not a requirement.
              }
            }
          }
        }
      }

      game.particles.forEach((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.pow(0.035, dt);
        particle.vy = particle.vy * Math.pow(0.09, dt) + 95 * dt;
      });
      game.particles = game.particles.filter((particle) => particle.life > 0);
      game.impacts.forEach((impact) => { impact.life -= dt; });
      game.impacts = game.impacts.filter((impact) => impact.life > 0);
      game.popTexts.forEach((pop) => {
        pop.life -= dt;
        pop.y -= 46 * dt;
      });
      game.popTexts = game.popTexts.filter((pop) => pop.life > 0);
      game.slashes.forEach((slash) => { slash.life -= dt; });
      game.slashes = game.slashes.filter((slash) => slash.life > 0);
      game.dashTrails.forEach((trail) => { trail.life -= dt; });
      game.dashTrails = game.dashTrails.filter((trail) => trail.life > 0);
      game.smokeTimer -= dt;
      if (game.superOn && game.smokeTimer <= 0) {
        game.smokeTimer = 0.055;
        game.smoke.push({
          x: game.player.x + (Math.random() - 0.5) * 30,
          y: game.player.y + (Math.random() - 0.5) * 30,
          vx: -game.player.vx * 0.14 + (Math.random() - 0.5) * 36,
          vy: -game.player.vy * 0.14 + (Math.random() - 0.5) * 36 - 12,
          life: 0.55 + Math.random() * 0.3,
          maxLife: 0.85,
          size: 5 + Math.random() * 6,
        });
      }
      game.smoke.forEach((puff) => {
        puff.life -= dt;
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;
      });
      game.smoke = game.smoke.filter((puff) => puff.life > 0);
      game.dust.forEach((mote) => {
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        mote.phase += dt;
        if (mote.y < -10) {
          mote.y = H + 10;
          mote.x = Math.random() * W;
        }
        if (mote.x < -10) mote.x = W + 10;
        else if (mote.x > W + 10) mote.x = -10;
      });
    };

    const roundedRect = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
    };

    const draw = () => {
      const jitterX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
      const jitterY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
      const camX = game.camX;
      const camY = game.camY;
      const viewLeft = camX - 30;
      const viewTop = camY - 30;
      const viewRight = camX + VIEW_W + 30;
      const viewBottom = camY + VIEW_H + 30;
      ctx.save();
      ctx.translate(jitterX - camX, jitterY - camY);
      const sky = ctx.createLinearGradient(0, viewTop, 0, viewBottom);
      sky.addColorStop(0, "#0c0d16");
      sky.addColorStop(0.55, "#09090b");
      sky.addColorStop(1, "#0b0a10");
      ctx.fillStyle = sky;
      ctx.fillRect(viewLeft, viewTop, VIEW_W + 60, VIEW_H + 60);

      ambientLights.forEach((glow) => {
        if (glow.x + glow.r < viewLeft || glow.x - glow.r > viewRight ||
          glow.y + glow.r < viewTop || glow.y - glow.r > viewBottom) return;
        const pulse = 0.05 + Math.sin(game.elapsed * 0.9 + glow.x) * 0.016;
        const gradient = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
        gradient.addColorStop(0, `rgba(${glow.rgb},${pulse})`);
        gradient.addColorStop(1, `rgba(${glow.rgb},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2);
      });

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#f2ecd8";
      const dotStartX = Math.floor(viewLeft / 34) * 34 + 18;
      const dotStartY = Math.floor(viewTop / 34) * 34 + 20;
      for (let x = dotStartX; x < viewRight; x += 34) {
        for (let y = dotStartY; y < viewBottom; y += 34) {
          ctx.beginPath();
          ctx.arc(x, y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      const lanternRadius = 200 + (game.superOn ? 130 : game.light * 1.1);
      const lantern = ctx.createRadialGradient(
        game.player.x, game.player.y, 20,
        game.player.x, game.player.y, lanternRadius,
      );
      lantern.addColorStop(0, `rgba(242,236,216,${game.fever > 0 ? 0.12 : 0.075})`);
      lantern.addColorStop(1, "rgba(242,236,216,0)");
      ctx.fillStyle = lantern;
      ctx.beginPath();
      ctx.arc(game.player.x, game.player.y, lanternRadius + 30, 0, Math.PI * 2);
      ctx.fill();

      game.dust.forEach((mote) => {
        if (mote.x < viewLeft || mote.x > viewRight || mote.y < viewTop || mote.y > viewBottom) return;
        ctx.globalAlpha = 0.16 + Math.sin(mote.phase * 2.1) * 0.12;
        ctx.fillStyle = "#f2ecd8";
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      obstacles.forEach((rect, index) => {
        if (rect.x + rect.w < viewLeft || rect.x > viewRight ||
          rect.y + rect.h < viewTop || rect.y > viewBottom) return;
        ctx.fillStyle = "rgba(255, 78, 104, .26)";
        roundedRect(rect.x + 9, rect.y + 11, rect.w, rect.h, 18);
        ctx.fill();
        ctx.fillStyle = index % 2 ? "#101014" : "#050507";
        roundedRect(rect.x, rect.y, rect.w, rect.h, 18);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#f2ecd8";
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(45,244,230,.5)";
        ctx.beginPath();
        ctx.moveTo(rect.x + 16, rect.y + 7);
        ctx.lineTo(rect.x + rect.w - 16, rect.y + 7);
        ctx.stroke();
        const windows = Math.floor(rect.w / 46);
        for (let slot = 0; slot < windows; slot += 1) {
          const lit = Math.sin(game.elapsed * 0.7 + index * 3.1 + slot * 1.7) > 0.15;
          ctx.fillStyle = lit ? "rgba(247,240,71,.34)" : "rgba(242,236,216,.08)";
          ctx.fillRect(rect.x + 20 + slot * 46, rect.y + rect.h / 2 - 6, 16, 12);
        }
      });

      game.sparks.forEach((spark) => {
        if (spark.x < viewLeft - 50 || spark.x > viewRight + 50 ||
          spark.y < viewTop - 50 || spark.y > viewBottom + 50) return;
        ctx.save();
        ctx.translate(spark.x, spark.y);
        const glowPulse = 26 + Math.sin(spark.spin * 2) * 5;
        const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, glowPulse);
        halo.addColorStop(0, "rgba(247,240,71,.3)");
        halo.addColorStop(1, "rgba(247,240,71,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, glowPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(spark.spin);
        ctx.fillStyle = "rgba(242,236,216,.22)";
        ctx.beginPath();
        ctx.ellipse(4, 9, 15, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f7f047";
        ctx.strokeStyle = "#f2ecd8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(5, -5);
        ctx.lineTo(16, 0);
        ctx.lineTo(5, 5);
        ctx.lineTo(0, 16);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-16, 0);
        ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      game.enemies.forEach((enemy) => {
        if (enemy.x < viewLeft - 60 || enemy.x > viewRight + 60 ||
          enemy.y < viewTop - 60 || enemy.y > viewBottom + 60) return;
        const wobble = Math.sin(game.elapsed * 4 + enemy.wobble) * 2.5;
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.fillStyle = "rgba(242,236,216,.18)";
        ctx.beginPath();
        ctx.ellipse(7, enemy.r + 7, enemy.r * 0.9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff4e68";
        ctx.strokeStyle = "#f2ecd8";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-enemy.r, 4);
        ctx.bezierCurveTo(-enemy.r, -enemy.r, -8, -enemy.r - wobble, 0, -enemy.r + 1);
        ctx.bezierCurveTo(10, -enemy.r - wobble, enemy.r, -enemy.r * 0.45, enemy.r, 5);
        ctx.bezierCurveTo(enemy.r, enemy.r, enemy.r * 0.42, enemy.r - 4, 0, enemy.r);
        ctx.bezierCurveTo(-enemy.r * 0.55, enemy.r + 3, -enemy.r, enemy.r, -enemy.r, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.ellipse(-8, -1, 4.2, 7, 0, 0, Math.PI * 2);
        ctx.ellipse(8, -1, 4.2, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      game.particles.forEach((particle) => {
        ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.life * 5);
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.72);
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      game.impacts.forEach((impact) => {
        const progress = 1 - impact.life / impact.maxLife;
        ctx.save();
        ctx.translate(impact.x, impact.y);
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "#f2ecd8";
        ctx.lineWidth = 2.4 - progress * 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 16 + progress * 74, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,78,104,.85)";
        ctx.lineWidth = 1.4;
        for (let ray = 0; ray < 6; ray += 1) {
          const angle = (Math.PI * 2 * ray) / 6 + progress * 0.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (22 + progress * 30), Math.sin(angle) * (22 + progress * 30));
          ctx.lineTo(Math.cos(angle) * (40 + progress * 58), Math.sin(angle) * (40 + progress * 58));
          ctx.stroke();
        }
        ctx.restore();
      });

      game.dashTrails.forEach((trail) => {
        const progress = 1 - trail.life / trail.maxLife;
        const len = 20 + progress * 6;
        const width = 3.2 * (1 - progress * 0.6);
        ctx.save();
        ctx.translate(trail.x, trail.y);
        ctx.rotate(trail.angle);
        ctx.globalAlpha = (1 - progress) * 0.75;
        ctx.fillStyle = "rgba(16,108,224,.42)";
        ctx.beginPath();
        ctx.moveTo(-len * 1.15, 0);
        ctx.quadraticCurveTo(0, -width * 2.4, len * 1.15, 0);
        ctx.quadraticCurveTo(0, width * 2.4, -len * 1.15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(120,190,255,.88)";
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -width, len, 0);
        ctx.quadraticCurveTo(0, width, -len, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      game.slashes.forEach((slash) => {
        const progress = 1 - slash.life / slash.maxLife;
        const ease = 1 - Math.pow(1 - progress, 3);
        const len = 34 + ease * 32;
        const width = 5 * (1 - progress * 0.45);
        ctx.save();
        ctx.translate(slash.x, slash.y);
        ctx.rotate(slash.angle);
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = "rgba(45,244,230,.32)";
        ctx.beginPath();
        ctx.moveTo(-len * 1.12, 0);
        ctx.quadraticCurveTo(0, -width * 2.6, len * 1.12, 0);
        ctx.quadraticCurveTo(0, width * 2.6, -len * 1.12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -width, len, 0);
        ctx.quadraticCurveTo(0, width, -len, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(45,244,230,.9)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -width - 1.2, len, 0);
        ctx.stroke();
        ctx.globalAlpha = (1 - progress) * 0.4;
        ctx.strokeStyle = "#2df4e6";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-len * 0.5 + 9, 11);
        ctx.lineTo(len * 0.5 + 9, 11);
        ctx.stroke();
        ctx.restore();
      });

      game.popTexts.forEach((pop) => {
        ctx.save();
        ctx.translate(pop.x, pop.y);
        ctx.rotate(-0.08);
        ctx.globalAlpha = clamp(pop.life / 0.25, 0, 1);
        ctx.font = "900 30px Impact, Arial Black, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#09090b";
        ctx.strokeText(pop.text, 0, 0);
        ctx.fillStyle = "#f7f047";
        ctx.fillText(pop.text, 0, 0);
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      game.smoke.forEach((puff) => {
        const puffP = 1 - puff.life / puff.maxLife;
        ctx.globalAlpha = 0.13 * (puff.life / puff.maxLife);
        ctx.fillStyle = "#2df4e6";
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, puff.size * (1 + puffP * 0.9), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      const player = game.player;
      const blinking = game.invincible > 0 && Math.floor(game.invincible * 14) % 2 === 0;
      if (!blinking) {
        ctx.save();
        ctx.translate(player.x, player.y);
        if (game.dashTime > 0) {
          for (let echo = 4; echo >= 1; echo -= 1) {
            ctx.globalAlpha = 0.08 + (4 - echo) * 0.035;
            ctx.fillStyle = echo % 2 ? "#2df4e6" : "#f2ecd8";
            ctx.beginPath();
            ctx.arc(-game.dashX * echo * 27, -game.dashY * echo * 27, 25 - echo * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(45, 244, 230, .55)";
          ctx.lineWidth = 17;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-game.dashX * 92, -game.dashY * 92);
          ctx.lineTo(-game.dashX * 26, -game.dashY * 26);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(242,236,216,.8)";
          for (let streak = -2; streak <= 2; streak += 1) {
            ctx.beginPath();
            ctx.moveTo(-game.dashX * (115 + Math.abs(streak) * 12) - game.dashY * streak * 12, -game.dashY * (115 + Math.abs(streak) * 12) + game.dashX * streak * 12);
            ctx.lineTo(-game.dashX * 48 - game.dashY * streak * 12, -game.dashY * 48 + game.dashX * streak * 12);
            ctx.stroke();
          }
        }
        if (game.fever > 0) {
          ctx.strokeStyle = `rgba(247,240,71,${0.45 + Math.sin(game.elapsed * 12) * 0.2})`;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(0, 0, 39 + Math.sin(game.elapsed * 8) * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (game.superOn) {
          ctx.strokeStyle = `rgba(247,240,71,${0.5 + Math.sin(game.elapsed * 10) * 0.2})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.lineDashOffset = -game.elapsed * 70;
          ctx.beginPath();
          ctx.arc(0, 0, 46, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(45,244,230,.65)";
          ctx.lineWidth = 1.6;
          ctx.lineDashOffset = game.elapsed * 90;
          ctx.beginPath();
          ctx.arc(0, 0, 55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = "rgba(255,78,104,.32)";
        ctx.beginPath();
        ctx.ellipse(7, 32, 31, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f2ecd8";
        ctx.lineWidth = 6;
        ctx.fillStyle = "#2df4e6";
        ctx.beginPath();
        ctx.moveTo(-23, -15);
        ctx.lineTo(-16, -39);
        ctx.lineTo(-4, -27);
        ctx.quadraticCurveTo(0, -31, 5, -27);
        ctx.lineTo(18, -40);
        ctx.lineTo(24, -14);
        ctx.arc(0, 0, 28, -0.45, Math.PI * 2 - 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(28, 11, 15, -1.2, 1.9);
        ctx.stroke();
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.ellipse(-8, -3, 3.8, 6.5, 0, 0, Math.PI * 2);
        ctx.ellipse(9, -3, 3.8, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff4e68";
        ctx.beginPath();
        ctx.arc(1, 8, 4.5, 0, Math.PI * 2);
        ctx.fill();

        const bagWarning = game.fever > 0 && game.fever <= 1.5;
        const bagPulse = bagWarning && Math.floor(game.elapsed * 14) % 2 === 0;
        const bagCharge = game.fever > 0 || game.superOn ? 1 : game.light / 100;
        const bagX = -player.faceY * 20 - player.faceX * 9;
        const bagY = player.faceX * 20 - player.faceY * 9;
        ctx.save();
        ctx.translate(bagX, bagY);
        if (game.fever > 0) {
          ctx.globalAlpha = bagPulse ? 0.95 : 0.42;
          ctx.fillStyle = bagPulse ? "#ff4e68" : "#f7f047";
          ctx.beginPath();
          ctx.arc(0, 0, bagPulse ? 23 : 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -7, 9, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#f2ecd8";
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-11, -5, 22, 24, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = bagPulse ? "#ff4e68" : "#f7f047";
        ctx.fillRect(-6, 13 - bagCharge * 13, 12, 4 + bagCharge * 13);
        ctx.restore();

        const dashReady = game.dashCooldown === 0;
        const lampY = -50;
        if (dashReady && game.dashReadyFlash > 0) {
          const flashP = 1 - game.dashReadyFlash / 0.45;
          ctx.globalAlpha = 1 - flashP;
          ctx.strokeStyle = "#2df4e6";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, lampY, 8 + flashP * 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (dashReady) {
          const lampHalo = ctx.createRadialGradient(0, lampY, 1, 0, lampY, 17);
          lampHalo.addColorStop(0, "rgba(45,244,230,.5)");
          lampHalo.addColorStop(1, "rgba(45,244,230,0)");
          ctx.fillStyle = lampHalo;
          ctx.beginPath();
          ctx.arc(0, lampY, 17, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.translate(0, lampY);
        ctx.rotate(-Math.PI / 4);
        ctx.lineCap = "round";
        ctx.strokeStyle = dashReady ? "#2df4e6" : "rgba(45,244,230,.25)";
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-8, 1);
        ctx.quadraticCurveTo(0, -4.4, 8, 1);
        ctx.stroke();
        if (dashReady) {
          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-6, 0.2);
          ctx.quadraticCurveTo(0, -4, 6, 0.2);
          ctx.stroke();
        }
        ctx.restore();
        if (!dashReady) {
          const cooldownP = 1 - game.dashCooldown / DASH_COOLDOWN;
          ctx.strokeStyle = "rgba(45,244,230,.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, lampY, 9, -Math.PI / 2, -Math.PI / 2 + cooldownP * Math.PI * 2);
          ctx.stroke();
        }

        const swordAngle = Math.atan2(player.faceY, player.faceX) + Math.sin(game.elapsed * 2.6) * 0.05;
        const reach = game.dashTime > 0 ? 12 : 0;
        ctx.save();
        ctx.rotate(swordAngle);
        ctx.translate(16 + reach, 9);
        ctx.rotate(-0.16);
        if (game.dashTime > 0) {
          ctx.shadowColor = "#2df4e6";
          ctx.shadowBlur = 16;
        }
        ctx.lineCap = "round";
        ctx.strokeStyle = "#14141a";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.strokeStyle = "#ff4e68";
        ctx.lineWidth = 1.4;
        for (let wrap = 0; wrap < 3; wrap += 1) {
          ctx.beginPath();
          ctx.moveTo(1 + wrap * 4, -2.4);
          ctx.lineTo(3 + wrap * 4, 2.4);
          ctx.stroke();
        }
        ctx.fillStyle = "#f7f047";
        ctx.strokeStyle = "#09090b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(14, 0, 2.6, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const tip = 64 + reach;
        const blade = ctx.createLinearGradient(16, 0, tip, 0);
        blade.addColorStop(0, "#cfd4d6");
        blade.addColorStop(0.6, "#f4f7f5");
        blade.addColorStop(1, "#ffffff");
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(16, -2.2);
        ctx.quadraticCurveTo((16 + tip) / 2, -4.6, tip, -0.6);
        ctx.quadraticCurveTo(tip + 3.5, 0.2, tip - 1, 1.1);
        ctx.quadraticCurveTo((16 + tip) / 2, 2.4, 16, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(9,9,11,.65)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = "rgba(45,244,230,.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(18, -1.5);
        ctx.quadraticCurveTo((16 + tip) / 2, -3.4, tip - 2, -0.4);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.restore();
      }

      ctx.restore();

      const vignette = ctx.createRadialGradient(
        VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
        VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.88,
      );
      vignette.addColorStop(0, "rgba(5,5,8,0)");
      vignette.addColorStop(1, "rgba(5,5,8,.5)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      if (game.superOn) {
        const pulse = 0.55 + Math.sin(game.elapsed * 8) * 0.25;
        const aura = ctx.createRadialGradient(
          VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.5,
          VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.9,
        );
        aura.addColorStop(0, "rgba(247,240,71,0)");
        aura.addColorStop(1, `rgba(247,240,71,${0.14 * pulse})`);
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.strokeStyle = `rgba(247,240,71,${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(7, 7, VIEW_W - 14, VIEW_H - 14);
        ctx.strokeStyle = "rgba(45,244,230,.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([30, 20]);
        ctx.lineDashOffset = -game.elapsed * 120;
        ctx.strokeRect(15, 15, VIEW_W - 30, VIEW_H - 30);
        ctx.setLineDash([]);
      }

      if (game.flash > 0) {
        ctx.fillStyle = `rgba(242,236,216,${game.flash * 0.24})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      if (game.status === "running" || game.status === "paused") {
        const mapW = 156;
        const mapH = (mapW * H) / W;
        const mapX = VIEW_W - mapW - 16;
        const mapY = VIEW_H - mapH - 16;
        const scale = mapW / W;
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "rgba(9,9,11,.78)";
        ctx.strokeStyle = "rgba(242,236,216,.7)";
        ctx.lineWidth = 2;
        roundedRect(mapX, mapY, mapW, mapH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(242,236,216,.28)";
        obstacles.forEach((rect) => {
          ctx.fillRect(
            mapX + rect.x * scale,
            mapY + rect.y * scale,
            Math.max(2, rect.w * scale),
            Math.max(2, rect.h * scale),
          );
        });
        ctx.fillStyle = "#f7f047";
        game.sparks.forEach((spark) => {
          ctx.fillRect(mapX + spark.x * scale - 1, mapY + spark.y * scale - 1, 2, 2);
        });
        ctx.fillStyle = "#ff4e68";
        game.enemies.forEach((enemy) => {
          ctx.beginPath();
          ctx.arc(mapX + enemy.x * scale, mapY + enemy.y * scale, 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = "rgba(45,244,230,.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX + camX * scale, mapY + camY * scale, VIEW_W * scale, VIEW_H * scale);
        ctx.fillStyle = "#2df4e6";
        ctx.beginPath();
        ctx.arc(mapX + game.player.x * scale, mapY + game.player.y * scale, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      uiTimer += dt;
      if (uiTimer > 0.09) {
        uiTimer = 0;
        syncUi();
      }
      frame = requestAnimationFrame(loop);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        togglePause();
        return;
      }
      if ((event.code === "Enter" || event.code === "Space") && game.status === "paused") {
        event.preventDefault();
        togglePause();
        return;
      }
      if ((event.code === "Enter" || event.code === "Space") &&
        (game.status === "menu" || game.status === "gameover")) {
        startGame();
        return;
      }
      if (event.code === "Space" && !event.repeat) dashRequestRef.current = true;
      if (event.code === "KeyR" && !event.repeat) feverRequestRef.current = true;
      if (event.code === "KeyQ" && !event.repeat) superRequestRef.current = true;
      keysRef.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    const onBlur = () => {
      keysRef.current.clear();
      if (game.status === "running") togglePause();
    };
    const onVisibility = () => {
      if (document.hidden && game.status === "running") togglePause();
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tone]);

  const setTouchKey = (code: string, pressed: boolean) => {
    if (pressed) keysRef.current.add(code);
    else keysRef.current.delete(code);
  };

  const toggleSound = () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    if (next) tone("spark");
  };

  const overlayTitle =
    ui.status === "gameover" ? "光被抢光了" : ui.status === "paused" ? "先喘口气" : "偷走光，别让影子碰到你";
  const overlayCopy =
    ui.status === "gameover"
      ? `本轮 ${ui.score.toLocaleString("zh-CN")} 分，最高 ${ui.best.toLocaleString("zh-CN")} 分`
      : ui.status === "paused"
        ? "影子也暂停了。按空格 / 回车 / P 原地继续。"
        : "捡光点充能：灯袋满按 R 无敌发光，总能量满按 Q 觉醒狂飙。移动决定方向，空格直线冲刺。";

  return (
    <main className="game-page">
      <div className="paper-grain" aria-hidden="true" />
      <section className="game-shell" aria-label="夜光小贼游戏">
        <header className="game-header">
          <div className="title-sticker">
            <span className="tape tape-left" aria-hidden="true" />
            <span className="tape tape-right" aria-hidden="true" />
            <p className="eyebrow">MIDNIGHT HEIST / ISSUE {String(ui.stage).padStart(2, "0")}</p>
            <h1>夜光小贼</h1>
            <span className="english-title">GLOW THIEF</span>
          </div>

          <div className="hud" aria-label="游戏状态">
            <div className="hud-card score-card">
              <span>SCORE / 得分</span>
              <strong>{ui.score.toLocaleString("zh-CN")}</strong>
            </div>
            <div className="hud-card combo-card">
              <span>COMBO</span>
              <strong>×{ui.combo}</strong>
            </div>
            <div className="hud-card best-card">
              <span>BEST / 最高</span>
              <strong>{ui.best.toLocaleString("zh-CN")}</strong>
            </div>
          </div>

          <div className="header-actions">
            <button className="utility-button" type="button" onClick={toggleSound} aria-pressed={soundOn}>
              {soundOn ? "声音 开" : "声音 关"}
            </button>
            <button className="utility-button" type="button" onClick={() => togglePauseRef.current()}>
              {ui.status === "paused" ? "继续" : "暂停"}
            </button>
          </div>
        </header>

        <div className="arena-wrap">
          <div className={`arena-frame ${ui.superOn ? "is-super" : ""} ${ui.fever > 0 ? "is-fever" : ""} ${ui.fever > 0 && ui.fever <= 1.5 ? "is-expiring" : ""}`}>
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={VIEW_W}
              height={VIEW_H}
              aria-label="游戏区域：使用 WASD 或方向键移动并决定冲刺方向，空格直线冲刺"
            />

            <div className="arena-status status-left">
              <span>护盾</span>
              <div className="shield-pips" aria-label={`剩余 ${ui.shields} 格护盾`}>
                {[0, 1, 2].map((index) => (
                  <i key={index} className={index < ui.shields ? "active" : ""} />
                ))}
              </div>
            </div>
            <div className="arena-status status-right">
              <span>{ui.superOn ? "觉醒形态!!" : ui.fever > 0 ? `发光 ${ui.fever.toFixed(1)}s` : `第 ${ui.stage} 轮 · ${ui.time}s`}</span>
            </div>

            {ui.status !== "running" && (
              <div className="game-overlay">
                <div className="overlay-note">
                  <span className="mini-tape" aria-hidden="true" />
                  <p className="overlay-kicker">
                    {ui.status === "gameover" ? "RUN OVER" : ui.status === "paused" ? "PAUSED" : "NIGHT RUN 01"}
                  </p>
                  <h2>{overlayTitle}</h2>
                  <p>{overlayCopy}</p>
                  {ui.status === "paused" ? (
                    <>
                      <button className="start-button" type="button" autoFocus onClick={() => togglePauseRef.current()}>
                        原地继续
                      </button>
                      <button className="resume-button" type="button" onClick={() => startGameRef.current()}>
                        重新开始
                      </button>
                    </>
                  ) : (
                    <button className="start-button" type="button" onClick={() => startGameRef.current()}>
                      {ui.status === "gameover" ? "再偷一轮" : "开始遛影子"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="control-dock">
          <div className="keyboard-legend" aria-label="键盘操作说明">
            <span className="keycap">W</span>
            <span className="keycap">A</span>
            <span className="keycap">S</span>
            <span className="keycap">D</span>
            <span className="legend-copy">移动</span>
            <span className="keycap wide">SPACE</span>
            <span className="legend-copy">冲刺</span>
            <span className="keycap">R</span>
            <span className="legend-copy">发光</span>
            <span className="keycap">Q</span>
            <span className="legend-copy">觉醒</span>
            <span className="keycap">P</span>
            <span className="legend-copy">暂停</span>
          </div>

          <div className="meters">
            <div className={`meter-block ${ui.fever > 0 && ui.fever <= 1.5 ? "is-expiring" : ""} ${ui.light >= 100 && ui.fever === 0 ? "is-ready" : ""}`}>
              <div className="meter-label">
                <span>{ui.fever > 0 ? "发光剩余" : "灯袋"}</span>
                <strong>{ui.fever > 0 ? `${ui.fever.toFixed(1)}s` : ui.light >= 100 ? "按 R 发光!" : `${ui.light}%`}</strong>
              </div>
              <div className="meter-track light-track"><i style={{ width: `${ui.fever > 0 ? (ui.fever / FEVER_DURATION) * 100 : ui.light}%` }} /></div>
            </div>
            <div className="meter-block">
              <div className="meter-label"><span>冲刺</span><strong>{ui.dash >= 1 ? "READY" : `${Math.round(ui.dash * 100)}%`}</strong></div>
              <div className="meter-track dash-track"><i style={{ width: `${ui.dash * 100}%` }} /></div>
            </div>
            <div className={`meter-block ${ui.energy >= 100 && !ui.superOn ? "is-ready" : ""} ${ui.superOn ? "is-super" : ""}`}>
              <div className="meter-label">
                <span>总能量</span>
                <strong>{ui.superOn ? "觉醒中!!" : ui.energy >= 100 ? "按 Q 觉醒!" : `${ui.energy}%`}</strong>
              </div>
              <div className="meter-track energy-track"><i style={{ width: `${ui.energy}%` }} /></div>
            </div>
          </div>

          <div className="touch-controls" aria-label="触屏操作">
            <div className="touch-dpad">
              <button
                className="touch-button up"
                type="button"
                aria-label="向上"
                onPointerDown={() => setTouchKey("ArrowUp", true)}
                onPointerUp={() => setTouchKey("ArrowUp", false)}
                onPointerCancel={() => setTouchKey("ArrowUp", false)}
                onPointerLeave={() => setTouchKey("ArrowUp", false)}
              >↑</button>
              <button
                className="touch-button left"
                type="button"
                aria-label="向左"
                onPointerDown={() => setTouchKey("ArrowLeft", true)}
                onPointerUp={() => setTouchKey("ArrowLeft", false)}
                onPointerCancel={() => setTouchKey("ArrowLeft", false)}
                onPointerLeave={() => setTouchKey("ArrowLeft", false)}
              >←</button>
              <button
                className="touch-button down"
                type="button"
                aria-label="向下"
                onPointerDown={() => setTouchKey("ArrowDown", true)}
                onPointerUp={() => setTouchKey("ArrowDown", false)}
                onPointerCancel={() => setTouchKey("ArrowDown", false)}
                onPointerLeave={() => setTouchKey("ArrowDown", false)}
              >↓</button>
              <button
                className="touch-button right"
                type="button"
                aria-label="向右"
                onPointerDown={() => setTouchKey("ArrowRight", true)}
                onPointerUp={() => setTouchKey("ArrowRight", false)}
                onPointerCancel={() => setTouchKey("ArrowRight", false)}
                onPointerLeave={() => setTouchKey("ArrowRight", false)}
              >→</button>
            </div>
            <button
              className="dash-button"
              type="button"
              onPointerDown={() => { dashRequestRef.current = true; }}
              aria-label="冲刺"
            >冲刺</button>
            <button
              className="dash-button fever-button"
              type="button"
              onPointerDown={() => { feverRequestRef.current = true; }}
              aria-label="发光"
            >发光</button>
            <button
              className="dash-button awaken-button"
              type="button"
              onPointerDown={() => { superRequestRef.current = true; }}
              aria-label="觉醒"
            >觉醒</button>
          </div>
        </footer>
      </section>
    </main>
  );
}

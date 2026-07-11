"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameStatus = "menu" | "running" | "paused" | "gameover";

type Point = { x: number; y: number };
type Enemy = Point & { r: number; wobble: number; speed: number };
type Spark = Point & { spin: number };
type Particle = Point & {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Game = {
  status: GameStatus;
  player: Point & { r: number; faceX: number; faceY: number };
  enemies: Enemy[];
  sparks: Spark[];
  particles: Particle[];
  score: number;
  best: number;
  combo: number;
  comboTimer: number;
  shields: number;
  light: number;
  fever: number;
  elapsed: number;
  dashCooldown: number;
  dashTime: number;
  dashX: number;
  dashY: number;
  invincible: number;
  spawnTimer: number;
  shake: number;
  flash: number;
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
};

const W = 1280;
const H = 800;
const DASH_COOLDOWN = 0.92;
const obstacles = [
  { x: 72, y: 150, w: 260, h: 76 },
  { x: 900, y: 176, w: 255, h: 72 },
  { x: 130, y: 560, w: 285, h: 80 },
  { x: 760, y: 570, w: 220, h: 68 },
  { x: 520, y: 310, w: 130, h: 42 },
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
    speed: 70 + Math.random() * 26 + Math.min(70, elapsed * 1.25),
  };
}

function makeSpark(): Spark {
  return { ...randomOpenPoint(18), spin: Math.random() * Math.PI * 2 };
}

function initialGame(best: number): Game {
  return {
    status: "menu",
    player: { x: W / 2, y: H / 2, r: 25, faceX: 1, faceY: 0 },
    enemies: Array.from({ length: 4 }, () => makeEnemy()),
    sparks: Array.from({ length: 11 }, makeSpark),
    particles: [],
    score: 0,
    best,
    combo: 1,
    comboTimer: 0,
    shields: 3,
    light: 0,
    fever: 0,
    elapsed: 0,
    dashCooldown: 0,
    dashTime: 0,
    dashX: 1,
    dashY: 0,
    invincible: 0,
    spawnTimer: 0,
    shake: 0,
    flash: 0,
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
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const dashRequestRef = useRef(false);
  const gameRef = useRef<Game | null>(null);
  const startGameRef = useRef<() => void>(() => undefined);
  const togglePauseRef = useRef<() => void>(() => undefined);
  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  const [soundOn, setSoundOn] = useState(true);
  const [ui, setUi] = useState<UiState>(initialUi);

  const tone = useCallback((kind: "spark" | "dash" | "smash" | "hurt" | "fever") => {
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
      } as const;
      const [frequency, duration, type] = settings[kind];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        kind === "fever" ? 1320 : Math.max(45, frequency * 0.72),
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
          size: 3 + Math.random() * 8,
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
      });
    };

    const startGame = () => {
      const currentBest = Math.max(game.best, game.score);
      Object.assign(game, initialGame(currentBest), { status: "running" as GameStatus });
      dashRequestRef.current = false;
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
      if (obstacles.some((rect) => circleHitsRect(player, player.r, rect))) player.x = oldX;
      const oldY = player.y;
      player.y = clamp(player.y + dy, player.r + 22, H - player.r - 22);
      if (obstacles.some((rect) => circleHitsRect(player, player.r, rect))) player.y = oldY;
    };

    const smashEnemy = (index: number) => {
      const enemy = game.enemies[index];
      burst(enemy.x, enemy.y, "#ff4e68", 18, 280);
      burst(enemy.x, enemy.y, "#f2ecd8", 7, 170);
      game.score += 240 * game.combo * (game.fever > 0 ? 2 : 1);
      game.combo = Math.min(9, game.combo + 1);
      game.comboTimer = 2.85;
      game.shake = 8;
      game.enemies.splice(index, 1);
      game.spawnTimer = Math.min(game.spawnTimer, 0.28);
      tone("smash");
    };

    const update = (dt: number) => {
      if (game.status !== "running") return;
      game.elapsed += dt;
      game.dashCooldown = Math.max(0, game.dashCooldown - dt);
      game.dashTime = Math.max(0, game.dashTime - dt);
      game.invincible = Math.max(0, game.invincible - dt);
      game.fever = Math.max(0, game.fever - dt);
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
        game.player.faceX = mx;
        game.player.faceY = my;
      }

      if (dashRequestRef.current && game.dashCooldown === 0) {
        game.dashTime = 0.19;
        game.dashCooldown = DASH_COOLDOWN;
        game.dashX = mx || my ? mx : game.player.faceX;
        game.dashY = mx || my ? my : game.player.faceY;
        burst(game.player.x, game.player.y, "#2df4e6", 9, 145);
        tone("dash");
      }
      dashRequestRef.current = false;

      const speed = game.dashTime > 0 ? 790 : game.fever > 0 ? 348 : 286;
      const vx = game.dashTime > 0 ? game.dashX : mx;
      const vy = game.dashTime > 0 ? game.dashY : my;
      movePlayer(vx * speed * dt, vy * speed * dt);

      for (let index = game.sparks.length - 1; index >= 0; index -= 1) {
        const spark = game.sparks[index];
        spark.spin += dt * 3.5;
        if (dist(game.player, spark) < game.player.r + 17) {
          burst(spark.x, spark.y, "#f7f047", 10, 155);
          game.score += 90 * game.combo;
          game.light += 10;
          game.dashCooldown = Math.max(0, game.dashCooldown - 0.13);
          game.sparks[index] = makeSpark();
          tone("spark");
          if (game.light >= 100) {
            game.light = 0;
            game.fever = 6.2;
            game.flash = 1;
            burst(game.player.x, game.player.y, "#f2ecd8", 34, 330);
            tone("fever");
          }
        }
      }

      const targetEnemies = Math.min(12, 4 + Math.floor(game.elapsed / 13));
      if (game.enemies.length < targetEnemies && game.spawnTimer <= 0) {
        const enemy = makeEnemy(game.elapsed);
        if (dist(enemy, game.player) < 240) {
          enemy.x = enemy.x < W / 2 ? W - 48 : 48;
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
        enemy.x += (dx / length - (dy / length) * sway) * enemy.speed * dt;
        enemy.y += (dy / length + (dx / length) * sway) * enemy.speed * dt;
        enemy.x = clamp(enemy.x, enemy.r + 12, W - enemy.r - 12);
        enemy.y = clamp(enemy.y, enemy.r + 16, H - enemy.r - 16);

        if (dist(game.player, enemy) < game.player.r + enemy.r - 4) {
          if (game.dashTime > 0 || game.fever > 0) {
            smashEnemy(index);
          } else if (game.invincible === 0) {
            game.shields -= 1;
            game.combo = 1;
            game.comboTimer = 0;
            game.invincible = 1.35;
            game.shake = 15;
            game.flash = 0.75;
            burst(game.player.x, game.player.y, "#ff4e68", 22, 300);
            movePlayer((-dx / length) * 58, (-dy / length) * 58);
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
      ctx.save();
      ctx.translate(jitterX, jitterY);
      ctx.fillStyle = "#09090b";
      ctx.fillRect(-20, -20, W + 40, H + 40);

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#f2ecd8";
      for (let x = 18; x < W; x += 34) {
        for (let y = 20; y < H; y += 34) {
          ctx.beginPath();
          ctx.arc(x, y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(45, 244, 230, .1)";
      for (let line = 0; line < 7; line += 1) {
        const y = 105 + line * 62 + Math.sin(game.elapsed * 1.8 + line) * 8;
        ctx.beginPath();
        ctx.moveTo(24, y);
        ctx.lineTo(330 + line * 34, y + 18);
        ctx.stroke();
      }

      obstacles.forEach((rect, index) => {
        ctx.fillStyle = "rgba(255, 78, 104, .26)";
        roundedRect(rect.x + 9, rect.y + 11, rect.w, rect.h, 18);
        ctx.fill();
        ctx.fillStyle = index % 2 ? "#101014" : "#050507";
        roundedRect(rect.x, rect.y, rect.w, rect.h, 18);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#f2ecd8";
        ctx.stroke();
        ctx.fillStyle = index % 2 ? "#2df4e6" : "#ff4e68";
        ctx.save();
        ctx.translate(rect.x + rect.w * 0.52, rect.y - 4);
        ctx.rotate(index % 2 ? -0.1 : 0.08);
        ctx.fillRect(-48, -5, 96, 10);
        ctx.restore();
      });

      game.sparks.forEach((spark) => {
        ctx.save();
        ctx.translate(spark.x, spark.y);
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

      const player = game.player;
      const blinking = game.invincible > 0 && Math.floor(game.invincible * 14) % 2 === 0;
      if (!blinking) {
        ctx.save();
        ctx.translate(player.x, player.y);
        if (game.dashTime > 0) {
          ctx.strokeStyle = "rgba(45, 244, 230, .55)";
          ctx.lineWidth = 15;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-game.dashX * 92, -game.dashY * 92);
          ctx.lineTo(-game.dashX * 26, -game.dashY * 26);
          ctx.stroke();
        }
        if (game.fever > 0) {
          ctx.strokeStyle = `rgba(247,240,71,${0.45 + Math.sin(game.elapsed * 12) * 0.2})`;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(0, 0, 39 + Math.sin(game.elapsed * 8) * 4, 0, Math.PI * 2);
          ctx.stroke();
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
        ctx.restore();
      }

      if (game.flash > 0) {
        ctx.fillStyle = `rgba(242,236,216,${game.flash * 0.24})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
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
      if ((event.code === "Enter" || event.code === "Space") &&
        (game.status === "menu" || game.status === "gameover")) {
        startGame();
        return;
      }
      if (event.code === "Space" && !event.repeat) dashRequestRef.current = true;
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
        ? "影子也暂停了。按 P 或继续按钮返回。"
        : "捡光点填满灯袋。冲刺时撞碎影子，连续击碎会提高倍率。";

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
          <div className={`arena-frame ${ui.fever > 0 ? "is-fever" : ""}`}>
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={W}
              height={H}
              aria-label="游戏区域：使用 WASD 或方向键移动，空格冲刺"
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
              <span>{ui.fever > 0 ? "发光中" : `第 ${ui.stage} 轮 · ${ui.time}s`}</span>
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
                  <button className="start-button" type="button" onClick={() => startGameRef.current()}>
                    {ui.status === "gameover" ? "再偷一轮" : ui.status === "paused" ? "重新开始" : "开始遛影子"}
                  </button>
                  {ui.status === "paused" && (
                    <button className="resume-button" type="button" onClick={() => togglePauseRef.current()}>
                      原地继续
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
            <span className="keycap">P</span>
            <span className="legend-copy">暂停</span>
          </div>

          <div className="meters">
            <div className="meter-block">
              <div className="meter-label"><span>灯袋</span><strong>{ui.fever > 0 ? "发光中" : `${ui.light}%`}</strong></div>
              <div className="meter-track light-track"><i style={{ width: `${ui.fever > 0 ? 100 : ui.light}%` }} /></div>
            </div>
            <div className="meter-block">
              <div className="meter-label"><span>冲刺</span><strong>{ui.dash >= 1 ? "READY" : `${Math.round(ui.dash * 100)}%`}</strong></div>
              <div className="meter-track dash-track"><i style={{ width: `${ui.dash * 100}%` }} /></div>
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
          </div>
        </footer>
      </section>
    </main>
  );
}

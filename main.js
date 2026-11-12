const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ==================== Configuración ====================
const GRAVITY = 0.8;
const FRICTION = 0.85;
const ACCEL = 0.7;
const MAX_SPEED = 5;
const DASH_SPEED = 16;
const DASH_FRAMES = 10;
const DASH_COOLDOWN = 40;
const JUMP_FORCE = -15;
const MAX_JUMPS = 2;
const TILE = 32;

// Estados del jugador: 0=pequeño, 1=grande (hongo), 2=fuego (flor)
const STATE = { SMALL: 0, BIG: 1, FIRE: 2 };
const STATE_NAME = ['small', 'big', 'fire'];
const STATE_COLOR = { small: '#e74c3c', big: '#f39c12', fire: '#e67e22' };

function sizeFor(state) {
  if (state === STATE.SMALL) return { w: 24, h: 32 };
  return { w: 32, h: 48 }; // BIG y FIRE
}

// ==================== Entrada ====================
const keys = { left: false, right: false, up: false, dash: false, fire: false };
const just = {};
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === ' ') keys.up = true;
  if (e.key === 'Shift') keys.dash = true;
  if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') keys.fire = true;
  just[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'ArrowUp' || e.key === ' ') keys.up = false;
  if (e.key === 'Shift') keys.dash = false;
  if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') keys.fire = false;
});
function pressed(key) { return !!just[key]; }
function consume(key) { just[key] = false; }

// ==================== Nivel / tiles ====================
const COLS = 300;
const ROWS = 16;
const levelW = COLS * TILE;

// tiles: {x, y, w, h, type, content}
// type: 'ground' | 'platform' | 'coin' | 'mushroom' | 'flower' | 'brick' | 'question' | 'pipe' | 'used' | 'flag'
const tiles = [];
const coins = [];
const powerUps = [];
const fireballs = [];
const particles = [];
const floats = [];
const enemies = [];

let gameWon = false;
let winShown = false;

function addTile(x, y, type, content) {
  tiles.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE, type, content });
}

function isSolid(t) {
  return t.type === 'ground' || t.type === 'platform' || t.type === 'brick' ||
    t.type === 'question' || t.type === 'pipe' || t.type === 'used' || t.type === 'flag';
}

// Suelo extendido por todo el nivel (2 filas)
for (let c = 0; c < COLS; c++) {
  addTile(c, ROWS - 1, 'ground');
  addTile(c, ROWS - 2, 'ground');
}

// Tubos verdes del escenario (colisionables, infranqueables)
const pipeGroups = [
  [22, ROWS - 3], [23, ROWS - 3],
  [38, ROWS - 4], [39, ROWS - 4],
  [55, ROWS - 3], [56, ROWS - 3],
  [72, ROWS - 4], [73, ROWS - 4],
  [90, ROWS - 3], [91, ROWS - 3],
  [110, ROWS - 5], [111, ROWS - 5],
  [130, ROWS - 3], [131, ROWS - 3],
  [150, ROWS - 4], [151, ROWS - 4],
  [170, ROWS - 3], [171, ROWS - 3],
  [195, ROWS - 4], [196, ROWS - 4],
  [215, ROWS - 3], [216, ROWS - 3],
  [240, ROWS - 5], [241, ROWS - 5],
];
pipeGroups.forEach(([cx, cy]) => {
  addTile(cx, cy, 'pipe');
  addTile(cx + 1, cy, 'pipe');
});

// Tubo de salida (META) - especial, distinto color, al tocarlo se gana
const EXIT_PIPE_X = 285;
const EXIT_PIPE_Y = ROWS - 5;
addTile(EXIT_PIPE_X, EXIT_PIPE_Y, 'pipe');   addTile(EXIT_PIPE_X + 1, EXIT_PIPE_Y, 'pipe');
addTile(EXIT_PIPE_X, EXIT_PIPE_Y + 1, 'pipe'); addTile(EXIT_PIPE_X + 1, EXIT_PIPE_Y + 1, 'pipe');
addTile(EXIT_PIPE_X, EXIT_PIPE_Y + 2, 'pipe'); addTile(EXIT_PIPE_X + 1, EXIT_PIPE_Y + 2, 'pipe');

// Avisos visuales de meta (bandera)
addTile(EXIT_PIPE_X - 2, ROWS - 2, 'flag');
addTile(EXIT_PIPE_X - 2, ROWS - 3, 'flag');
addTile(EXIT_PIPE_X - 2, ROWS - 4, 'flag');
addTile(EXIT_PIPE_X - 2, ROWS - 5, 'flag');

// Bloques de ladrillo (se rompen golpeando desde abajo)
const brickGroups = [44, 45, 46, 47, 80, 81, 82, 83, 120, 121, 122, 123, 160, 161, 162, 163, 200, 201, 202, 203];
brickGroups.forEach(c => addTile(c, 11, 'brick'));

// Bloques de pregunta
addTile(12, 8, 'question', 'mushroom');
addTile(28, 7, 'question', 'coin');
addTile(45, 6, 'question', 'flower');
addTile(70, 8, 'question', 'mushroom');
addTile(100, 7, 'question', 'coin');
addTile(140, 6, 'question', 'flower');
addTile(180, 8, 'question', 'mushroom');
addTile(220, 7, 'question', 'coin');
addTile(260, 6, 'question', 'flower');

// Plataformas flotantes [cx, cy, largo]
const platforms = [
  [10, 10, 4], [18, 9, 3], [26, 8, 4], [34, 9, 3], [42, 10, 4],
  [14, 6, 3], [22, 7, 3], [30, 6, 3], [38, 7, 3], [46, 8, 3],
  [8, 11, 3], [52, 11, 3], [60, 10, 4], [68, 9, 3], [76, 8, 4],
  [84, 9, 3], [92, 10, 4], [105, 8, 3], [115, 9, 3], [125, 8, 4],
  [145, 7, 3], [155, 8, 3], [165, 9, 4], [175, 8, 3], [185, 7, 3],
  [195, 8, 4], [205, 9, 3], [215, 10, 4], [225, 8, 3], [235, 9, 3],
  [245, 8, 4], [255, 9, 3], [265, 10, 4], [275, 8, 3]
];
platforms.forEach(([cx, cy, len]) => {
  for (let i = 0; i < len; i++) addTile(cx + i, cy, 'platform');
});

// Monedas sueltas distribuidas
const coinPos = [
  [12, 7], [14, 7], [16, 7], [20, 6], [22, 6], [28, 5], [30, 5],
  [36, 6], [38, 6], [44, 7], [46, 7], [50, 5], [52, 5], [55, 6],
  [10, 10], [20, 9], [30, 8], [40, 9], [50, 10],
  [62, 7], [64, 7], [70, 6], [72, 6], [78, 5], [80, 5], [84, 6],
  [90, 7], [92, 7], [98, 8], [102, 9], [108, 8], [110, 10],
  [122, 7], [124, 7], [130, 6], [132, 6], [138, 5], [140, 5], [144, 6],
  [150, 7], [152, 7], [158, 8], [162, 9], [168, 8], [170, 10],
  [182, 7], [184, 7], [190, 6], [192, 6], [198, 5], [200, 5], [204, 6],
  [210, 7], [212, 7], [218, 8], [222, 9], [228, 8], [230, 10],
  [242, 7], [244, 7], [250, 6], [252, 6], [258, 5], [260, 5], [264, 6],
  [270, 7], [272, 7], [278, 8], [282, 9], [288, 8], [290, 10]
];
coinPos.forEach(([cx, cy]) => {
  coins.push({ x: cx * TILE + 8, y: cy * TILE - TILE, r: 6, taken: false });
});

// ==================== Enemigos ====================
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'goomba' | 'koopa'
    this.state = 'walk';
    this.facing = 1;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.stompTimer = 0;
    if (type === 'goomba') {
      this.w = 32; this.h = 32; this.walkSpeed = 0.9;
    } else {
      this.w = 32; this.h = 32; this.walkSpeed = 0.8;
    }
    this.vx = this.facing * this.walkSpeed;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    if (this.state === 'dead') {
      if (this.stompTimer > 0) this.stompTimer--;
      return;
    }

    if (this.state === 'walk') {
      this.vy += GRAVITY;
      this.x += this.vx;
      this.solidCollide('x');
      this.y += this.vy;
      this.solidCollide('y');

      const lead = this.facing > 0 ? this.x + this.w : this.x;
      const wallSensor = { x: lead, y: this.y + 6, w: 2, h: this.h - 12 };
      const footSensor = { x: this.facing > 0 ? this.x + this.w - 2 : this.x, y: this.y + this.h + 1, w: 2, h: 2 };
      let wall = false, support = false;
      for (const t of tiles) {
        if (!isSolid(t)) continue;
        if (intersect(wallSensor, t)) wall = true;
        if (intersect(footSensor, t)) support = true;
      }
      if (wall || !support) {
        this.facing *= -1;
        this.vx = this.facing * this.walkSpeed;
        this.x += this.vx * 2;
      }
    } else if (this.state === 'shell') {
      if (Math.abs(this.vx) > 0.3) {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.solidCollide('x');
        this.y += this.vy;
        this.solidCollide('y');
        this.vx *= 0.96;
        if (Math.abs(this.vx) < 0.3) this.vx = 0;
      } else {
        this.vy += GRAVITY;
        this.y += this.vy;
        this.solidCollide('y');
      }
    }

    if (this.x < 0) { this.x = 0; this.facing = 1; this.vx = Math.abs(this.vx); }
    if (this.x + this.w > levelW) { this.x = levelW - this.w; this.facing = -1; this.vx = -Math.abs(this.vx); }
    if (this.y > canvas.height + 100) this.state = 'dead';
  }

  solidCollide(axis) {
    const r = this.rect;
    for (const t of tiles) {
      if (!isSolid(t)) continue;
      if (!intersect(r, t)) continue;
      if (axis === 'x') {
        if (this.vx > 0) { this.x = t.x - this.w; this.vx = 0; }
        else if (this.vx < 0) { this.x = t.x + t.w; this.vx = 0; }
      } else {
        if (this.vy > 0) { this.y = t.y - this.h; this.vy = 0; this.onGround = true; }
        else if (this.vy < 0) { this.y = t.y + t.h; this.vy = 0; }
      }
    }
  }

  draw(camX) {
    if (this.state === 'dead') return;
    ctx.save();
    ctx.translate(this.x - camX, this.y);

    if (this.type === 'goomba') {
      ctx.fillStyle = '#a04000';
      ctx.beginPath(); ctx.ellipse(16, 22, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a3200'; ctx.fillRect(5, 22, 7, 8); ctx.fillRect(20, 22, 7, 8);
      ctx.fillStyle = '#fff'; ctx.fillRect(10, 12, 5, 5); ctx.fillRect(17, 12, 5, 5);
      ctx.fillStyle = '#000'; ctx.fillRect(12, 14, 2, 2); ctx.fillRect(19, 14, 2, 2);
    } else {
      ctx.fillStyle = '#27ae60';
      ctx.beginPath(); ctx.ellipse(16, 20, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e8449'; ctx.fillRect(4, 14, 24, 10);
      if (this.state === 'walk') {
        ctx.fillStyle = '#8bc34a'; ctx.fillRect(9, 2, 14, 18);
        ctx.fillStyle = '#fff'; ctx.fillRect(this.facing > 0 ? 20 : 8, 8, 4, 4);
        ctx.fillStyle = '#000'; ctx.fillRect(this.facing > 0 ? 22 : 10, 9, 1, 1);
      }
    }
    ctx.restore();
  }
}

const enemySpawns = [
  [15, 'goomba'], [17, 'goomba'], [28, 'koopa'], [44, 'koopa'], [54, 'goomba'],
  [60, 'goomba'], [62, 'goomba'], [70, 'koopa'], [82, 'goomba'], [95, 'koopa'],
  [105, 'goomba'], [112, 'goomba'], [120, 'koopa'], [132, 'goomba'], [145, 'koopa'],
  [155, 'goomba'], [165, 'goomba'], [175, 'koopa'], [185, 'goomba'], [195, 'koopa'],
  [205, 'goomba'], [212, 'goomba'], [220, 'koopa'], [232, 'goomba'], [245, 'koopa'],
  [255, 'goomba'], [262, 'goomba'], [270, 'koopa'], [282, 'goomba']
];
enemySpawns.forEach(([cx, type]) => {
  enemies.push(new Enemy(cx * TILE, (ROWS - 2) * TILE - 32, type));
});

// ==================== Jugador ====================
class Player {
  constructor(x, y) { this.reset(x, y); }
  reset(x, y) {
    this.x = x; this.y = y; this.state = STATE.SMALL;
    this.setSize(); this.vx = 0; this.vy = 0;
    this.onGround = false; this.jumpsLeft = MAX_JUMPS;
    this.facing = 1; this.anim = 0; this.animTimer = 0;
    this.dashTimer = 0; this.dashCd = 0; this.fireCd = 0;
    this.invuln = 0; this.dead = false; this.prevY = this.y;
  }
  setSize() {
    const s = sizeFor(this.state);
    const feet = this.y + this.h;
    this.w = s.w; this.h = s.h; this.y = feet - this.h;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  input() {
    if (this.dead) return;
    const moving = keys.left || keys.right;
    if (keys.right) { this.facing = 1; this.vx += ACCEL; }
    if (keys.left) { this.facing = -1; this.vx -= ACCEL; }
    if (!moving) this.vx *= FRICTION;

    if (pressed('Shift') && this.dashCd <= 0 && this.dashTimer <= 0) {
      this.dashTimer = DASH_FRAMES; this.dashCd = DASH_COOLDOWN;
      this.vx = this.facing * DASH_SPEED;
    }
    consume('Shift');

    if (pressed('ArrowUp') || pressed(' ')) {
      if (this.jumpsLeft > 0) {
        this.vy = JUMP_FORCE; this.jumpsLeft--;
        this.onGround = false; this.anim = 0;
      }
    }
    consume('ArrowUp'); consume(' ');

    if (this.state === STATE.FIRE && this.fireCd <= 0 && (pressed('z') || pressed('Z') || pressed('x') || pressed('X'))) {
      consume('z'); consume('Z'); consume('x'); consume('X');
      this.fireCd = 20;
      fireballs.push({
        x: this.x + (this.facing > 0 ? this.w : -8),
        y: this.y + this.h / 2 - 4,
        vx: this.facing * 7, life: 40
      });
    }
  }

  applyPhysics() {
    this.prevY = this.y;
    this.vy += GRAVITY;
    if (this.dashTimer > 0) this.dashTimer--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.invuln > 0) this.invuln--;

    this.x += this.vx; this.resolve('x');
    this.y += this.vy; this.resolve('y');

    if (this.vy < 0) {
      for (const t of tiles) {
        if (t.type !== 'brick' && t.type !== 'question') continue;
        if (!intersect(this.rect, t)) continue;
        if (this.prevY + this.h <= t.y + 2) hitBlock(t);
      }
    }

    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > levelW) { this.x = levelW - this.w; this.vx = 0; }
    if (this.y > canvas.height + 100) this.die();

    this.animTimer++;
    if (Math.abs(this.vx) > 0.5 && this.onGround) {
      if (this.animTimer % 6 === 0) this.anim = (this.anim + 1) % 4;
    } else { this.anim = 0; }
  }

  resolve(axis) {
    const r = this.rect;
    for (const t of tiles) {
      if (!intersect(r, t)) continue;
      if (t.type === 'coin' || t.type === 'mushroom' || t.type === 'flower') continue;

      if (axis === 'x') {
        if (this.vx > 0) { this.x = t.x - this.w; this.vx = 0; }
        else if (this.vx < 0) { this.x = t.x + t.w; this.vx = 0; }
      } else {
        if (this.vy > 0) {
          const wasAbove = this.y + this.h - this.vy <= t.y + 2;
          const isPlatform = t.type === 'platform';
          if (!isPlatform || wasAbove) {
            this.y = t.y - this.h; this.vy = 0;
            this.onGround = true; this.jumpsLeft = MAX_JUMPS;
          }
        } else if (this.vy < 0) {
          this.y = t.y + t.h; this.vy = 0;
        }
      }
    }

    if (axis === 'y' && this.onGround) {
      const feet = { x: this.x + 2, y: this.y + this.h + 1, w: this.w - 4, h: 1 };
      let support = false;
      for (const t of tiles) {
        if (isSolid(t) && intersect(feet, t)) { support = true; break; }
      }
      this.onGround = support;
    }
  }

  die() {
    if (this.invuln > 0 || this.dead) return;
    if (this.state === STATE.SMALL) { this.dead = true; }
    else {
      this.invuln = 60;
      const prev = this.state;
      this.state = STATE.SMALL; this.setSize();
      spawnParticles(this.x + this.w / 2, this.y + this.h / 2, STATE_COLOR[STATE_NAME[prev]], 14);
      addFloat(this.x + this.w / 2, this.y, '¡Daño!');
    }
  }

  grow(toState) {
    if (this.state === toState) return;
    this.state = toState; this.setSize();
    this.invuln = 40;
    spawnParticles(this.x + this.w / 2, this.y + this.h / 2, STATE_COLOR[STATE_NAME[this.state]], 16);
    addFloat(this.x + this.w / 2, this.y, toState === STATE.FIRE ? '¡FUEGO!' : '¡GRANDE!');
  }

  draw(camX) {
    if (this.dead) return;
    const flash = this.invuln > 0 && Math.floor(Date.now() / 60) % 2 === 0;
    if (flash) return;
    const c = STATE_COLOR[STATE_NAME[this.state]];

    ctx.save(); ctx.translate(this.x - camX, this.y);

    ctx.fillStyle = c; ctx.fillRect(0, 0, this.w, this.h);

    if (this.state !== STATE.SMALL) {
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(6, 6, 4, this.state === STATE.BIG ? 20 : 12);
      ctx.fillRect(this.w - 10, 6, 4, this.state === STATE.BIG ? 20 : 12);
    }
    if (this.state === STATE.FIRE) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(this.w / 2, -6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e67e22'; ctx.fillRect(this.w / 2 - 2, -12, 4, 6);
    }

    ctx.fillStyle = '#fff';
    const ex = this.facing > 0 ? this.w - 10 : 6;
    ctx.fillRect(ex, 8, 6, 6);
    ctx.fillStyle = '#000'; ctx.fillRect(ex + 2, 10, 2, 2);

    ctx.restore();
  }
}

const player = new Player(TILE * 2, (ROWS - 2) * TILE - 40);

// ==================== Entidades ====================
function spawnParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 1,
      life: 20 + Math.random() * 20, color
    });
  }
}
function addFloat(x, y, text) { floats.push({ x, y, text, life: 60, vy: -0.5 }); }
function intersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hitBlock(t) {
  if (t.type === 'brick') {
    spawnParticles(t.x + t.w / 2, t.y + t.h / 2, '#c0392b', 12);
    addFloat(t.x + t.w / 2, t.y, '+100'); score += 100;
    t.type = 'used';
  } else if (t.type === 'question' && t.content) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    spawnParticles(cx, cy, '#f1c40f', 8);
    addFloat(cx, cy, '+50'); score += 50;
    if (t.content === 'coin') {
      coinCount++; addFloat(cx, cy, '+100'); score += 100;
    } else {
      powerUps.push({ x: cx - 8, y: cy - 16, type: t.content, taken: false, vy: -2 });
    }
    t.type = 'used'; t.content = null;
  }
}

function updateCoinsAndPowerups() {
  for (const c of coins) {
    if (c.taken) continue;
    if (intersect(player.rect, { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 })) {
      c.taken = true; score += 100; coinCount++;
      spawnParticles(c.x, c.y, '#f1c40f', 6);
      addFloat(c.x, c.y, '+100');
    }
  }
  for (const p of powerUps) {
    if (p.taken) continue;
    p.vy += GRAVITY; p.y += p.vy;
    for (const t of tiles) {
      if (isSolid(t) && intersect({ x: p.x, y: p.y, w: 16, h: 16 }, t)) {
        if (p.vy > 0) { p.y = t.y - 16; p.vy = 0; }
      }
    }
    if (intersect(player.rect, { x: p.x, y: p.y, w: 16, h: 16 })) {
      p.taken = true;
      spawnParticles(p.x + 8, p.y + 8, '#f1c40f', 10);
      if (p.type === 'mushroom') player.grow(STATE.BIG);
      else player.grow(STATE.FIRE);
    }
  }
}
function updateFireballs() {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.x += f.vx; f.life--;
    let hit = false;
    for (const t of tiles) {
      if ((t.type === 'ground' || t.type === 'platform') && intersect({ x: f.x, y: f.y, w: 8, h: 8 }, t)) { hit = true; break; }
    }
    for (const e of enemies) {
      if (e.state !== 'dead' && intersect({ x: f.x, y: f.y, w: 8, h: 8 }, e.rect)) { killEnemy(e); hit = true; break; }
    }
    if (hit || f.life <= 0) fireballs.splice(i, 1);
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function updateFloats() {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.y += f.vy; f.life--;
    if (f.life <= 0) floats.splice(i, 1);
  }
}
function updateEnemies() { for (const e of enemies) e.update(); }

function killEnemy(e) {
  e.state = 'dead'; e.dead = true; e.stompTimer = 20;
  if (e.type === 'goomba') e.h = 14;
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.type === 'goomba' ? '#a04000' : '#27ae60', 8);
  addFloat(e.x + e.w / 2, e.y, '+100'); score += 100;
}

function checkEnemyCollisions() {
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    if (!intersect(player.rect, e.rect)) continue;

    const stomp = player.vy > 0 && player.prevY + player.h <= e.y + e.h / 2 + 4;

    if (stomp) {
      if (e.type === 'goomba') { killEnemy(e); player.vy = -7; player.jumpsLeft = MAX_JUMPS; }
      else {
        if (e.state === 'walk') {
          e.state = 'shell'; e.h = 16; e.y += 16; e.vx = 0;
          player.vy = -7; player.jumpsLeft = MAX_JUMPS; score += 100;
          addFloat(player.x + player.w / 2, player.y, '+100');
        } else if (e.state === 'shell') {
          const dir = player.x < e.x ? -1 : 1;
          e.vx = dir * 5; player.vy = -6; player.jumpsLeft = MAX_JUMPS;
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#27ae60', 6);
        }
      }
    } else {
      if (e.state === 'shell' && Math.abs(e.vx) > 0.3) {
        const dir = player.x < e.x ? -1 : 1;
        e.vx = dir * 5; player.vy = -6;
      } else { player.die(); }
    }
  }
}

function updateShellsVsEnemies() {
  for (const e of enemies) {
    if (e.state !== 'shell' || Math.abs(e.vx) <= 0.3) continue;
    for (const o of enemies) {
      if (o === e || o.state === 'dead') continue;
      if (intersect(e.rect, o.rect)) killEnemy(o);
    }
  }
}

// ==================== Estado del juego ====================
let score = 0;
let coinCount = 0;
let camX = 0;

// ==================== Dibujo ====================
function drawLevel(camX) {
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(140 - camX * 0.15, 50, 40, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.translate(-camX, 0);

  for (const t of tiles) {
    if (t.type === 'coin' || t.type === 'mushroom' || t.type === 'flower') continue;
    if (t.type === 'ground') ctx.fillStyle = '#2ecc71';
    else if (t.type === 'platform') ctx.fillStyle = '#95a5a6';
    else if (t.type === 'pipe') {
      ctx.fillStyle = t.x === EXIT_PIPE_X * TILE || t.x === (EXIT_PIPE_X + 1) * TILE ? '#c0392b' : '#27ae60';
    }
    else if (t.type === 'flag') ctx.fillStyle = '#e74c3c';
    else if (t.type === 'brick') ctx.fillStyle = '#c0392b';
    else if (t.type === 'question') ctx.fillStyle = '#f1c40f';
    else if (t.type === 'used') ctx.fillStyle = '#bdc3c7';
    else ctx.fillStyle = '#95a5a6';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(t.x, t.y, t.w, t.h);

    if (t.type === 'pipe') {
      const isExit = t.x === EXIT_PIPE_X * TILE || t.x === (EXIT_PIPE_X + 1) * TILE;
      ctx.fillStyle = isExit ? '#a93226' : '#1e8449';
      ctx.fillRect(t.x, t.y, t.w, 7);
      ctx.fillStyle = isExit ? '#c0392b' : '#27ae60';
      ctx.fillRect(t.x + 2, t.y + 2, t.w - 4, 4);
      if (isExit) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
        ctx.fillText('META', t.x + 4, t.y + 20);
      }
    }
    if (t.type === 'brick') {
      ctx.strokeStyle = '#a93226'; ctx.strokeRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4);
    }
    if (t.type === 'question') {
      ctx.fillStyle = '#b7950b'; ctx.font = 'bold 22px Arial';
      ctx.fillText('?', t.x + t.w / 2 - 6, t.y + t.h - 4);
    }
    if (t.type === 'flag') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }
  }

  for (const c of coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b7950b'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  }

  for (const p of powerUps) {
    if (p.taken) continue;
    ctx.fillStyle = p.type === 'mushroom' ? '#e74c3c' : '#e67e22';
    ctx.fillRect(p.x, p.y, 16, 16);
    if (p.type === 'flower') { ctx.fillStyle = '#f1c40f'; ctx.fillRect(p.x + 4, p.y + 4, 8, 8); }
  }

  for (const e of enemies) e.draw(camX);

  for (const f of fireballs) {
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(f.x + 4, f.y + 4, 4, 0, Math.PI * 2); ctx.fill();
  }

  for (const p of particles) {
    ctx.globalAlpha = p.life / 40; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1;
  }

  for (const f of floats) {
    ctx.globalAlpha = f.life / 60; ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial'; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
  }

  ctx.restore();
  player.draw(camX);
}

function drawWinScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('¡NIVEL COMPLETADO!', canvas.width / 2 - 200, canvas.height / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText(`Monedas: ${coinCount}   Puntuación: ${score}`, canvas.width / 2 - 140, canvas.height / 2 + 10);
  ctx.fillText('Pulsa ARRIBA para reiniciar', canvas.width / 2 - 150, canvas.height / 2 + 50);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, canvas.width, 34);
  ctx.fillStyle = '#fff'; ctx.font = '18px Arial';
  ctx.fillText(`MONEDAS: ${coinCount}   PUNTUACIÓN: ${score}`, 16, 24);
  ctx.fillStyle = STATE_COLOR[STATE_NAME[player.state]];
  ctx.fillText(`ESTADO: ${STATE_NAME[player.state].toUpperCase()}`, 320, 24);
  if (player.dashCd > 0) {
    ctx.fillStyle = '#ffeb3b';
    ctx.fillText(`DASH: ${Math.ceil(player.dashCd / 30)}s`, 500, 24);
  }
  if (player.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial';
    ctx.fillText('GAME OVER', canvas.width / 2 - 85, canvas.height / 2 - 10);
    ctx.font = '18px Arial';
    ctx.fillText('Pulsa ARRIBA para reiniciar', canvas.width / 2 - 130, canvas.height / 2 + 30);
  }
}

// ==================== Bucle ====================
function loop() {
  if (gameWon && !winShown) {
    winShown = true;
  }

  if (player.dead && (pressed('ArrowUp') || pressed(' '))) {
    player.reset(TILE * 2, (ROWS - 2) * TILE - 40);
    camX = 0;
    consume('ArrowUp'); consume(' ');
  }

  if (gameWon && (pressed('ArrowUp') || pressed(' '))) {
    gameWon = false; winShown = false;
    score = 0; coinCount = 0; camX = 0;
    coins.forEach(c => c.taken = false);
    powerUps.forEach(p => p.taken = false);
    tiles.forEach(t => { if (t.type === 'used') t.type = t.type === 'used' ? (t.content ? 'question' : 'brick') : t.type; });
    player.reset(TILE * 2, (ROWS - 2) * TILE - 40);
    enemies.forEach(e => { e.state = 'walk'; e.dead = false; e.stompTimer = 0; e.vx = e.facing * e.walkSpeed; e.x = e.x; });
    consume('ArrowUp'); consume(' ');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameWon) {
    player.input();
    player.applyPhysics();
    updateCoinsAndPowerups();
    updateFireballs();
    updateEnemies();
    updateShellsVsEnemies();
    checkEnemyCollisions();
    updateParticles();
    updateFloats();

    // Meta: tocar el tubo de salida
    const exitRect = { x: EXIT_PIPE_X * TILE, y: EXIT_PIPE_Y * TILE, w: TILE * 2, h: TILE * 3 };
    if (intersect(player.rect, exitRect)) {
      gameWon = true;
    }

    // Cámara sigue al jugador
    let targetCam = player.x - canvas.width / 2;
    camX += (targetCam - camX) * 0.12;
    const maxCam = Math.max(0, levelW - canvas.width);
    if (camX < 0) camX = 0;
    if (camX > maxCam) camX = maxCam;
  }

  drawLevel(camX);
  drawHUD();
  if (gameWon) drawWinScreen();

  requestAnimationFrame(loop);
}

loop();

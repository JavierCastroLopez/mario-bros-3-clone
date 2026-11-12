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
const COLS = 60;
const ROWS = 16;
const levelW = COLS * TILE;

// tiles: {x, y, w, h, type}  type: 'ground' | 'platform' | 'coin' | 'mushroom' | 'flower'
const tiles = [];
const coins = [];
const powerUps = [];
const fireballs = [];
const particles = [];
const floats = [];

function addTile(x, y, type) {
  tiles.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE, type });
}

// Suelo base (2 filas)
for (let c = 0; c < COLS; c++) {
  addTile(c, ROWS - 1, 'ground');
  addTile(c, ROWS - 2, 'ground');
}

// Plataformas flotantes [cx, cy, largo]
const platforms = [
  [10, 10, 4], [18, 9, 3], [26, 8, 4], [34, 9, 3], [42, 10, 4],
  [14, 6, 3], [22, 7, 3], [30, 6, 3], [38, 7, 3], [46, 8, 3],
  [8, 11, 3], [52, 11, 3]
];
platforms.forEach(([cx, cy, len]) => {
  for (let i = 0; i < len; i++) addTile(cx + i, cy, 'platform');
});

// Monedas
const coinPos = [
  [12, 7], [14, 7], [16, 7], [20, 6], [22, 6], [28, 5], [30, 5],
  [36, 6], [38, 6], [44, 7], [46, 7], [50, 5], [52, 5], [55, 6],
  [10, 10], [20, 9], [30, 8], [40, 9], [50, 10]
];
coinPos.forEach(([cx, cy]) => {
  coins.push({ x: cx * TILE + 8, y: cy * TILE - TILE, r: 6, taken: false });
});

// Power-ups
powerUps.push({ x: 10 * TILE + 8, y: 5 * TILE - TILE, type: 'mushroom', taken: false, vy: 0 });
powerUps.push({ x: 30 * TILE + 8, y: 8 * TILE - TILE, type: 'flower', taken: false, vy: 0 });

// ==================== Jugador ====================
class Player {
  constructor(x, y) { this.reset(x, y); }
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.state = STATE.SMALL;
    this.setSize();
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpsLeft = MAX_JUMPS;
    this.facing = 1;
    this.anim = 0;
    this.animTimer = 0;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.fireCd = 0;
    this.invuln = 0;
    this.dead = false;
  }
  setSize() {
    const s = sizeFor(this.state);
    const feet = this.y + this.h;
    this.w = s.w;
    this.h = s.h;
    this.y = feet - this.h;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  input() {
    if (this.dead) return;
    const moving = keys.left || keys.right;
    if (keys.right) { this.facing = 1; this.vx += ACCEL; }
    if (keys.left) { this.facing = -1; this.vx -= ACCEL; }
    if (!moving) this.vx *= FRICTION;

    // Dash rápido (Shift) con enfriamiento
    if (pressed('Shift') && this.dashCd <= 0 && this.dashTimer <= 0) {
      this.dashTimer = DASH_FRAMES;
      this.dashCd = DASH_COOLDOWN;
      this.vx = this.facing * DASH_SPEED;
    }
    consume('Shift');

    // Salto: requiere tocar arriba, doble salto limitado
    if (pressed('ArrowUp') || pressed(' ')) {
      if (this.jumpsLeft > 0) {
        this.vy = JUMP_FORCE;
        this.jumpsLeft--;
        this.onGround = false;
        this.anim = 0;
      }
    }
    consume('ArrowUp');
    consume(' ');

    // Bola de fuego (solo estado FUEGO, tecla Z/X)
    if (this.state === STATE.FIRE && this.fireCd <= 0 && (pressed('z') || pressed('Z') || pressed('x') || pressed('X'))) {
      consume('z'); consume('Z'); consume('x'); consume('X');
      this.fireCd = 20;
      fireballs.push({
        x: this.x + (this.facing > 0 ? this.w : -8),
        y: this.y + this.h / 2 - 4,
        vx: this.facing * 7,
        life: 40
      });
    }
  }

  applyPhysics() {
    this.vy += GRAVITY;
    if (this.dashTimer > 0) this.dashTimer--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.fireCd > 0) this.fireCd--;
    if (this.invuln > 0) this.invuln--;

    // Mover X y resolver colisiones de pared
    this.x += this.vx;
    this.resolve('x');
    // Mover Y y resolver colisiones de suelo
    this.y += this.vy;
    this.resolve('y');

    // Límites del mundo
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > levelW) { this.x = levelW - this.w; this.vx = 0; }
    if (this.y > canvas.height + 100) this.die();

    // Animación
    this.animTimer++;
    if (Math.abs(this.vx) > 0.5 && this.onGround) {
      if (this.animTimer % 6 === 0) this.anim = (this.anim + 1) % 4;
    } else {
      this.anim = 0;
    }
  }

  resolve(axis) {
    const r = this.rect;
    for (const t of tiles) {
      if (!intersect(r, t)) continue;
      if (t.type === 'coin' || t.type === 'mushroom' || t.type === 'flower') continue;

      if (axis === 'x') {
        // Pared: frenar contra el lateral
        if (this.vx > 0) { this.x = t.x - this.w; this.vx = 0; }
        else if (this.vx < 0) { this.x = t.x + t.w; this.vx = 0; }
      } else {
        // Suelo / techo
        if (this.vy > 0) {
          const wasAbove = this.y + this.h - this.vy <= t.y + 2;
          const isPlatform = t.type === 'platform';
          // Plataformas: solo sólidas por arriba
          if (!isPlatform || wasAbove) {
            this.y = t.y - this.h;
            this.vy = 0;
            this.onGround = true;
            this.jumpsLeft = MAX_JUMPS;
          }
        } else if (this.vy < 0) {
          this.y = t.y + t.h;
          this.vy = 0;
        }
      }
    }

    // Si no hay soporte bajo los pies, no estamos en el suelo
    if (axis === 'y' && this.onGround) {
      const feet = { x: this.x + 2, y: this.y + this.h + 1, w: this.w - 4, h: 1 };
      let support = false;
      for (const t of tiles) {
        if ((t.type === 'ground' || t.type === 'platform') && intersect(feet, t)) { support = true; break; }
      }
      this.onGround = support;
    }
  }

  die() {
    if (this.invuln > 0 || this.dead) return;
    if (this.state === STATE.SMALL) {
      this.dead = true;
    } else {
      // Encogerse al recibir daño
      this.invuln = 60;
      const prev = this.state;
      this.state = STATE.SMALL;
      this.setSize();
      spawnParticles(this.x + this.w / 2, this.y + this.h / 2, STATE_COLOR[STATE_NAME[prev]], 14);
      addFloat(this.x + this.w / 2, this.y, '¡Daño!');
    }
  }

  grow(toState) {
    if (this.state === toState) return;
    this.state = toState;
    this.setSize();
    this.invuln = 40;
    spawnParticles(this.x + this.w / 2, this.y + this.h / 2, STATE_COLOR[STATE_NAME[this.state]], 16);
    addFloat(this.x + this.w / 2, this.y, toState === STATE.FIRE ? '¡FUEGO!' : '¡GRANDE!');
  }

  draw(camX) {
    if (this.dead) return;
    const flash = this.invuln > 0 && Math.floor(Date.now() / 60) % 2 === 0;
    if (flash) return;
    const c = STATE_COLOR[STATE_NAME[this.state]];

    ctx.save();
    ctx.translate(this.x - camX, this.y);

    // Cuerpo
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, this.w, this.h);

    // Detalle según estado
    if (this.state !== STATE.SMALL) {
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(6, 6, 4, this.state === STATE.BIG ? 20 : 12);
      ctx.fillRect(this.w - 10, 6, 4, this.state === STATE.BIG ? 20 : 12);
    }
    if (this.state === STATE.FIRE) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(this.w / 2, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(this.w / 2 - 2, -12, 4, 6);
    }

    // Ojos
    ctx.fillStyle = '#fff';
    const ex = this.facing > 0 ? this.w - 10 : 6;
    ctx.fillRect(ex, 8, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(ex + 2, 10, 2, 2);

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
      life: 20 + Math.random() * 20,
      color
    });
  }
}
function addFloat(x, y, text) {
  floats.push({ x, y, text, life: 60, vy: -0.5 });
}
function intersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateCoinsAndPowerups() {
  for (const c of coins) {
    if (c.taken) continue;
    if (intersect(player.rect, { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 })) {
      c.taken = true;
      score += 100;
      coinCount++;
      spawnParticles(c.x, c.y, '#f1c40f', 6);
      addFloat(c.x, c.y, '+100');
    }
  }
  for (const p of powerUps) {
    if (p.taken) continue;
    p.vy += GRAVITY;
    p.y += p.vy;
    for (const t of tiles) {
      if ((t.type === 'ground' || t.type === 'platform') && intersect({ x: p.x, y: p.y, w: 16, h: 16 }, t)) {
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
    f.x += f.vx;
    f.life--;
    let hit = false;
    for (const t of tiles) {
      if ((t.type === 'ground' || t.type === 'platform') && intersect({ x: f.x, y: f.y, w: 8, h: 8 }, t)) { hit = true; break; }
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
    const f = floats[i];
    f.y += f.vy; f.life--;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

// ==================== Estado del juego ====================
let score = 0;
let coinCount = 0;
let camX = 0;

// ==================== Dibujo ====================
function drawLevel(camX) {
  // Fondo
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(140 - camX * 0.15, 50, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-camX, 0);

  // Tiles sólidos y plataformas
  for (const t of tiles) {
    if (t.type === 'coin' || t.type === 'mushroom' || t.type === 'flower') continue;
    ctx.fillStyle = t.type === 'ground' ? '#2ecc71' : '#95a5a6';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(t.x, t.y, t.w, t.h);
  }

  // Monedas amarillas
  for (const c of coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b7950b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Power-ups
  for (const p of powerUps) {
    if (p.taken) continue;
    ctx.fillStyle = p.type === 'mushroom' ? '#e74c3c' : '#e67e22';
    ctx.fillRect(p.x, p.y, 16, 16);
    if (p.type === 'flower') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(p.x + 4, p.y + 4, 8, 8);
    }
  }

  // Bolas de fuego
  for (const f of fireballs) {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(f.x + 4, f.y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Partículas
  for (const p of particles) {
    ctx.globalAlpha = p.life / 40;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  // Textos flotantes
  for (const f of floats) {
    ctx.globalAlpha = f.life / 60;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Jugador (dibuja su propia traslación)
  player.draw(camX);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, canvas.width, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
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
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('GAME OVER', canvas.width / 2 - 85, canvas.height / 2 - 10);
    ctx.font = '18px Arial';
    ctx.fillText('Pulsa ARRIBA para reiniciar', canvas.width / 2 - 130, canvas.height / 2 + 30);
  }
}

// ==================== Bucle ====================
function loop() {
  if (player.dead && (pressed('ArrowUp') || pressed(' '))) {
    player.reset(TILE * 2, (ROWS - 2) * TILE - 40);
    consume('ArrowUp'); consume(' ');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  player.input();
  player.applyPhysics();
  updateCoinsAndPowerups();
  updateFireballs();
  updateParticles();
  updateFloats();

  // Cámara sigue al jugador
  let targetCam = player.x - canvas.width / 2;
  camX += (targetCam - camX) * 0.12;
  const maxCam = Math.max(0, levelW - canvas.width);
  if (camX < 0) camX = 0;
  if (camX > maxCam) camX = maxCam;

  drawLevel(camX);
  drawHUD();

  requestAnimationFrame(loop);
}

loop();

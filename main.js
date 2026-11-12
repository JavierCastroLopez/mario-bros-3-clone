const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Configuración ---
const GRAVITY = 0.8;
const FRICTION = 0.8;
const ACCEL = 0.6;
const MAX_SPEED = 5;
const JUMP_FORCE = -14;
const GROUND_HEIGHT = 40;

// --- Entrada de teclado ---
const keys = {
  left: false,
  right: false,
  up: false
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === 'ArrowUp') keys.up = true;
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'ArrowUp') keys.up = false;
});

// --- Jugador ---
class Player {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.color = '#e74c3c';
  }

  update() {
    // Movimiento horizontal
    if (keys.left) this.vx -= ACCEL;
    if (keys.right) this.vx += ACCEL;

    // Fricción
    this.vx *= FRICTION;

    // Límite de velocidad horizontal
    if (this.vx > MAX_SPEED) this.vx = MAX_SPEED;
    if (this.vx < -MAX_SPEED) this.vx = -MAX_SPEED;

    // Salto (solo si está en el suelo)
    if (keys.up && this.onGround) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
    }

    // Gravedad
    this.vy += GRAVITY;

    // Aplicar velocidad
    this.x += this.vx;
    this.y += this.vy;

    // Colisión con el suelo
    const groundY = canvas.height - GROUND_HEIGHT;
    if (this.y + this.h > groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    // Colisión con los bordes laterales
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x + this.w > canvas.width) {
      this.x = canvas.width - this.w;
      this.vx = 0;
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

const player = new Player(50, canvas.height - GROUND_HEIGHT - 40, 32, 40);

// --- Bucle de juego ---
function drawFloor() {
  const groundY = canvas.height - GROUND_HEIGHT;
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);
}

function loop() {
  // Limpiar pantalla
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dibujar suelo
  drawFloor();

  // Actualizar y dibujar jugador
  player.update();
  player.draw();

  requestAnimationFrame(loop);
}

loop();

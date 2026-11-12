# SOLUCIONES_BUGS.md

Repositorio: `/tmp/mario-bros-3-clone`
Archivo revisado: `main.js` (commit `90fe846`, 800 líneas)
Archivo modificado: **ninguno** — `main.js` NO se modifica. Este documento recopila la solución detallada de cada bug, lista para aplicar manualmente.
Fecha: 12 de noviembre de 2026

## Índice de bugs

| ID | Severidad | Bug | Líneas principales |
|---|---|---|---|
| C1 | Crítico | El juego no arranca: `score`/`coinCount` leídos antes de declararse (TDZ) | 488, 625-626 |
| A1 | Alto | Pisotón (stomp) falla al caer desde altura; el jugador muere en lugar de matar al enemigo | 590, 334 |
| A2 | Alto | Los enemigos no recuperan su orientación (`facing`) al reiniciar el nivel | 476-483, 167-178 |
| M1 | Medio | Reinicio tras victoria no restablece los enemigos a sus spawns | 755-764 (espec. 762) |
| M2 | Medio | `fireballs` no se vacía al reiniciar; bolas de fuego huérfanas persisten | 468-486, 549-562 |
| B1 | Bajo | Salto infinito encadenando pisotones sobre enemigos | 593, 597, 601 |
| B2 | Bajo | Gravedad sin velocidad terminal (caída sin límite) | 334 |
| B3 | Bajo | `winShown` se asigna pero nunca se usa (código muerto) | 63, 744-746, 756 |
| B4 | Bajo | Aceleración en dash se suma sobre `DASH_SPEED` | 303-305, 307-311 |
| B5 | Bajo | Goomba muerto se hunde en el suelo | 578-581 |

Nota: los bugs B1-B4 del `REVIEW.md` original ya estaban corregidos en `90fe846`; este documento cubre los hallazgos de `BUG_REPORT_2.md` (C1, A1, A2, M1, M2, B1-B5).

---

### C1 — Crítico: el juego no arranca (TDZ de score/coinCount)

#### Problema
Al cargar `index.html` el script se detiene con `ReferenceError: score is not defined` (y `player`, `gameWon` y demás globales tampoco existen). El juego nunca inicia: no hay bucle `loop`, no hay jugador, no hay render.

#### Causa raíz
`captureInitialState()` se invoca en la línea 488 y lee `score` y `coinCount` (líneas 464-465) para guardar el estado inicial. Esas variables se declaran con `let` en las líneas 625 y 626, **después** de la llamada. Como `let` permanece en la "zona muerta temporal" desde el inicio del ámbito hasta su declaración, acceder a ellas antes lanza `ReferenceError` y el script se detiene en frío.

#### Líneas afectadas
- 464-465: lectura de `score` / `coinCount` dentro de `captureInitialState()`
- 488: llamada `captureInitialState()`
- 625-626: declaración `let score = 0; let coinCount = 0;` (demasiado tarde)

#### Corrección
Mover `let score = 0;` y `let coinCount = 0;` por encima de la llamada a `captureInitialState()` (justo tras `initialCoinCount`) y eliminar la declaración duplicada de las líneas 625-626.

#### Código corregido (listo para copiar y pegar)

Antes (líneas 449-454):
```js
let initialTiles = null;
let initialCoins = null;
let initialPowerUps = null;
let initialEnemies = null;
let initialScore = 0;
let initialCoinCount = 0;
```

Después:
```js
let initialTiles = null;
let initialCoins = null;
let initialPowerUps = null;
let initialEnemies = null;
let initialScore = 0;
let initialCoinCount = 0;
let score = 0;
let coinCount = 0;
```

Antes (líneas 625-627):
```js
let score = 0;
let coinCount = 0;
let camX = 0;
```

Después:
```js
let camX = 0;
```

#### Verificación
Cargar `index.html`: ya no hay `ReferenceError`, `loop()` arranca, aparece el jugador y el HUD muestra monedas y puntuación en 0.

---

### A1 — Alto: el pisotón falla al caer desde altura

#### Problema
Al caer sobre un enemigo desde gran altura, el jugador muere (`player.die()`) en lugar de matar al enemigo con un pisotón.

#### Causa raíz
`checkEnemyCollisions` detecta el stomp en la línea 590 con:

```js
const stomp = player.vy > 0 && player.prevY + player.h <= e.y + e.h / 2 + 4;
```

`prevY` se actualiza en `applyPhysics` (línea 333) antes de aplicar la gravedad. Sin velocidad terminal (bug B2), `vy` crece sin límite y, al caer desde muy arriba, `prevY` queda muy por encima del enemigo, por lo que la condición falla aunque el jugador aterrice encima. El impacto se trata como golpe lateral y se ejecuta `player.die()`.

#### Causa relacionada (B2)
`this.vy += GRAVITY` en la línea 334 no tiene techo, por lo que la velocidad de caída crece indefinidamente y agrava el falso negativo del stomp.

#### Líneas afectadas
- 333-334: `applyPhysics` actualiza `prevY` y `vy` sin tope
- 590: condición del stomp basada en `prevY`

#### Corrección (A1 + B2 juntas)
1. Añadir constante `MAX_FALL_SPEED` y limitar `vy` en `applyPhysics` (línea 334).
2. Basar el stomp en la posición actual del pie (`player.y + player.h`) frente a la mitad del enemigo, no solo en `prevY`, manteniendo `player.vy > 0` (cayendo).

También se añade la constante `MAX_FALL_SPEED` tras `MAX_JUMPS`.

#### Código corregido (listo para copiar y pegar)

Añadir tras la línea 13 (`const MAX_JUMPS = 2;`):
```js
const MAX_JUMPS = 2;
const MAX_FALL_SPEED = 25; // velocidad terminal de caída (evita tunelado y fixea A1)
```

En `applyPhysics`, tras `this.vy += GRAVITY;` (línea 334):
```js
  applyPhysics() {
    this.prevY = this.y;
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED; // <-- B2: tope de caída
    if (this.dashTimer > 0) this.dashTimer--;
    ...
```

En `checkEnemyCollisions`, reemplazar la línea 590:
```js
    const stomp = player.vy > 0 && player.y + player.h <= e.y + e.h / 2 + 4;
```

#### Verificación
Caer desde lo más alto del nivel sobre un goomba/koopa mata al enemigo y hace rebotar al jugador en lugar de matarlo.

---

### A2 — Alto: los enemigos no recuperan `facing` al reiniciar el nivel

#### Problema
Tras un reinicio de nivel, un enemigo que iba mirando a la izquierda (`facing = -1`) revive mirando a la derecha aunque se mueva hacia la izquierda; el sensor de pared y el dibujo quedan incoherentes.

#### Causa raíz
`resetLevel()` (líneas 476-483) recrea los enemigos con `new Enemy` (que fija `facing = 1` y `vx = facing * walkSpeed` en el constructor, líneas 167-178) y luego sobreescribe `vx` con el valor guardado, pero **nunca restaura `en.facing`**. Si el enemigo inicial llevaba `facing = -1`, se pierde.

#### Líneas afectadas
- 476-483: reconstrucción de enemigos en `resetLevel()`
- 167-178: constructor de `Enemy` (fija `facing = 1`)

#### Corrección
Restaurar `en.facing = e.facing` dentro del `.map` de `resetLevel()`.

#### Código corregido (listo para copiar y pegar)

Antes (líneas 475-483):
```js
  enemies.length = 0;
  enemies.push(...initialEnemies.map(e => {
    const en = new Enemy(e.x, e.y, e.type);
    en.state = e.state;
    en.dead = e.dead;
    en.stompTimer = e.stompTimer;
    en.vx = e.vx;
    return en;
  }));
```

Después:
```js
  enemies.length = 0;
  enemies.push(...initialEnemies.map(e => {
    const en = new Enemy(e.x, e.y, e.type);
    en.state = e.state;
    en.dead = e.dead;
    en.stompTimer = e.stompTimer;
    en.vx = e.vx;
    en.facing = e.facing; // <-- A2: restaurar orientación del enemigo
    return en;
  }));
```

#### Verificación
Reiniciar el nivel (Game Over o victoria): los enemigos reviven mirando en la misma dirección en que se movían, y el sensor de pared/dibujo queda coherente.

---

### M1 — Medio: el reinicio tras victoria no restablece los enemigos a sus spawns

#### Problema
Al reiniciar tras ganar (`gameWon`), score, monedas, tiles y jugador se resetean, pero los enemigos se quedan en la posición donde estaban al ganar: `e.x = e.x` no hace nada, y no se restauran desde `initialEnemies`. Al volver a jugar, los enemigos ya no están en sus puntos de aparición.

#### Causa raíz
En el bloque de reinicio por victoria (líneas 755-764), la línea 762 itera los enemigos existentes y les asigna `e.x = e.x` (asignación nula) en lugar de reconstruirlos desde `initialEnemies` con sus coordenadas de spawn, estado, orientación y velocidad originales.

#### Líneas afectadas
- 755-764: bloque `if (gameWon && (pressed('ArrowUp') || pressed(' ')))`
- 762: `enemies.forEach(e => { ... e.x = e.x; })`

#### Corrección
Sustituir el `enemies.forEach` por una reconstrucción real de los enemigos desde `initialEnemies`, restaurando `x`, `y`, `state`, `dead`, `stompTimer`, `facing` y `vx`.

#### Código corregido (listo para copiar y pegar)

Antes (línea 762):
```js
    enemies.forEach(e => { e.state = 'walk'; e.dead = false; e.stompTimer = 0; e.vx = e.facing * e.walkSpeed; e.x = e.x; });
```

Después:
```js
    enemies.length = 0;
    enemies.push(...initialEnemies.map(e => { // <-- M1: restaurar enemigos desde sus spawns
      const en = new Enemy(e.x, e.y, e.type);
      en.state = 'walk';
      en.dead = false;
      en.stompTimer = 0;
      en.facing = e.facing;
      en.vx = e.facing * e.walkSpeed;
      return en;
    }));
```

#### Verificación
Ganar el nivel, pulsar ARRIBA para reiniciar y volver a jugar: todos los enemigos aparecen de nuevo en sus puntos de aparición originales y mirando hacia su dirección inicial.

---

### M2 — Medio: `fireballs` no se vacía al reiniciar

#### Problema
`resetLevel()` restaura tiles, monedas, power-ups, enemigos, score y coinCount, pero no limpia `fireballs`. Las bolas de fuego activas siguen existiendo y actualizándose tras el reinicio, pudiendo matar enemigos o aparecer "huérfanas" en el nuevo nivel.

#### Causa raíz
`resetLevel()` (líneas 468-486) nunca vacía el array `fireballs` (ni `particles` ni `floats`).

#### Líneas afectadas
- 468-486: `resetLevel()`
- 549-562: `updateFireballs()` (usa el array sin vaciar)

#### Corrección
Añadir `fireballs.length = 0;` en `resetLevel()`, y opcionalmente vaciar `particles` y `floats` para un reinicio completamente limpio.

#### Código corregido (listo para copiar y pegar)

Al final de `resetLevel()`, tras `coinCount = initialCoinCount;` (línea 485):
```js
  score = initialScore;
  coinCount = initialCoinCount;
  fireballs.length = 0;   // <-- M2: no dejar bolas de fuego huérfanas tras reiniciar
  particles.length = 0;   // <-- M2 (opcional): limpiar partículas
  floats.length = 0;      // <-- M2 (opcional): limpiar textos flotantes
}
```

#### Verificación
Disparar bolas de fuego, reiniciar el nivel y confirmar que no queda ninguna bola de fuego activa ni partícula/texto flotante del nivel anterior.

---

### B1 — Bajo: salto infinito encadenando pisotones

#### Problema
Pisar un enemigo restaura `player.jumpsLeft = MAX_JUMPS` (2), lo que permite saltos ilimitados mientras se encadenan pisotones sobre enemigos.

#### Causa raíz
En `checkEnemyCollisions`, las tres ramas de stomp (goomba, koopa en estado `walk`, koopa en estado `shell`) asignan `player.jumpsLeft = MAX_JUMPS;` (líneas 593, 597 y 601), recuperando todos los saltos en lugar de conceder ninguno o solo uno extra.

#### Líneas afectadas
- 593: `player.jumpsLeft = MAX_JUMPS;` (pisotón a goomba)
- 597: `player.jumpsLeft = MAX_JUMPS;` (koopa -> caparazón)
- 601: `player.jumpsLeft = MAX_JUMPS;` (pisotón a caparazón en movimiento)

#### Corrección
No restaurar todos los saltos al pisotear: eliminar esas tres asignaciones. El jugador recibe el rebote (`vy` negativo) pero debe volver al suelo para recuperar saltos, como en el plataformas clásico.

#### Código corregido (listo para copiar y pegar)

Antes (líneas 592-603):
```js
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
    }
```

Después:
```js
    if (stomp) {
      if (e.type === 'goomba') { killEnemy(e); player.vy = -7; }
      else {
        if (e.state === 'walk') {
          e.state = 'shell'; e.h = 16; e.y += 16; e.vx = 0;
          player.vy = -7; score += 100;
          addFloat(player.x + player.w / 2, player.y, '+100');
        } else if (e.state === 'shell') {
          const dir = player.x < e.x ? -1 : 1;
          e.vx = dir * 5; player.vy = -6;
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#27ae60', 6);
        }
      }
    }
```

#### Verificación
Encadenar pisotones sobre varios enemigos sin tocar el suelo: tras el primer pisotón no se puede saltar de nuevo en el aire, rompiendo el salto infinito.

---

### B2 — Bajo: gravedad sin velocidad terminal

#### Problema
`this.vy += GRAVITY` sin límite superior; la velocidad de caída crece indefinidamente. Agrava el bug A1 (pisotón falso negativo) y puede causar tunelado en caídas muy largas.

#### Causa raíz
Línea 334 de `Player.applyPhysics()`: no hay tope en `vy`.

#### Líneas afectadas
- 334: `this.vy += GRAVITY;`

#### Corrección
Añadir la constante `MAX_FALL_SPEED` y limitar `vy` tras aplicarle la gravedad. (Mismo bloque de código que A1; ver sección A1 para el código corregido completo.)

#### Verificación
Caer desde gran altura: la velocidad de caída se estabiliza y el jugador no atraviesa suelo ni plataformas por tunelado.

---

### B3 — Bajo: `winShown` se asigna pero nunca se usa

#### Problema
`winShown = true` (líneas 744-746) no afecta a ningún comportamiento posterior; la pantalla de victoria ya se controla únicamente con `gameWon` (línea 795: `if (gameWon) drawWinScreen();`). Es código muerto y confunde el reinicio.

#### Causa raíz
`winShown` se declara en la línea 63, se asigna en 745 y se resetea en 756, pero nunca se lee en ninguna condición.

#### Líneas afectadas
- 63: `let winShown = false;`
- 744-746: bloque `if (gameWon && !winShown) { winShown = true; }`
- 756: `gameWon = false; winShown = false;`

#### Corrección
Eliminar `winShown` por completo: quitar la declaración, el bloque de asignación en `loop()` y su reseteo en el reinicio por victoria.

#### Código corregido (listo para copiar y pegar)

Eliminar la línea 63:
```js
// eliminar esta línea
let winShown = false;
```

Eliminar en `loop()` (líneas 744-746):
```js
  if (gameWon && !winShown) {
    winShown = true;
  }
```

En el reinicio por victoria (línea 756), antes:
```js
    gameWon = false; winShown = false;
```
después:
```js
    gameWon = false;
```

#### Verificación
Ganar el nivel, mostrar pantalla de victoria, reiniciar con ARRIBA y volver a jugar sin que quede estado "atrapado" de victoria previa.

---

### B4 — Bajo: aceleración en dash se suma sobre `DASH_SPEED`

#### Problema
Durante el dash, `input()` sigue aplicando `ACEL`, por lo que el jugador puede acelerar por encima de `DASH_SPEED` (16).

#### Causa raíz
En `Player.input()` (líneas 303-305 y 307-311), al pulsar derecha/izquierda se suma `ACEL` a `vx` sin comprobar si hay un dash activo (`dashTimer > 0`), que ya fijó `vx = facing * DASH_SPEED` en la línea 309.

#### Líneas afectadas
- 303-305: aplicación de `ACEL` y fricción
- 307-311: inicio del dash

#### Corrección
No aplicar `ACEL` ni fricción mientras `dashTimer > 0`; el dash conserva su velocidad fija.

#### Código corregido (listo para copiar y pegar)

Antes (líneas 302-305):
```js
    const moving = keys.left || keys.right;
    if (keys.right) { this.facing = 1; this.vx += ACCEL; }
    if (keys.left) { this.facing = -1; this.vx -= ACCEL; }
    if (!moving) this.vx *= FRICTION;
```

Después:
```js
    const moving = keys.left || keys.right;
    if (this.dashTimer <= 0) { // <-- B4: sin aceleración ni fricción durante el dash
      if (keys.right) { this.facing = 1; this.vx += ACCEL; }
      if (keys.left) { this.facing = -1; this.vx -= ACCEL; }
      if (!moving) this.vx *= FRICTION;
    }
```

#### Verificación
Durante el dash, la velocidad se mantiene en ±`DASH_SPEED` y no se incrementa aunque se mantenga pulsada la tecla de movimiento.

---

### B5 — Bajo: goomba muerto se hunde en el suelo

#### Problema
`killEnemy` reduce `e.h` de 32 a 14 en goombas sin ajustar `e.y`, por lo que la base sube y el goomba queda medio enterrado en el suelo. El koopa sí lo hace bien con `e.y += 16`.

#### Causa raíz
Línea 580: `if (e.type === 'goomba') e.h = 14;` cambia la altura pero no corrige la posición para mantener la base en el suelo.

#### Líneas afectadas
- 578-581: `killEnemy()`

#### Corrección
Ajustar `e.y` para que la base del goomba quede en la misma altura: `e.y += e.h - 14` (32 → 14, desplazamiento de 18 px hacia abajo).

#### Código corregido (listo para copiar y pegar)

Antes (línea 580):
```js
  if (e.type === 'goomba') e.h = 14;
```

Después:
```js
  if (e.type === 'goomba') { e.y += e.h - 14; e.h = 14; } // <-- B5: mantener base en el suelo
```

#### Verificación
Pisotear un goomba: se aplasta contra el suelo sin hundirse, igual que el koopa.

---

## Resumen de cambios propuestos en main.js (sin aplicarlos)

| Bug | Qué cambia | Dónde |
|---|---|---|
| C1 | Mover `let score = 0; let coinCount = 0;` antes de `captureInitialState()`; duplicado eliminado | Líneas 449-454 y 625-627 |
| A1 | Stomp basado en posición actual del pie, no solo `prevY` | Línea 590 |
| A2 | `en.facing = e.facing` al reconstruir enemigos | Líneas 476-483 |
| B2 | `MAX_FALL_SPEED` y tope de `vy` en `applyPhysics` | Línea 13 (const) y 334 |
| B4 | Guardar aceleración/fricción detrás de `dashTimer <= 0` | Líneas 303-305 |
| B5 | `e.y += e.h - 14; e.h = 14;` para goomba muerto | Línea 580 |
| B1 | Quitar `player.jumpsLeft = MAX_JUMPS` de las 3 ramas de stomp | Líneas 593, 597, 601 |
| M1 | Reconstruir enemigos desde `initialEnemies` en reinicio por victoria | Línea 762 |
| M2 | `fireballs.length = 0` (y `particles`, `floats`) en `resetLevel()` | Línea 485 |
| B3 | Eliminar `winShown` (declaración, bloque en loop, reseteo) | Líneas 63, 744-746, 756 |

`main.js` no se modifica con este documento; aplicar los bloques "Código corregido" sobre el commit `90fe846` y probar en `index.html` antes de commitear.
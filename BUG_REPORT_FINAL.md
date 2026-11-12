# BUG_REPORT_FINAL.md

Repositorio: `/tmp/mario-bros-3-clone`
Archivo revisado: `main.js` (commit `f1eb484`, 813 líneas, rama `main`)
Fecha: 12 de noviembre de 2026
Método: revisión estática completa de `main.js` + prueba de humo en navegador real (carga de `index.html`, bucle `loop()`, movimiento del jugador y captura de errores de JS en consola)
Restricción cumplida: `main.js` NO ha sido modificado.

## Veredicto global

Todos los bugs de `BUG_REPORT_2.md` (C1, A1, A2, M1, M2, B1-B5) están **verificados como corregidos** en el commit `f1eb484`. El juego arranca, renderiza y responde a la entrada sin errores de consola. Quedan dos bugs **menores** (sin bloqueo de partida) en el camino de reinicio por victoria, detallados al final.

---

## 1. Bugs verificados como CORREGIDOS

### C1 — Crítico: el juego no arranca (`score`/`coinCount` en zona muerta temporal)
**Estado:** CORREGIDO.
- Antes: `captureInitialState()` (línea 488 del commit `90fe846`) leía `score`/`coinCount` declaradas después con `let` → `ReferenceError` al cargar.
- Ahora (`f1eb484`): `let score = 0;` y `let coinCount = 0;` están en las líneas 458-459, **antes** de la llamada `captureInitialState()` en la línea 497. La duplicación de líneas 625-626 fue eliminada.
- Verificación real: cargar `index.html` no lanza `ReferenceError`; `typeof score`, `typeof player` y `typeof loop` están definidos; el bucle `loop()` y el render funcionan.

### A1 — Alto: pisotón (stomp) falla al caer desde altura; el jugador muere en lugar de matar al enemigo
**Estado:** CORREGIDO.
- Ahora (línea 599): `const stomp = player.vy > 0 && player.y + player.h <= e.y + e.h / 2 + 4;` — se basa en la posición actual del pie, no solo en `player.prevY`.
- Combinado con B2 (`MAX_FALL_SPEED = 25`), la caída no acelerada indefinidamente elimina el falso negativo del stomp.

### A2 — Alto: los enemigos no recuperan su orientación (`facing`) al reiniciar el nivel
**Estado:** CORREGIDO.
- Línea 487 en `resetLevel()`: `en.facing = e.facing; // A2: restaurar orientación del enemigo`.
- `initialEnemies` captura `facing` (línea 467), por lo que el enemigo revive mirando en su dirección original.

### M1 — Medio: reinicio tras victoria no restablece los enemigos a sus spawns
**Estado:** CORREGIDO.
- Líneas 767-775: el bloque de reinicio por victoria reconstruye enemigos desde `initialEnemies` restaurando `x`, `y`, `state = 'walk'`, `dead = false`, `stompTimer = 0`, `facing` y `vx = e.facing * e.walkSpeed`.

### M2 — Medio: `fireballs` no se vacía al reiniciar; bolas de fuego huérfanas persisten
**Estado:** CORREGIDO (en `resetLevel()`).
- Líneas 492-494 en `resetLevel()`: `fireballs.length = 0;`, `particles.length = 0;`, `floats.length = 0;`.

### B1 — Bajo: salto infinito encadenando pisotones
**Estado:** CORREGIDO.
- Líneas 601-613: ninguna de las tres ramas de stomp (goomba, koopa `walk`, koopa `shell`) asigna `player.jumpsLeft = MAX_JUMPS`; solo se aplica el rebote (`vy` negativo).

### B2 — Bajo: gravedad sin velocidad terminal
**Estado:** CORREGIDO.
- Línea 14: `const MAX_FALL_SPEED = 25;`.
- Línea 337: `if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;` en `applyPhysics()`.

### B3 — Bajo: `winShown` se asigna pero nunca se usa (código muerto)
**Estado:** CORREGIDO.
- `winShown` no existe en el `main.js` actual (ni declaración, ni bloque en `loop()`, ni reseteo en el reinicio por victoria). La pantalla de victoria se controla solo con `gameWon`.

### B4 — Bajo: aceleración en dash se suma sobre `DASH_SPEED`
**Estado:** CORREGIDO.
- Línea 303: `if (this.dashTimer <= 0) {` envuelve la aplicación de `ACEL` y fricción; durante el dash la velocidad se mantiene en `±DASH_SPEED`.

### B5 — Bajo: goomba muerto se hunde en el suelo
**Estado:** CORREGIDO.
- Línea 589: `if (e.type === 'goomba') { e.y += e.h - 14; e.h = 14; } // B5: mantener base en el suelo`.

---

## 2. Bugs nuevos encontrados (no cubiertos por BUG_REPORT_2.md)

Ambos residen en el camino de **reinicio por victoria** (`gameWon`, líneas 759-777), distinto de `resetLevel()` (Game Over), que sí está completo tras las correcciones de M1/M2.

### NUEVO-1 — Bajo: los bloques '?' golpeados reviven como 'brick' tras reinicio por victoria
- **Línea 764:** `tiles.forEach(t => { if (t.type === 'used') t.type = t.type === 'used' ? (t.content ? 'question' : 'brick') : t.type; })`
- **Causa:** al golpear un bloque se ejecuta `t.type = 'used'; t.content = null;` (línea 529). Como `t.content` es `null`, la restauración convierte cualquier bloque `'?'` golpeado en `'brick'` en lugar de devolverlo a `'question'`. Los bloques de pregunta pierden su tipo permanentemente tras un reinicio por victoria.
- **Solución sugerida:** restaurar los tiles desde `initialTiles` (como hace `resetLevel()`) o conservar el tipo original para decidir la restauración.

### NUEVO-2 — Bajo: `fireballs`/`particles`/`floats` no se limpian al reiniciar por victoria
- **Líneas 759-777:** el bloque de reinicio por victoria resetea `score`, `coinCount`, `camX`, monedas, power-ups, tiles y enemigos, pero **no vacía** `fireballs`, `particles` ni `floats`.
- **Efecto:** bolas de fuego activas, partículas y textos flotantes del nivel ganado persisten como huérfanos en el nivel reiniciado. `resetLevel()` sí los vacía (M2); este camino lo omite.
- **Solución sugerida:** añadir `fireballs.length = 0; particles.length = 0; floats.length = 0;` al bloque de reinicio por victoria.

---

## 3. Conclusión

El código de `main.js` en el commit `f1eb484` está **limpio de bugs bloqueantes**: C1 ya no impide el arranque, las colisiones (bloques desde abajo, plataformas como techo, resolución en X) y la lógica de reinicio (Game Over y victoria) funcionan. No se encontraron bugs que rompan el juego.

Quedan pendientes los dos bugs menores NUEVO-1 y NUEVO-2, ambos en el reinicio por victoria. Como `main.js` no debe modificarse por restricción de esta tarea, estos se documentan aquí para su corrección posterior.

`main.js`: **no modificado.**

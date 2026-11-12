# BUG_REPORT_2.md

Repositorio: `/tmp/mario-bros-3-clone`
Archivo revisado: `main.js` (commit `90fe846`, 800 líneas)
Fecha: 12 de noviembre de 2026
Método: revisión estática completa + prueba de humo en navegador real
Restricción cumplida: `main.js` NO ha sido modificado.

## Resumen

El código **no está limpio**. Se encontró **1 bug CRÍTICO** que impide que el juego arranque (`ReferenceError` por variables en zona muerta temporal), además de problemas de colisión, lógica de enemigos y jugabilidad de severidad alta/media/baja.

Los bugs B1–B4 reportados previamente en `REVIEW.md` (hitBlock inactivo, plataformas como techo, resolución en X sin interrupción, reinicio incompleto tras Game Over) **ya fueron corregidos** en el commit `90fe846`.

---

## Hallazgos clasificados por severidad

### CRÍTICO

#### C1 — El juego no arranca: `score`/`coinCount` leídos antes de declararse (TDZ)
- **Líneas:** 488 (llamada), 625–626 (declaración)
- **Descripción:** `captureInitialState()` se invoca en la línea 488 y lee `score` y `coinCount`, pero esas variables se declaran con `let` en las líneas 625 y 626, **después** de la llamada. Como `let` permanece en "zona muerta temporal" desde el inicio del ámbito hasta su declaración, acceder a ellas lanza `ReferenceError` y el script se detiene. El juego nunca empieza: no hay bucle, no hay jugador, no hay render.
- **Verificación real:** al cargar `index.html`, `typeof score` devuelve `ReferenceError: score is not defined`; `player`, `gameWon` y demás globales tampoco existen.
- **Solución sugerida:** mover `let score = 0;` y `let coinCount = 0;` (líneas 625–626) por encima de la llamada `captureInitialState()` (línea 488), o inicializarlas antes de invocarla.

---

### ALTO

#### A1 — Pisotón (stomp) falla al caer desde altura; el jugador muere en lugar de matar al enemigo
- **Líneas:** 590, 334
- **Descripción:** `checkEnemyCollisions` detecta el stomp con `player.prevY + player.h <= e.y + e.h / 2 + 4`. Como no hay velocidad terminal (`this.vy += GRAVITY` sin tope, línea 334), al caer desde muy arriba `vy` es muy grande y `prevY` queda muy por encima del enemigo, por lo que la condición falla aunque el jugador aterrice encima. El impacto se trata como golpe lateral y se ejecuta `player.die()`.
- **Solución sugerida:** añadir una velocidad terminal al jugador y/o basar el stomp en la posición actual del pie relativa al enemigo, no solo en `prevY`.

#### A2 — Los enemigos no recuperan su orientación (`facing`) al reiniciar el nivel
- **Líneas:** 476–483, 167–178
- **Descripción:** `resetLevel()` recrea los enemigos con `new Enemy` (que fija `facing = 1` y `vx = facing * walkSpeed`) y luego sobreescribe `vx`, pero **nunca restaura `en.facing`**. Un enemigo que iba mirando a la izquierda (`facing = -1`) revive mirando a la derecha mientras se mueve a la izquierda; el sensor de pared y el dibujo quedan incoherentes.
- **Solución sugerida:** restaurar `en.facing = e.facing` dentro de `resetLevel()`.

---

### MEDIO

#### M1 — Reinicio tras victoria no restablece los enemigos a sus spawns
- **Líneas:** 755–764 (espec. 762: `e.x = e.x`)
- **Descripción:** Al reiniciar tras ganar (`gameWon`) se resetean score, monedas, tiles y jugador, pero los enemigos se dejan en la posición donde estaban al ganar (`e.x = e.x` no hace nada) y no se restauran desde `initialEnemies`. Al volver a jugar, los enemigos ya no están en sus puntos de aparición.
- **Solución sugerida:** llamar a `resetLevel()` o restaurar posición/estado de enemigos desde `initialEnemies` en el bloque de reinicio por victoria.

#### M2 — `fireballs` no se vacía al reiniciar; bolas de fuego huérfanas persisten
- **Líneas:** 468–486, 549–562
- **Descripción:** `resetLevel()` restaura tiles, monedas, power-ups, enemigos, score y coinCount, pero **no limpia `fireballs`**. Las bolas de fuego activas siguen existiendo y actualizándose tras el reinicio.
- **Solución sugerida:** añadir `fireballs.length = 0;` (y opcionalmente vaciar `particles` y `floats`) en `resetLevel()`.

---

### BAJO

#### B1 — Salto infinito encadenando pisotones
- **Líneas:** 593, 597, 601
- **Descripción:** Pisar un enemigo restaura `player.jumpsLeft = MAX_JUMPS` (2), lo que permite saltos ilimitados mientras se encadenan pisotones sobre enemigos.
- **Solución sugerida:** no restaurar todos los saltos al pisotear (permitir solo 1 salto extra, o ninguno).

#### B2 — Gravedad sin velocidad terminal
- **Línea:** 334
- **Descripción:** `this.vy += GRAVITY` sin límite superior; la velocidad de caída crece indefinidamente. Agrava A1 y puede provocar tunelado en caídas muy largas.
- **Solución sugerida:** limitar `vy` a una constante `MAX_FALL_SPEED`.

#### B3 — `winShown` se asigna pero nunca se usa (código muerto)
- **Líneas:** 744–746
- **Descripción:** `winShown = true` no afecta a ningún comportamiento posterior.
- **Solución sugerida:** eliminarlo o usarlo para controlar la pantalla de victoria.

#### B4 — Aceleración en dash se suma sobre `DASH_SPEED`
- **Líneas:** 303–305, 307–311
- **Descripción:** Durante el dash, `input()` sigue aplicando `ACEL`, por lo que el jugador puede acelerar por encima de `DASH_SPEED`.
- **Solución sugerida:** no aplicar `ACEL` mientras `dashTimer > 0`.

#### B5 — Goomba muerto se hunde en el suelo
- **Líneas:** 578–581
- **Descripción:** `killEnemy` reduce `e.h` de 32 a 14 en goombas sin ajustar `e.y`, por lo que la base sube y el goomba queda medio enterrado. (El koopa sí se ajusta con `e.y += 16`.)
- **Solución sugerida:** ajustar `e.y` para mantener la base en el suelo.

---

## Veredicto

El código **no está limpio**. El bug **C1 es bloqueante**: el juego no inicia. Una vez corregido C1, los bugs **A1/A2** y **M1/M2** afectan la jugabilidad y el reinicio, y **B1–B5** son problemas menores de equilibrio y acabado.

---

## Estado de correcciones previas (contexto)

Los bugs B1–B4 del `REVIEW.md` original fueron corregidos en `90fe846`: `hitBlock` ahora detecta el golpe desde abajo, las plataformas ya no actúan como techo al saltar, `resolve('x')` finaliza tras la primera corrección, y el reinicio tras Game Over restaura el nivel completo mediante `resetLevel()`.

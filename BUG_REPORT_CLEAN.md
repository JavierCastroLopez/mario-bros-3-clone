# BUG_REPORT_CLEAN.md

Repositorio: `/tmp/mario-bros-3-clone`
Archivo revisado: `main.js` (commit `c56c4aa`, rama `main`, 815 líneas)
Fecha: 12 de noviembre de 2026
Restricción cumplida: `main.js` **NO ha sido modificado**.

## Método

Revisión estática completa de `main.js` contra `BUG_REPORT_2.md` (commit `90fe846`) y `BUG_REPORT_FINAL.md` (commit `f1eb484`), más prueba de humo real en navegador (`index.html` servido en `http://localhost:18765`, carga, bucle `loop()`, globales `score`/`coinCount`/`player`/`loop`/`resetLevel` definidos y **cero errores de JS en consola** vía `window.onerror`).

## Estado de todos los bugs reportados

Todos los bugs de ambos informes están verificados como **CORREGIDOS** en `main.js` (commit `c56c4aa`). `main.js` no se ha tocado en esta sesión.

| ID | Severidad | Bug | Estado | Dónde se verifica en `main.js` actual |
|----|-----------|-----|--------|---------------------------------------|
| C1 | Crítico | Juego no arranca: `score`/`coinCount` leídas antes de declararse (TDZ) en `captureInitialState()` | CORREGIDO | `let score = 0;` / `let coinCount = 0;` (líneas 458-459) están **antes** de `captureInitialState()` (línea 497); eliminada la duplicación de líneas 625-626 |
| A1 | Alto | Pisotón (stomp) falla al caer desde altura; el jugador muere en lugar de matar al enemigo | CORREGIDO | Línea 599: stomp basado en la posición actual del pie (`player.y + player.h`), no solo en `prevY` |
| A2 | Alto | Enemigos no recuperan `facing` al reiniciar el nivel | CORREGIDO | Línea 487 (`resetLevel`): `en.facing = e.facing`; líneas 774-775 (reinicio por victoria): `en.facing = e.facing` y `en.vx = e.facing * e.walkSpeed` |
| M1 | Medio | Reinicio tras victoria no restablece enemigos a sus spawns | CORREGIDO | Líneas 768-777: enemigos reconstruidos desde `initialEnemies` con `x`, `y`, `state = 'walk'`, `dead = false`, `facing` y `vx` |
| M2 | Medio | `fireballs` no se vacía al reiniciar; bolas de fuego huérfanas persisten | CORREGIDO | Líneas 492-494 (`resetLevel`): `fireballs.length = 0; particles.length = 0; floats.length = 0`; también línea 764 (reinicio por victoria) |
| B1 | Bajo | Salto infinito encadenando pisotones (`jumpsLeft = MAX_JUMPS` al pisotear) | CORREGIDO | Líneas 601-613: ninguna rama de stomp restaura `jumpsLeft`; solo el rebote (`vy`) |
| B2 | Bajo | Gravedad sin velocidad terminal (tunelado en caídas, agrava A1) | CORREGIDO | Línea 14: `MAX_FALL_SPEED = 25`; línea 337: tope en `applyPhysics()` |
| B3 | Bajo | `winShown` asignado pero nunca usado (código muerto) | CORREGIDO | `winShown` no existe en `main.js` actual (ni declaración, ni uso, ni reseteo); la victoria se controla solo con `gameWon` |
| B4 | Bajo | Aceleración en dash se suma sobre `DASH_SPEED` | CORREGIDO | Línea 303: `ACEL` y fricción envueltos en `if (this.dashTimer <= 0)` |
| B5 | Bajo | Goomba muerto se hunde en el suelo (`e.h` reducido sin ajustar `e.y`) | CORREGIDO | Línea 589: `e.y += e.h - 14; e.h = 14` (base mantenida en el suelo) |
| NUEVO-1 | Bajo | Bloques '?' golpeados reviven como 'brick' tras reinicio por victoria | CORREGIDO | Línea 766: tiles restaurados desde `initialTiles` (vuelven a `'question'`; ya no se derivan de `t.content`) |
| NUEVO-2 | Bajo | `fireballs`/`particles`/`floats` no se limpian al reiniciar por victoria | CORREGIDO | Línea 764: `fireballs.length = 0; particles.length = 0; floats.length = 0` en el bloque de reinicio por victoria |

## Prueba de humo (navegador real)

Carga de `index.html`: sin errores de JavaScript; `typeof loop === 'function'`, `typeof score === 'number'`, `typeof coinCount === 'number'`, `typeof player === 'object'`, `typeof resetLevel === 'function'`. El bucle de juego arranca y renderiza.

## Conclusión

**El código está limpio: no hay bugs pendientes.**

Todos los bugs de `BUG_REPORT_2.md` (C1, A1, A2, M1, M2, B1-B5) y los dos bugs nuevos de `BUG_REPORT_FINAL.md` (NUEVO-1, NUEVO-2) están verificados como corregidos en `main.js` (commit `c56c4aa`). No se encontró ningún bloqueo de arranque, fallo de colisión, error de lógica de reinicio ni problema de jugabilidad restante. El juego inicia, responde a la entrada y los caminos de reinicio (Game Over y victoria) restauran todo el estado correctamente.

`main.js`: **no modificado.**

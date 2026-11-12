# Revisión de código — clon Super Mario Bros 3

**Archivo revisado:** `main.js` (807 líneas). **No se ha modificado.**
**Acompañantes:** `index.html`, `style.css`.
**Método:** lectura estática completa del código + prueba de humo en navegador real (carga sin errores de consola; renderiza fondo, HUD, tiles, monedas, bloques '?' y enemigos).

---

## 1. Bugs críticos de colisión

### B1 — `hitBlock()` nunca se ejecuta: los bloques no se golpean desde abajo (CRÍTICO)
Líneas 340–346, dentro de `applyPhysics()`:

```js
if (this.vy < 0) {
  for (const t of tiles) {
    if (t.type !== 'brick' && t.type !== 'question') continue;
    if (!intersect(this.rect, t)) continue;
    if (this.prevY + this.h <= t.y + 2) hitBlock(t);
  }
}
```

Al moverse hacia arriba (`vy < 0`), `this.y` disminuye, así que el fondo anterior `prevY + h` es **siempre mayor** que el fondo actual. Si tras el movimiento hay intersección (`this.y + h > t.y`), entonces `prevY + h > t.y` también, por lo que la condición `prevY + h <= t.y + 2` es **falsa en todos los casos**.

**Efecto:** ladrillos no se rompen y los bloques '?' nunca sueltan monedas, hongos ni flores. La mecánica principal del juego está rota.

### B2 — Las plataformas funcionan como techo (ALTO)
Líneas 384–387 en `resolve('y')`: cuando `vy < 0` el jugador se coloca por debajo del tile (`this.y = t.y + t.h`) sin excluir `t.type === 'platform'`. No se puede saltar a través de una plataforma desde abajo; al intentarlo, el jugador queda empujado debajo de ella.

### B3 — Resolución de colisión en X sin interrupción (MEDIO)
`resolve('x')` (líneas 368–371) itera **todos** los tiles y sigue corrigiendo `this.x` tras la primera colisión. Con varios tiles solapados, la posición final depende del orden del array y puede atravesar tejas o dejar al jugador atascado en esquinas.

### B4 — Reinicio incompleto tras Game Over (MEDIO)
`player.reset()` (línea 778) solo reinicia al jugador. No se restauran `score`, `coinCount`, los tiles pasados a `'used'`, las monedas tomadas ni los enemigos muertos. Al pulsar ARRIBA para reiniciar, el nivel empieza parcialmente modificado.

---

## 2. Colisiones menores / comportamiento inesperado

- **Power-ups:** solo resuelven colisión Y cuando caen (`p.vy > 0`, líneas 525–529); no resuelven X → atraviesan paredes y pueden nacer dentro de un tile.
- **Fireballs:** solo colisionan con `ground`/`platform` (línea 545); atraviesan `brick`, `pipe` y `question`.
- **Salto infinito en cadena:** pisar enemigos restaura `jumpsLeft = MAX_JUMPS` (2), permitiendo saltos ilimitados mientras se encadenan pisotones.
- **Koopa aplastado:** `e.y += 16; e.h = 16` mantiene el pie en su sitio (correcto, no es bug).
- Sensores de pared/borde de enemigos y clamping de límites del mundo: correctos.
- Dash a 16 px/frame no tunneliza tiles de 32 px (aceptable).

---

## 3. Código y entrada

- Teclado: `just[e.key]` con repetición de tecla mantenida; `consume()` una vez por frame lo hace usable. `'Shift'` es consistente con `e.key`.
- Durante el dash, `input()` sigue aplicando `ACEL`, sobre-acelerando por encima de `DASH_SPEED`.
- No hay delta-time: la física está atada al FPS de `requestAnimationFrame`.
- HUD, cámara (con clamping), partículas y textos flotantes funcionan correctamente.
- No existe condición de victoria ni fin de nivel.

---

## 4. Mejoras sugeridas

1. Corregir `hitBlock`: detectar golpe desde abajo con `this.prevY >= t.y + t.h - tolerancia`.
2. Excluir `platform` del techo en `resolve('y')` (sólidas solo por arriba).
3. Añadir `break` tras la primera resolución en `resolve('x')`/`resolve('y')`; valorar corrección de esquinas.
4. Reiniciar el nivel completo al morir (score, monedas, tiles, enemigos) o añadir pantalla de reinicio.
5. Añadir coyote time y buffer de salto; la invulnerabilidad tras daño ya existe (60 frames).
6. Colisión de power-ups en X; fireballs contra más tipos de tile.
7. Delta-time, condición de victoria, sonidos y controles táctiles.

---

## 5. Resultado de la prueba de humo

- `index.html` cargado en navegador real: **sin errores de consola**.
- Canvas renderiza: fondo `#4a90e2`, sol, HUD (`MONEDAS`, `PUNTUACIÓN`, `ESTADO: SMALL`), tiles, monedas, bloques '?', enemigos (goombas/koopas).
- Conclusión: el juego arranca y pinta correctamente, pero B1 y B2 impiden la jugabilidad esperada (no se pueden romper bloques ni activar contenido, y las plataformas bloquean el salto hacia arriba).

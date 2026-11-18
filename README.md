# 🥷 Ninja vs. Big Horses 🐴

A Super Mario–style jump'n'run. One level, **5 minutes**. The ninja must
reach the goal flag before time runs out — stomp the big horses from
above to defeat them, but touching them from the side costs a life!
Don't fall into the pits.

## Play in the browser (HTML5)

Just open **`index.html`** — no installation, no build step, works in
any modern browser (also works on GitHub Pages).

**Controls:**
- Move: `←`/`→` or `A`/`D`
- Jump: `Space`, `↑`, or `W`
- Restart after win/lose: `Enter`

## Python version

If you prefer the pygame original:

```bash
pip install pygame
python ninja_vs_horses.py
```

## Gameplay

| Item | Effect |
|---|---|
| 🥷 Ninja (you) | Runs, jumps, wields a katana |
| 🐴 Big horse | Stomp from above: **+100** · side hit: **−1 life** |
| 🪙 Coin | Touch: **+10** |
| 🚩 Goal flag | Reach it: win + **time bonus** |
| ⏱ Timer | 5:00 — reaching 0 ends the game |
| ❤ Lives | 3, with respawn checkpoints |

The level is procedurally generated from a fixed seed, so it is
identical every run and guaranteed to be fully traversable — platforms
only spawn over solid ground so they never block the jump over a pit.

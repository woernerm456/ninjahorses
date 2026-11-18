/* Ninja vs. Big Horses - HTML5 / Canvas jump'n'run.
 * One level, 5 minutes. Reach the flag, stomp the horses, don't fall. */

"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 900, H = 520;
const FPS = 60;

// ----- game constants (same tuning as the Python version) -----
const GRAVITY = 0.8;
const MOVE_SPEED = 5;
const JUMP_VELOCITY = -15;
const MAX_LIVES = 3;
const LEVEL_DURATION = 5 * 60; // seconds
const TILE = 40;
const LEVEL_LENGTH_TILES = 380;
const GROUND_TOP_Y = H - 80;

// ----- tiny helpers -----
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
function rnd() { // mulberry32 seeded PRNG - level identical every run
  rnd.t = (rnd.t + 0x6D2B79F5) | 0;
  let t = rnd.t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function choice(arr) { return arr[Math.floor(rnd() * arr.length)]; }

// ----- input -----
const keys = {};
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp", "Space"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.code] = false; });

function pressed(...codes) { return codes.some(c => keys[c]); }

// ----- level generation (same guarantees as the Python version) -----
let solids = [], horses = [], coins = [], goalX = 0;

function generateLevel() {
  rnd.t = 1337;
  solids = []; horses = []; coins = [];
  let x = 0;
  while (x < LEVEL_LENGTH_TILES - 8) {
    const seg = randInt(7, 15);
    const top = GROUND_TOP_Y - choice([0, 0, 40, 80]);
    solids.push({ x: x * TILE, y: top, w: seg * TILE, h: H - top + 60 });
    const segLeft = x * TILE, segRight = (x + seg) * TILE;
    const gap = randInt(2, 3);
    x += seg + gap;
    if (rnd() < 0.75) {
      horses.push(new Horse(segRight - randInt(3, 6) * TILE, top));
    }
    // platform floats over solid ground only (never over the pit,
    // so it can't block the jump arc)
    if (seg >= 9 && rnd() < 0.65) {
      const pw = randInt(3, 5);
      const margin = Math.max(1, seg - pw - 1);
      const px = segLeft + randInt(1, margin) * TILE;
      const py = top - choice([120, 150, 180]);
      solids.push({ x: px, y: py, w: pw * TILE, h: 18 });
      for (let c = 0; c < pw; c++) {
        if (rnd() < 0.5) coins.push(new Coin(px + c * TILE + 11, py - 40));
      }
    }
    if (rnd() < 0.3) {
      coins.push(new Coin(segRight - randInt(2, 4) * TILE, top - 110));
    }
  }
  const finalLeft = x * TILE;
  solids.push({ x: finalLeft, y: GROUND_TOP_Y, w: 14 * TILE, h: 400 });
  goalX = finalLeft + 5 * TILE;
}

// ----- entities -----
class Ninja {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 30; this.h = 46;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.facing = 1; this.animT = 0;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    const left = pressed("ArrowLeft", "KeyA");
    const right = pressed("ArrowRight", "KeyD");
    const jump = pressed("Space", "ArrowUp", "KeyW");

    this.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * MOVE_SPEED;
    if (this.vx) this.facing = this.vx > 0 ? 1 : -1;

    if (jump && this.onGround) { this.vy = JUMP_VELOCITY; this.onGround = false; }
    this.vy = Math.min(this.vy + GRAVITY, 18);

    this.x += this.vx;
    for (const s of solids) {
      if (rectsOverlap(this, s)) {
        if (this.vx > 0) this.x = s.x - this.w;
        else if (this.vx < 0) this.x = s.x + s.w;
      }
    }

    this.y += this.vy;
    this.onGround = false;
    for (const s of solids) {
      if (rectsOverlap(this, s)) {
        if (this.vy > 0) { this.y = s.y - this.h; this.vy = 0; this.onGround = true; }
        else if (this.vy < 0) { this.y = s.y + s.h; this.vy = 0; }
      }
    }

    this.animT += 0.2;
    if (this.y > H + 200) return "dead";
    return "ok";
  }

  draw(camX) {
    const f = this.facing;
    const x = this.x + this.w / 2 - camX;
    const y = this.y + this.h;
    const bob = this.onGround ? Math.sin(this.animT) * 2 : 0;
    const run = Math.abs(this.vx) > 0 && this.onGround;
    let leg1 = 0, leg2 = 0;
    if (run) { const p = Math.sin(this.animT * 3); leg1 = p * 10; leg2 = -p * 10; }

    ctx.strokeStyle = "#191e3c"; ctx.lineWidth = 6; ctx.lineCap = "round";
    line(x - 4, y - 14, x - 4 + leg1 * f, y);
    line(x + 5, y - 14, x + 5 + leg2 * f, y);

    ctx.fillStyle = "#14141c";
    rect(x - 11, y - 38, 22, 26, 5);                  // body
    ctx.fillStyle = "#b41e28";
    rect(x - 11, y - 22, 22, 5);                      // sash
    ctx.fillStyle = "#14141c";
    rect(x + 2 * f - 9, y - 54 + bob, 18, 16, 4);     // head
    ctx.strokeStyle = "#f0f0f0"; ctx.lineWidth = 3;
    line(x + 2 * f - 6, y - 46 + bob, x + 2 * f + 4, y - 47 + bob); // eye slit
    ctx.strokeStyle = "#b41e28";
    line(x + 2 * f, y - 52 + bob, x + 2 * f - 14 * f, y - 48 + bob); // headband
    ctx.strokeStyle = "#14141c"; ctx.lineWidth = 5;
    line(x, y - 24 + bob, x + 10 * f, y - 24 + bob);  // arm
    ctx.strokeStyle = "#c8cdd7"; ctx.lineWidth = 4;
    line(x + 10 * f, y - 20 + bob, x + 26 * f, y - 36 + bob); // katana
  }
}

class Horse {
  constructor(x, groundTop) {
    this.w = 70; this.h = 60;
    this.x = x; this.y = groundTop - this.h;
    this.vx = -1.4; this.animT = 0; this.dead = false; this.deadT = 0;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    if (this.dead) { this.deadT++; return; }
    this.animT += 0.15;
    const oldX = this.x;
    this.x += this.vx;
    for (const s of solids) {
      if (rectsOverlap(this, s)) { this.x = oldX; this.vx = -this.vx; break; }
    }
    this.y += 4;
    for (const s of solids) {
      if (rectsOverlap(this, s)) this.y = s.y - this.h;
    }
  }

  draw(camX) {
    if (this.dead && this.deadT > 20) return;
    const x = this.x + this.w / 2 - camX;
    const y = this.y + this.h;
    const face = this.vx > 0;
    const bodyCol = "#784628", maneCol = "#3c1e14";

    ctx.strokeStyle = bodyCol; ctx.lineWidth = 7; ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const off = [-22, -10, 8, 20][i];
      const sw = Math.sin(this.animT + i * 1.6) * 4;
      line(x + off + 3, y - 26, x + off + 3 + sw, y);
    }

    ctx.fillStyle = bodyCol;
    ellipse(x, y - 39, 27, 17);                                  // body
    const nx = x + (face ? 28 : -28);
    poly([[x + (face ? 10 : -10), y - 40], [nx, y - 62],
          [nx + (face ? 14 : -14), y - 52], [x + (face ? 16 : -16), y - 30]]);
    rect(nx + (face ? 3 : -23), y - 70, 26, 19, 6);              // head
    ctx.fillStyle = "#140a05";
    circle(nx + (face ? 22 : 4) - (face ? 0 : 0), y - 64, 3);    // eye
    ctx.fillStyle = maneCol;
    poly([[x, y - 44], [x + 8, y - 58], [x + 4, y - 44],
          [x + 14, y - 56], [x + 10, y - 42], [x - 4, y - 40]]); // mane
    ctx.strokeStyle = maneCol; ctx.lineWidth = 5;
    const tx = x + (face ? -30 : 30);
    line(tx, y - 38, tx - (face ? 8 : -8), y - 14);              // tail

    if (this.dead) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      rect(this.x - camX - 4, this.y - 4, this.w + 8, this.h + 8);
    }
  }
}

class Coin {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 18; this.h = 18;
    this.t = Math.random() * 6.28; this.collected = false;
  }
  get rect() { return this; }
  draw(camX) {
    if (this.collected || this.x - camX < -20 || this.x - camX > W + 20) return;
    this.t += 0.1;
    const w = Math.abs(Math.cos(this.t)) * 9 + 3;
    ctx.fillStyle = "#ffd228";
    ellipse(this.x + 9 - camX, this.y + 9, w, 9);
    ctx.strokeStyle = "#b4820a"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x + 9 - camX, this.y + 9, w, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ----- drawing helpers -----
function line(x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function rect(x, y, w, h, r) {
  if (r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  else ctx.fillRect(x, y, w, h);
}
function ellipse(cx, cy, rx, ry) {
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function circle(cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}
function poly(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}

function drawBackground(camX) {
  for (let i = 0; i < H; i++) {
    const c = 95 + i * 60 / H | 0, g = 155 + i * 50 / H | 0, b = 235 - i * 60 / H | 0;
    ctx.fillStyle = `rgb(${c},${g},${b})`;
    ctx.fillRect(0, i, W, 1);
  }
  ctx.fillStyle = "#468c5a";
  const off = (camX * 0.3) % 400;
  for (let i = -1; i < 4; i++) ellipse(i * 400 - off, H - 70, 200, 120);
  ctx.fillStyle = "#fff";
  const off2 = (camX * 0.15) % 500;
  for (let i = -1; i < 3; i++) {
    const cx = i * 500 - off2 + 125;
    ellipse(cx, 102, 65, 22);
    ellipse(cx + 110, 114, 50, 19);
  }
}

function drawWorld(camX) {
  for (const s of solids) {
    const x = s.x - camX;
    if (x + s.w < -40 || x > W + 40) continue;
    ctx.fillStyle = "#785032";
    ctx.fillRect(x, s.y, s.w, s.h);
    ctx.strokeStyle = "#50321e"; ctx.lineWidth = 3;
    ctx.strokeRect(x, s.y, s.w, s.h);
    if (s.h > 30) {                     // ground: grass top
      ctx.fillStyle = "#5aaa46";
      ctx.fillRect(x, s.y, s.w, 10);
    } else {                            // floating platform
      ctx.fillStyle = "#462d1c";
      ctx.fillRect(x, s.y, s.w, 4);
    }
  }
}

function drawFlag(camX) {
  const x = goalX - camX;
  if (x < -70 || x > W + 70) return;
  const base = GROUND_TOP_Y;
  ctx.fillStyle = "#c8c8d2";
  ctx.fillRect(x - 3, base - 150, 6, 150);
  const wave = Math.sin(performance.now() * 0.005) * 6;
  ctx.fillStyle = "#ff3c3c";
  poly([[x + 3, base - 150], [x + 60, base - 135 + wave], [x + 3, base - 118]]);
}

function drawHUD(p) {
  ctx.fillStyle = "rgba(10,10,25,0.75)";
  ctx.fillRect(0, 0, W, 56);
  ctx.font = "bold 24px monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffd23c";  ctx.fillText("Score: " + score, 16, 10);
  ctx.fillStyle = "#ffffff";  ctx.fillText("Lives: " + lives, 220, 10);
  ctx.fillStyle = "#78dcff";
  const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
  ctx.fillText(`Time: ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, 420, 10);
  ctx.fillStyle = "#32323c";  ctx.fillRect(640, 22, 200, 14);
  ctx.fillStyle = "#5adc78";  ctx.fillRect(640, 22, 200 * p, 14);
  ctx.strokeStyle = "#e6e6e6"; ctx.lineWidth = 2;
  ctx.strokeRect(640, 22, 200, 14);
  ctx.fillStyle = "#fff"; ctx.fillText(Math.round(p * 100) + "%", 852, 14);
}

function drawOverlay(title, line1, line2) {
  ctx.fillStyle = "rgba(0,0,20,0.7)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "bold 52px monospace";
  ctx.fillStyle = "#ffdc3c";
  ctx.fillText(title, W / 2, H / 2 - 80);
  ctx.font = "bold 24px monospace";
  ctx.fillStyle = "#fff";    ctx.fillText(line1, W / 2, H / 2 - 10);
  ctx.fillStyle = "#b4b4be"; ctx.fillText(line2, W / 2, H / 2 + 25);
  ctx.textAlign = "left";
}

// ----- game loop -----
let player, camX, score, lives, timeLeft, state, invuln;

function reset() {
  generateLevel();
  player = new Ninja(60, GROUND_TOP_Y - 100);
  camX = 0; score = 0; lives = MAX_LIVES;
  timeLeft = LEVEL_DURATION; state = "play"; invuln = 0;
}

function respawnX(progressPx) {
  let best = 80;
  for (const s of solids) {
    if (s.w > 200 && s.x + s.w <= progressPx) best = Math.max(best, s.x + 20);
  }
  return best;
}

function update(dt) {
  timeLeft = Math.max(0, timeLeft - dt / 1000);
  const res = player.update();
  if (res === "dead" || timeLeft <= 0) {
    lives--;
    if (lives <= 0 || timeLeft <= 0) state = "lose";
    else {
      player = new Ninja(respawnX(player.x), 0);
      player.y = GROUND_TOP_Y - player.h;
      invuln = 90;
    }
  }

  for (const h of horses) {
    if (h.dead) continue;
    h.update();
    if (rectsOverlap(player.rect, h.rect)) {
      const feet = player.y + player.h;
      const stomp = player.vy > 2 && feet - h.y < 28;
      if (stomp) {
        h.dead = true; player.vy = -11; score += 100;
      } else if (invuln <= 0) {
        lives--;
        if (lives <= 0) state = "lose";
        else {
          invuln = 90;
          player.x = Math.max(20, player.x - 60);
          player.vy = -8;
        }
      }
    }
  }
  if (invuln > 0) invuln--;

  for (const c of coins) {
    if (!c.collected && rectsOverlap(player.rect, c.rect)) {
      c.collected = true; score += 10;
    }
  }

  camX = Math.max(0, Math.min(player.x + 15 - W / 3, goalX + 400 - W));
  if (player.x + 15 >= goalX) {
    state = "win";
    score += Math.floor(timeLeft) * 5;
  }
}

function render() {
  const progress = Math.min(1, (player.x + 15) / goalX);
  drawBackground(camX);
  drawWorld(camX);
  for (const c of coins) c.draw(camX);
  for (const h of horses) h.draw(camX);
  drawFlag(camX);
  const blink = invuln > 0 && Math.floor(invuln / 6) % 2 === 0;
  if (!blink) player.draw(camX);
  drawHUD(progress);
  if (state === "win") drawOverlay("VICTORY!", "Final score: " + score, "Press ENTER to play again");
  else if (state === "lose") drawOverlay("GAME OVER", "Score: " + score, "Press ENTER to retry");
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(100, now - last); // cap big tab-switch gaps
  last = now;
  if (state === "play") update(dt);
  if (state !== "play" && keys["Enter"]) reset();
  render();
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);

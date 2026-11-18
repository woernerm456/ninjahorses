"""Ninja vs. Big Horses - a Super Mario style jump'n'run.

One level, 5 minutes. The ninja must reach the goal flag before time
runs out. Stomp the big horses to defeat them, but touching them from
the side costs a life.

Controls: Left/Right or A/D to move, Space/Up/W to jump, Esc to quit.
"""

import math
import random
import sys

import pygame

SCREEN_W, SCREEN_H = 900, 520
FPS = 60
LEVEL_DURATION = 5 * 60  # seconds

GRAVITY = 0.8
MOVE_SPEED = 5
JUMP_VELOCITY = -15
MAX_LIVES = 3

TILE = 40
LEVEL_LENGTH_TILES = 380
GROUND_TOP_Y = SCREEN_H - 80


def make_font(size, bold=False):
    f = pygame.font.Font(pygame.font.get_default_font(), size)
    if bold:
        f.set_bold(True)
    return f


# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------
class Ninja:
    W, H = 30, 46

    def __init__(self, x, y):
        self.rect = pygame.Rect(x, y, self.W, self.H)
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False
        self.facing = 1
        self.anim_t = 0.0

    def update(self, solids):
        keys = pygame.key.get_pressed()
        left = keys[pygame.K_LEFT] or keys[pygame.K_a]
        right = keys[pygame.K_RIGHT] or keys[pygame.K_d]
        jump = keys[pygame.K_SPACE] or keys[pygame.K_UP] or keys[pygame.K_w]

        self.vx = (int(right) - int(left)) * MOVE_SPEED
        if self.vx:
            self.facing = 1 if self.vx > 0 else -1

        if jump and self.on_ground:
            self.vy = JUMP_VELOCITY
            self.on_ground = False
        self.vy = min(self.vy + GRAVITY, 18)

        self.rect.x += int(self.vx)
        for s in solids:
            if self.rect.colliderect(s):
                if self.vx > 0:
                    self.rect.right = s.left
                elif self.vx < 0:
                    self.rect.left = s.right

        self.rect.y += int(self.vy)
        self.on_ground = False
        for s in solids:
            if self.rect.colliderect(s):
                if self.vy > 0:
                    self.rect.bottom = s.top
                    self.vy = 0
                    self.on_ground = True
                elif self.vy < 0:
                    self.rect.top = s.bottom
                    self.vy = 0

        self.anim_t += 0.2
        if self.rect.y > SCREEN_H + 200:
            return "dead"
        return "ok"

    def draw(self, surf, cam_x):
        r = self.rect.move(-cam_x, 0)
        if not surf.get_rect().colliderect(r):
            return
        x, y = r.centerx, r.bottom
        f = self.facing
        bob = math.sin(self.anim_t) * 2 if self.on_ground else 0
        run = abs(self.vx) > 0 and self.on_ground

        if run:
            leg_phase = math.sin(self.anim_t * 3)
            leg1, leg2 = leg_phase * 10, -leg_phase * 10
        else:
            leg1, leg2 = 0, 0
        pygame.draw.line(surf, (25, 30, 60), (x - 4, y - 14),
                         (x - 4 + int(leg1 * f), y), 6)
        pygame.draw.line(surf, (25, 30, 60), (x + 5, y - 14),
                         (x + 5 + int(leg2 * f), y), 6)

        body = pygame.Rect(0, 0, 22, 26)
        body.midbottom = (x, y - 12)
        pygame.draw.rect(surf, (20, 20, 28), body, border_radius=5)
        pygame.draw.rect(surf, (180, 30, 40),
                         pygame.Rect(x - 11, y - 22, 22, 5))
        head = pygame.Rect(0, 0, 18, 16)
        head.midbottom = (x + 2 * f, y - 38 + int(bob))
        pygame.draw.rect(surf, (20, 20, 28), head, border_radius=4)
        pygame.draw.line(surf, (240, 240, 240),
                         (head.centerx - 6 * f, head.centery),
                         (head.centerx + 4 * f, head.centery - 1), 3)
        pygame.draw.line(surf, (180, 30, 40),
                         (head.centerx, head.centery - 6),
                         (head.centerx - 14 * f, head.centery - 2), 3)
        ax = x + 10 * f
        ay = y - 24 + int(bob)
        pygame.draw.line(surf, (20, 20, 28), (x, ay), (ax, ay), 5)
        pygame.draw.line(surf, (200, 205, 215), (ax, ay + 4),
                         (ax + 16 * f, ay - 12), 4)


class Horse:
    W, H = 70, 60  # big horse

    def __init__(self, x, y_top):
        self.rect = pygame.Rect(x, y_top - self.H, self.W, self.H)
        self.vx = -1.4
        self.anim_t = 0.0
        self.dead = False
        self.dead_t = 0

    def update(self, solids):
        if self.dead:
            self.dead_t += 1
            return
        self.anim_t += 0.15
        old_x = self.rect.x
        self.rect.x += int(self.vx)
        for s in solids:
            if self.rect.colliderect(s):
                self.rect.x = old_x
                self.vx = -self.vx
                break
        # gravity / stay grounded
        self.rect.y += 4
        for s in solids:
            if self.rect.colliderect(s):
                self.rect.bottom = s.top

    def draw(self, surf, cam_x):
        if self.dead and self.dead_t > 20:
            return
        r = self.rect.move(-cam_x, 0)
        if not surf.get_rect().colliderect(r):
            return
        x, y = r.centerx, r.bottom
        body_c = (120, 70, 40)
        mane_c = (60, 30, 20)
        face = self.vx > 0

        body = pygame.Rect(0, 0, self.W - 16, 34)
        body.midbottom = (x, y - 22)
        pygame.draw.ellipse(surf, body_c, body)
        for i, off in enumerate((-22, -10, 8, 20)):
            sw = math.sin(self.anim_t + i * 1.6) * 4
            pygame.draw.line(surf, body_c, (x + off + 3, y - 26),
                             (x + off + 3 + int(sw), y), 7)
        nx = x + (28 if face else -28)
        pygame.draw.polygon(surf, body_c, [
            (x + (10 if face else -10), y - 40),
            (nx, y - 62),
            (nx + (14 if face else -14), y - 52),
            (x + (16 if face else -16), y - 30),
        ])
        head = pygame.Rect(0, 0, 26, 18)
        head.midbottom = (nx + (16 if face else -16), y - 52)
        pygame.draw.rect(surf, body_c, head, border_radius=6)
        ex = head.centerx + (6 if face else -6)
        pygame.draw.circle(surf, (20, 10, 5), (ex, head.y + 6), 3)
        pygame.draw.polygon(surf, mane_c, [
            (x, y - 44), (x + 8, y - 58), (x + 4, y - 44),
            (x + 14, y - 56), (x + 10, y - 42), (x - 4, y - 40),
        ])
        tx = x + (-30 if face else 30)
        pygame.draw.line(surf, mane_c, (tx, y - 38),
                         (tx - (8 if face else -8), y - 14), 5)

        if self.dead:
            s = pygame.Surface((r.w + 8, r.h + 8), pygame.SRCALPHA)
            s.fill((255, 255, 255, 120))
            surf.blit(s, r.inflate(8, 8).topleft)


class Coin:
    def __init__(self, x, y):
        self.rect = pygame.Rect(x, y, 18, 18)
        self.t = random.random() * 6.28
        self.collected = False

    def draw(self, surf, cam_x):
        if self.collected:
            return
        r = self.rect.move(-cam_x, 0)
        if not surf.get_rect().colliderect(r):
            return
        self.t += 0.1
        w = abs(math.cos(self.t)) * 9 + 3
        ellipse = pygame.Rect(0, 0, int(w), 18)
        ellipse.center = r.center
        pygame.draw.ellipse(surf, (255, 210, 40), ellipse)
        pygame.draw.ellipse(surf, (180, 130, 10), ellipse, 2)


# ---------------------------------------------------------------------------
# Level generation
# ---------------------------------------------------------------------------
def generate_level():
    rng = random.Random(1337)
    solids = []
    patrols = []
    coins = []

    x = 0
    while x < LEVEL_LENGTH_TILES - 8:
        seg = rng.randint(7, 15)
        top = GROUND_TOP_Y - rng.choice([0, 0, 40, 80])
        ground = pygame.Rect(x * TILE, top, seg * TILE,
                             SCREEN_H - top + 60)
        solids.append(ground)
        seg_left_px = x * TILE
        seg_right_px = (x + seg) * TILE
        gap = rng.randint(2, 3)
        x += seg + gap
        if rng.random() < 0.75:
            patrols.append((seg_right_px - rng.randint(3, 6) * TILE, top))
        # platform floats over the solid segment (never over the gap,
        # so it can't block the jump arc across the pit)
        if seg >= 9 and rng.random() < 0.65:
            pw = rng.randint(3, 5)
            margin = max(1, seg - pw - 1)
            px = seg_left_px + rng.randint(1, margin) if margin >= 1 else seg_left_px
            py = top - rng.choice([120, 150, 180])
            solids.append(pygame.Rect(px, py, pw * TILE, 18))
            for c in range(px, px + pw * TILE, TILE):
                if rng.random() < 0.5:
                    coins.append(Coin(c + 11, py - 40))
        if rng.random() < 0.3:
            coins.append(Coin(seg_right_px - rng.randint(2, 4) * TILE,
                             top - 110))

    final_left = x * TILE
    final = pygame.Rect(final_left, GROUND_TOP_Y,
                        14 * TILE, 400)
    solids.append(final)
    goal_x = final_left + 5 * TILE
    return solids, patrols, coins, goal_x


def respawn_x(solids, progress_px):
    best = 80
    for s in solids:
        if s.w > 200 and s.right <= progress_px:
            best = max(best, s.left + 20)
    return best


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------
def draw_background(surf, cam_x):
    for i in range(SCREEN_H):
        c = (95 + i * 60 // SCREEN_H, 155 + i * 50 // SCREEN_H,
             235 - i * 60 // SCREEN_H)
        pygame.draw.line(surf, c, (0, i), (SCREEN_W, i))
    off = (cam_x * 0.3) % 400
    for i in range(-1, 4):
        hx = i * 400 - off
        pygame.draw.ellipse(surf, (70, 140, 90),
                           pygame.Rect(hx, SCREEN_H - 190, 400, 240))
    off2 = (cam_x * 0.15) % 500
    for i in range(-1, 3):
        cx = i * 500 - off2 + 60
        pygame.draw.ellipse(surf, (255, 255, 255),
                           pygame.Rect(cx, 80, 130, 45))
        pygame.draw.ellipse(surf, (255, 255, 255),
                           pygame.Rect(cx + 60, 95, 100, 38))


def draw_world(screen, solids, cam_x):
    for s in solids:
        r = s.move(-cam_x, 0)
        if r.right < -40 or r.left > SCREEN_W + 40:
            continue
        pygame.draw.rect(screen, (120, 80, 50), r)
        pygame.draw.rect(screen, (80, 50, 30), r, 3)
        if s.h > 30:  # ground block: grass top
            pygame.draw.rect(screen, (90, 170, 70),
                             pygame.Rect(r.x, r.y, r.w, 10))
        else:  # floating platform
            pygame.draw.rect(screen, (70, 45, 28),
                             pygame.Rect(r.x, r.y, r.w, 4))


def draw_flag(surf, cam_x, goal_x):
    x = goal_x - cam_x
    if x < -70 or x > SCREEN_W + 70:
        return
    base = GROUND_TOP_Y
    pygame.draw.rect(surf, (200, 200, 210),
                     pygame.Rect(x - 3, base - 150, 6, 150))
    wave = math.sin(pygame.time.get_ticks() * 0.005) * 6
    pygame.draw.polygon(surf, (255, 60, 60), [
        (x + 3, base - 150), (x + 60, base - 135 + wave), (x + 3, base - 118)])


def draw_hud(surf, font, score, lives, time_left, progress):
    bar = pygame.Surface((SCREEN_W, 56), pygame.SRCALPHA)
    bar.fill((10, 10, 25, 190))
    surf.blit(bar, (0, 0))
    surf.blit(font.render(f"Score: {score}", True, (255, 210, 60)), (16, 8))
    surf.blit(font.render(f"Lives: {lives}", True, (255, 255, 255)), (220, 8))
    surf.blit(font.render(f"Time: {int(time_left)//60:02d}:{int(time_left)%60:02d}",
                          True, (120, 220, 255)), (420, 8))
    pr = pygame.Rect(640, 20, 200, 14)
    pygame.draw.rect(surf, (50, 50, 60), pr)
    pygame.draw.rect(surf, (90, 220, 120),
                     pygame.Rect(pr.x, pr.y, int(pr.w * progress), pr.h))
    pygame.draw.rect(surf, (230, 230, 230), pr, 2)
    txt = font.render(f"{int(progress*100)}%", True, (255, 255, 255))
    surf.blit(txt, (pr.right + 8, pr.y - 4))


def overlay(screen, big, font, title, line1, line2):
    shade = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
    shade.fill((0, 0, 20, 170))
    screen.blit(shade, (0, 0))
    t = big.render(title, True, (255, 220, 60))
    screen.blit(t, t.get_rect(center=(SCREEN_W // 2, SCREEN_H // 2 - 60)))
    l1 = font.render(line1, True, (255, 255, 255))
    screen.blit(l1, l1.get_rect(center=(SCREEN_W // 2, SCREEN_H // 2 + 5)))
    l2 = font.render(line2, True, (180, 180, 190))
    screen.blit(l2, l2.get_rect(center=(SCREEN_W // 2, SCREEN_H // 2 + 40)))


# ---------------------------------------------------------------------------
# Main game
# ---------------------------------------------------------------------------
def game_loop(screen, clock):
    font = make_font(24, True)
    big = make_font(52, True)

    solids, patrols, coins, goal_x = generate_level()
    horses = [Horse(px, py) for px, py in patrols]
    player = Ninja(60, GROUND_TOP_Y - 100)
    cam_x = 0
    score = 0
    lives = MAX_LIVES
    time_left = float(LEVEL_DURATION)
    state = "play"
    invuln = 0

    while True:
        dt_ms = clock.tick(FPS)
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                return "quit"
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                return "quit"

        if state == "play":
            time_left = max(0.0, time_left - dt_ms / 1000.0)
            res = player.update(solids)
            if res == "dead" or time_left <= 0:
                lives -= 1
                if lives <= 0 or time_left <= 0:
                    state = "lose"
                else:
                    player = Ninja(respawn_x(solids, player.rect.x), 0)
                    player.rect.bottom = GROUND_TOP_Y
                    invuln = 90

            for h in horses:
                if h.dead:
                    continue
                h.update(solids)
                if player.rect.colliderect(h.rect):
                    stomp = (player.vy > 2 and
                             player.rect.bottom - h.rect.top < 28)
                    if stomp:
                        h.dead = True
                        player.vy = -11
                        score += 100
                    elif invuln <= 0:
                        lives -= 1
                        if lives <= 0:
                            state = "lose"
                        else:
                            invuln = 90
                            player.rect.x = max(20, player.rect.x - 60)
                            player.vy = -8
            if invuln > 0:
                invuln -= 1

            for c in coins:
                if not c.collected and player.rect.colliderect(c.rect):
                    c.collected = True
                    score += 10

            cam_x = max(0, min(player.rect.centerx - SCREEN_W // 3,
                               goal_x + 400 - SCREEN_W))
            if player.rect.centerx >= goal_x:
                state = "win"
                score += int(time_left) * 5

        progress = min(1.0, player.rect.centerx / goal_x)

        draw_background(screen, cam_x)
        draw_world(screen, solids, cam_x)
        for c in coins:
            c.draw(screen, cam_x)
        for h in horses:
            h.draw(screen, cam_x)
        draw_flag(screen, cam_x, goal_x)
        if not (invuln > 0 and (invuln // 6) % 2 == 0):
            player.draw(screen, cam_x)
        draw_hud(screen, font, score, lives, time_left, progress)

        if state == "win":
            overlay(screen, big, font, "VICTORY!",
                    f"Final score: {score}", "Press ENTER to play again")
        elif state == "lose":
            overlay(screen, big, font, "GAME OVER",
                    f"Score: {score}", "Press ENTER to retry")

        pygame.display.flip()

        if state != "play":
            for ev in pygame.event.get():
                if ev.type == pygame.KEYDOWN and ev.key == pygame.K_RETURN:
                    return "restart"
                if ev.type == pygame.QUIT:
                    return "quit"


def main():
    pygame.init()
    pygame.display.set_caption("Ninja vs. Big Horses")
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    clock = pygame.time.Clock()
    while True:
        result = game_loop(screen, clock)
        if result == "quit":
            break
    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()

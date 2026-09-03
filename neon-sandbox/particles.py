"""
Neon Particle System for Chaos Sandbox.
Handles sparks, expanding shockwave rings, explosion fireballs, and neon trails.
"""

import math
import random
import pygame

class Particle:
    __slots__ = ('x', 'y', 'vx', 'vy', 'color', 'size', 'life', 'max_life', 'drag', 'gravity')
    def __init__(self, x, y, vx, vy, color, size, life, drag=0.98, gravity=250.0):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.color = color
        self.size = size
        self.life = life
        self.max_life = life
        self.drag = drag
        self.gravity = gravity

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vy += self.gravity * dt
        self.vx *= (self.drag ** (dt * 60))
        self.vy *= (self.drag ** (dt * 60))
        self.life -= dt
        return self.life > 0

class ShockwaveRing:
    __slots__ = ('x', 'y', 'color', 'radius', 'max_radius', 'life', 'duration', 'width')
    def __init__(self, x, y, color, max_radius=140.0, duration=0.35, width=4):
        self.x = x
        self.y = y
        self.color = color
        self.radius = 5.0
        self.max_radius = max_radius
        self.duration = duration
        self.life = duration
        self.width = width

    def update(self, dt):
        self.life -= dt
        progress = 1.0 - max(0.0, self.life / self.duration)
        # Ease-out quad expansion
        self.radius = 5.0 + (self.max_radius - 5.0) * (1 - (1 - progress) ** 2)
        return self.life > 0

    def draw(self, surface):
        if self.radius <= 1:
            return
        alpha = int(255 * (self.life / self.duration))
        if alpha <= 0:
            return
        # Draw on transparent subsurface or with gfxdraw
        ring_surf = pygame.Surface((int(self.radius * 2 + 8), int(self.radius * 2 + 8)), pygame.SRCALPHA)
        center = (int(self.radius + 4), int(self.radius + 4))
        r, g, b = self.color[:3]
        current_width = max(1, int(self.width * (self.life / self.duration)))
        pygame.draw.circle(ring_surf, (r, g, b, alpha), center, int(self.radius), current_width)
        surface.blit(ring_surf, (self.x - center[0], self.y - center[1]), special_flags=pygame.BLEND_ADD)

class ParticleSystem:
    def __init__(self):
        self.particles = []
        self.rings = []

    def clear(self):
        self.particles.clear()
        self.rings.clear()

    def add_sparks(self, x, y, color, count=15, speed_range=(100, 350)):
        for _ in range(count):
            angle = random.uniform(0, math.tau)
            speed = random.uniform(*speed_range)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            life = random.uniform(0.2, 0.6)
            size = random.uniform(2.0, 4.5)
            self.particles.append(Particle(x, y, vx, vy, color, size, life, drag=0.95, gravity=300.0))

    def add_explosion(self, x, y, color=(255, 120, 30), count=60):
        # Center fiery flash ring
        self.rings.append(ShockwaveRing(x, y, (255, 200, 80), max_radius=160.0, duration=0.38, width=6))
        self.rings.append(ShockwaveRing(x, y, color, max_radius=220.0, duration=0.48, width=3))

        # Fiery debris
        for _ in range(count):
            angle = random.uniform(0, math.tau)
            speed = random.uniform(150, 650)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            # Mix orange, bright yellow, hot white
            c = random.choice([
                (255, 255, 220),
                (255, 180, 40),
                (255, 80, 20),
                (220, 30, 80)
            ])
            life = random.uniform(0.35, 0.9)
            size = random.uniform(3.0, 7.0)
            self.particles.append(Particle(x, y, vx, vy, c, size, life, drag=0.92, gravity=200.0))

    def add_shockwave(self, x, y, color=(0, 255, 255), radius=180):
        self.rings.append(ShockwaveRing(x, y, color, max_radius=radius, duration=0.32, width=5))
        for _ in range(25):
            angle = random.uniform(0, math.tau)
            speed = random.uniform(200, 500)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            self.particles.append(Particle(x, y, vx, vy, color, 3.0, random.uniform(0.2, 0.45), drag=0.94, gravity=50.0))

    def add_portal_swirl(self, x, y, color):
        for _ in range(4):
            angle = random.uniform(0, math.tau)
            dist = random.uniform(18, 38)
            px = x + math.cos(angle) * dist
            py = y + math.sin(angle) * dist
            # Tangential velocity
            vx = -math.sin(angle) * 80 + (x - px) * 2
            vy = math.cos(angle) * 80 + (y - py) * 2
            self.particles.append(Particle(px, py, vx, vy, color, 2.5, random.uniform(0.25, 0.5), drag=0.98, gravity=0))

    def update(self, dt):
        self.particles = [p for p in self.particles if p.update(dt)]
        self.rings = [r for r in self.rings if r.update(dt)]

    def draw(self, surface):
        # Draw shockwave rings with additive blend
        for ring in self.rings:
            ring.draw(surface)

        # Draw particles
        for p in self.particles:
            alpha = max(0, min(255, int(255 * (p.life / p.max_life))))
            size = max(1, int(p.size * (p.life / p.max_life)))
            r, g, b = p.color[:3]
            # Fast draw circle or anti-aliased dot
            pygame.draw.circle(surface, (r, g, b), (int(p.x), int(p.y)), size)

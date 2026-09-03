"""
Neon Chaos Sandbox: Physics & Ragdoll Playground
An interactive 2D physics toy game featuring soft-body jelly blobs,
articulated ragdolls, TNT chain reactions, gravitational singularities,
kinetic shockwaves, and procedural synthesizer audio.
"""

import sys
import os
import math
import random
import pygame

from audio import SoundEngine
from particles import ParticleSystem
from physics import (
    PhysicsWorld, SoftJellyBlob, Ragdoll, TNTCrate, BouncyBall, Bumper, Portal, PointMass
)

WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 720
FPS = 60

# Palette
COLOR_BG = (12, 14, 24)
COLOR_GRID = (25, 30, 50)
COLOR_CYAN = (0, 240, 255)
COLOR_MAGENTA = (255, 0, 140)
COLOR_YELLOW = (255, 220, 0)
COLOR_GREEN = (50, 255, 120)
COLOR_WHITE = (255, 255, 255)

class NeonChaosApp:
    def __init__(self, test_mode=False):
        pygame.init()
        pygame.display.set_caption("Neon Chaos Sandbox: Physics & Ragdoll Playground")

        self.test_mode = test_mode
        if test_mode:
            # Headless or dummy surface for testing
            os.environ["SDL_VIDEODRIVER"] = "dummy"
            self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        else:
            self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))

        self.clock = pygame.time.Clock()
        self.running = True

        # Systems
        self.audio = SoundEngine()
        self.particles = ParticleSystem()
        self.world = PhysicsWorld(WINDOW_WIDTH, WINDOW_HEIGHT)

        # Tools & State
        self.tools = ["Jelly", "Ragdoll", "Neon Ball", "TNT Crate", "Bumper", "Portal", "Laser"]
        self.tool_keys = ["1", "2", "3", "4", "5", "6", "7"]
        self.active_tool_idx = 0
        self.portal_first_click = None

        # Drag state
        self.grabbed_point = None
        self.grab_mouse_offset = (0, 0)

        # Environment / Modes
        self.gravity_modes = [
            ("Normal 1.0G", [0.0, 980.0]),
            ("Moon 0.2G", [0.0, 200.0]),
            ("Zero-G", [0.0, 0.0]),
            ("Inverted -1.0G", [0.0, -980.0]),
        ]
        self.gravity_idx = 0
        self.slow_motion = False
        self.screen_shake = 0.0
        self.show_help = True
        self.time_counter = 0.0

        # Fonts
        self.font_title = pygame.font.SysFont("Segoe UI, Arial, sans-serif", 20, bold=True)
        self.font_ui = pygame.font.SysFont("Segoe UI, Arial, sans-serif", 14)
        self.font_big = pygame.font.SysFont("Segoe UI, Arial, sans-serif", 32, bold=True)

        self._load_preset_playground()

    def _load_preset_playground(self):
        self.world.clear_all()
        self.particles.clear()

        # Add pinball bumpers
        self.world.bumpers.append(Bumper(320, 480, radius=36, color=COLOR_MAGENTA))
        self.world.bumpers.append(Bumper(960, 480, radius=36, color=COLOR_CYAN))
        self.world.bumpers.append(Bumper(640, 320, radius=42, color=COLOR_YELLOW))

        # Add Teleport Portal Pair
        self.world.portals.append(Portal(140, 580, 1140, 240))

        # Add initial entities
        # 1. Jelly blob in top-left
        self.world.add_entity(SoftJellyBlob(320, 180, radius=40, color=COLOR_GREEN, entity_id=1))
        # 2. Ragdoll in top-right
        self.world.add_entity(Ragdoll(960, 160, scale=1.1, color=COLOR_YELLOW, entity_id=2))
        # 3. Stack of TNT
        self.world.add_entity(TNTCrate(620, 520, size=38, entity_id=3))
        self.world.add_entity(TNTCrate(660, 520, size=38, entity_id=4))
        self.world.add_entity(TNTCrate(640, 480, size=38, entity_id=5))
        # 4. Neon balls
        for i in range(4):
            self.world.add_entity(BouncyBall(500 + i * 80, 100, radius=18, entity_id=10 + i))

    def _find_nearest_point(self, pos, max_dist=45.0):
        nearest = None
        min_d = max_dist
        for p in self.world.point_masses:
            d = math.hypot(p.x - pos[0], p.y - pos[1])
            if d < min_d:
                min_d = d
                nearest = p
        return nearest

    def _spawn_selected_tool(self, pos):
        tool_name = self.tools[self.active_tool_idx]
        eid = self.world._next_entity_id
        self.world._next_entity_id += 1

        if tool_name == "Jelly":
            colors = [(50, 255, 120), (0, 240, 255), (255, 0, 180), (255, 220, 50)]
            c = random.choice(colors)
            self.world.add_entity(SoftJellyBlob(pos[0], pos[1], radius=random.uniform(32, 44), color=c, entity_id=eid))
            self.particles.add_sparks(pos[0], pos[1], c, count=16)
            self.audio.play_squish(0.8)

        elif tool_name == "Ragdoll":
            c = random.choice([(255, 230, 60), (0, 255, 220), (255, 110, 200)])
            self.world.add_entity(Ragdoll(pos[0], pos[1], scale=random.uniform(0.9, 1.2), color=c, entity_id=eid))
            self.particles.add_sparks(pos[0], pos[1], c, count=16)
            self.audio.play_bounce(300)

        elif tool_name == "Neon Ball":
            b = self.world.add_entity(BouncyBall(pos[0], pos[1], radius=random.uniform(14, 28), entity_id=eid))
            self.particles.add_sparks(pos[0], pos[1], b.point.color, count=12)
            self.audio.play_bounce(400)

        elif tool_name == "TNT Crate":
            self.world.add_entity(TNTCrate(pos[0], pos[1], size=random.uniform(34, 46), entity_id=eid))
            self.particles.add_sparks(pos[0], pos[1], (255, 100, 30), count=14)
            self.audio.play_bounce(200)

        elif tool_name == "Bumper":
            c = random.choice([COLOR_MAGENTA, COLOR_CYAN, COLOR_YELLOW])
            self.world.bumpers.append(Bumper(pos[0], pos[1], radius=random.uniform(30, 45), color=c))
            self.particles.add_shockwave(pos[0], pos[1], c, radius=90)
            self.audio.play_bumper()

        elif tool_name == "Portal":
            if self.portal_first_click is None:
                self.portal_first_click = pos
                self.particles.add_shockwave(pos[0], pos[1], COLOR_CYAN, radius=60)
            else:
                self.world.portals.append(Portal(self.portal_first_click[0], self.portal_first_click[1], pos[0], pos[1]))
                self.particles.add_shockwave(pos[0], pos[1], COLOR_MAGENTA, radius=60)
                self.audio.play_portal()
                self.portal_first_click = None

    def trigger_shockwave(self, pos):
        self.screen_shake = 12.0
        self.particles.add_shockwave(pos[0], pos[1], COLOR_CYAN, radius=240)
        self.audio.play_shockwave()
        # Repel all physics points
        for p in self.world.point_masses:
            dx = p.x - pos[0]
            dy = p.y - pos[1]
            dist = max(1.0, math.hypot(dx, dy))
            if dist < 320:
                impulse = (1.0 - (dist / 320.0)) * 900.0
                nx = dx / dist
                ny = dy / dist
                p.apply_impulse(nx * impulse, ny * impulse)

    def trigger_tnt_explosion(self, tnt):
        cx, cy = tnt.center
        self.screen_shake = 22.0
        self.particles.add_explosion(cx, cy, count=70)
        self.audio.play_explosion()

        # Remove TNT
        self.world.remove_entity(tnt)

        # Blast surrounding bodies and trigger chain reactions
        for ent in list(self.world.entities):
            if isinstance(ent, TNTCrate) and not ent.fuse_lit:
                tcx, tcy = ent.center
                if math.hypot(tcx - cx, tcy - cy) < 180:
                    ent.ignite()
                    ent.fuse_time = random.uniform(0.15, 0.4) # Rapid chain fire

        for p in self.world.point_masses:
            dx = p.x - cx
            dy = p.y - cy
            dist = max(1.0, math.hypot(dx, dy))
            if dist < 260:
                force = (1.0 - (dist / 260.0)) * 1400.0
                p.apply_impulse((dx / dist) * force, (dy / dist) * force)

    def handle_input(self):
        mouse_pos = pygame.mouse.get_pos()
        mouse_pressed = pygame.mouse.get_pressed()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                return

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE:
                    self.trigger_shockwave(mouse_pos)
                elif event.key == pygame.K_g:
                    self.gravity_idx = (self.gravity_idx + 1) % len(self.gravity_modes)
                    name, grav = self.gravity_modes[self.gravity_idx]
                    self.world.gravity = list(grav)
                    self.particles.add_shockwave(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2, COLOR_YELLOW, radius=300)
                    self.audio.play_portal()
                elif event.key in (pygame.K_t, pygame.K_TAB):
                    self.slow_motion = not self.slow_motion
                    self.audio.play_bounce(500)
                elif event.key == pygame.K_c:
                    self.world.clear_all()
                    self.particles.clear()
                    self.audio.play_squish(0.4)
                elif event.key == pygame.K_r:
                    self._load_preset_playground()
                    self.audio.play_bumper()
                elif event.key == pygame.K_h:
                    self.show_help = not self.show_help

                # Number keys 1-7
                for idx, k_str in enumerate(self.tool_keys):
                    if event.key == getattr(pygame, f"K_{k_str}"):
                        self.active_tool_idx = idx
                        self.audio.play_bounce(300)

            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1: # Left Click
                    # Check if clicking Dock buttons at bottom
                    if mouse_pos[1] > WINDOW_HEIGHT - 60:
                        btn_w = 110
                        start_x = (WINDOW_WIDTH - (len(self.tools) * (btn_w + 10))) // 2
                        for idx in range(len(self.tools)):
                            rx = start_x + idx * (btn_w + 10)
                            if rx <= mouse_pos[0] <= rx + btn_w:
                                self.active_tool_idx = idx
                                self.audio.play_bounce(250)
                                break
                        continue

                    # Check if grabbing an existing point
                    target = self._find_nearest_point(mouse_pos)
                    if target and self.tools[self.active_tool_idx] != "Laser":
                        self.grabbed_point = target
                    else:
                        if self.tools[self.active_tool_idx] != "Laser":
                            self._spawn_selected_tool(mouse_pos)

                elif event.button == 2: # Middle Click
                    self.trigger_shockwave(mouse_pos)

            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:
                    self.grabbed_point = None

        # Right click held: Black Hole Singularity
        if mouse_pressed[2]:
            self.world.black_hole_pos = mouse_pos
            # Swirling black hole particles
            for _ in range(3):
                a = random.uniform(0, math.tau)
                r = random.uniform(30, 90)
                self.particles.particles.append(
                    self.particles.Particle(
                        mouse_pos[0] + math.cos(a) * r,
                        mouse_pos[1] + math.sin(a) * r,
                        -math.cos(a) * 140 - math.sin(a) * 80,
                        -math.sin(a) * 140 + math.cos(a) * 80,
                        COLOR_MAGENTA, 3.0, 0.35, drag=0.96, gravity=0
                    )
                )
        else:
            self.world.black_hole_pos = None

        # Laser Tool active
        if mouse_pressed[0] and self.tools[self.active_tool_idx] == "Laser":
            self._handle_laser(mouse_pos)

        # Dragging grabbed point
        if self.grabbed_point:
            dx = mouse_pos[0] - self.grabbed_point.x
            dy = mouse_pos[1] - self.grabbed_point.y
            spring_k = 0.35
            self.grabbed_point.x += dx * spring_k
            self.grabbed_point.y += dy * spring_k

    def _handle_laser(self, mouse_pos):
        # Laser ray from bottom center to mouse
        origin = (WINDOW_WIDTH // 2, WINDOW_HEIGHT - 70)
        lx = mouse_pos[0] - origin[0]
        ly = mouse_pos[1] - origin[1]
        ldist = max(1.0, math.hypot(lx, ly))
        lnx, lny = lx / ldist, ly / ldist

        # Cut / ignite TNT or push points
        for ent in self.world.entities:
            if isinstance(ent, TNTCrate) and not ent.fuse_lit:
                tcx, tcy = ent.center
                # Distance from point to ray segment
                proj = (tcx - origin[0]) * lnx + (tcy - origin[1]) * lny
                if 0 <= proj <= ldist:
                    qx = origin[0] + lnx * proj
                    qy = origin[1] + lny * proj
                    if math.hypot(tcx - qx, tcy - qy) < 30:
                        ent.ignite()
                        self.particles.add_sparks(tcx, tcy, (255, 200, 0), count=10)

        # Apply radiant laser pressure to nearby points
        for p in self.world.point_masses:
            proj = (p.x - origin[0]) * lnx + (p.y - origin[1]) * lny
            if 0 <= proj <= ldist:
                qx = origin[0] + lnx * proj
                qy = origin[1] + lny * proj
                if math.hypot(p.x - qx, p.y - qy) < 25:
                    p.apply_impulse(lnx * 35.0, lny * 35.0)

    def update(self, dt):
        self.time_counter += dt

        # Slow motion
        sim_dt = dt * 0.22 if self.slow_motion else dt

        # Screen shake decay
        if self.screen_shake > 0:
            self.screen_shake = max(0.0, self.screen_shake - dt * 25.0)

        # Update TNT fuses & explosions
        for ent in list(self.world.entities):
            if isinstance(ent, TNTCrate):
                detonated = ent.update(sim_dt)
                if detonated:
                    self.trigger_tnt_explosion(ent)

        # Update Jelly eyes
        mouse_pos = pygame.mouse.get_pos()
        for ent in self.world.entities:
            if isinstance(ent, SoftJellyBlob):
                ent.update_eyes(sim_dt)
            elif isinstance(ent, BouncyBall):
                ent.update_trail()

        # Update Bumpers
        for b in self.world.bumpers:
            b.update(sim_dt)

        # Update Portals & check teleport
        for portal in self.world.portals:
            portal.update(sim_dt)
            for p in self.world.point_masses:
                if portal.check_teleport(p):
                    self.particles.add_portal_swirl(p.x, p.y, COLOR_CYAN)
                    self.audio.play_portal()

        # Physics Step
        self.world.step(sim_dt)

        # Check impacts for sound effects
        for p in self.world.point_masses:
            speed = math.hypot(p.vx, p.vy) / max(sim_dt, 0.001)
            # Wall impacts
            if p.x <= p.radius + 1 or p.x >= WINDOW_WIDTH - p.radius - 1 or \
               p.y <= p.radius + 1 or p.y >= WINDOW_HEIGHT - p.radius - 1:
                if speed > 180:
                    self.audio.play_bounce(speed)
                    self.particles.add_sparks(p.x, p.y, p.color, count=max(3, int(speed / 120)))

        # Update Particles
        self.particles.update(sim_dt)

    def draw(self):
        # Apply Screen Shake Offset
        shake_x = 0
        shake_y = 0
        if self.screen_shake > 0.5:
            shake_x = random.uniform(-self.screen_shake, self.screen_shake)
            shake_y = random.uniform(-self.screen_shake, self.screen_shake)

        # Render background with cyber grid
        self.screen.fill(COLOR_BG)

        # Cyber Grid Lines
        grid_step = 60
        for x in range(0, WINDOW_WIDTH, grid_step):
            pygame.draw.line(self.screen, COLOR_GRID, (x + shake_x, 0), (x + shake_x, WINDOW_HEIGHT))
        for y in range(0, WINDOW_HEIGHT, grid_step):
            pygame.draw.line(self.screen, COLOR_GRID, (0, y + shake_y), (WINDOW_WIDTH, y + shake_y))

        # Portals
        portal_pulse = self.time_counter * 3.0
        for portal in self.world.portals:
            portal.draw(self.screen, portal_pulse)

        # Bumpers
        for b in self.world.bumpers:
            b.draw(self.screen)

        # Physics Entities
        mouse_pos = pygame.mouse.get_pos()
        for ent in self.world.entities:
            if isinstance(ent, SoftJellyBlob):
                ent.draw(self.screen, mouse_pos)
            elif isinstance(ent, (Ragdoll, TNTCrate, BouncyBall)):
                ent.draw(self.screen)

        # Draw Elastic Grab Spring Line
        if self.grabbed_point:
            pygame.draw.line(self.screen, (255, 255, 255),
                             (int(self.grabbed_point.x), int(self.grabbed_point.y)),
                             mouse_pos, 2)
            pygame.draw.circle(self.screen, (255, 255, 255), mouse_pos, 5)

        # Draw Laser Beam
        if pygame.mouse.get_pressed()[0] and self.tools[self.active_tool_idx] == "Laser":
            origin = (WINDOW_WIDTH // 2, WINDOW_HEIGHT - 70)
            pygame.draw.line(self.screen, (255, 60, 60), origin, mouse_pos, 5)
            pygame.draw.line(self.screen, (255, 255, 255), origin, mouse_pos, 2)
            pygame.draw.circle(self.screen, (255, 220, 220), mouse_pos, 9)

        # Draw Black Hole Singularity
        if self.world.black_hole_pos:
            bx, by = self.world.black_hole_pos
            # Swirling black hole rings
            for r, c in [(28, (20, 0, 40)), (20, (60, 0, 90)), (14, (0, 0, 0))]:
                pygame.draw.circle(self.screen, c, (int(bx), int(by)), r)
            pygame.draw.circle(self.screen, COLOR_MAGENTA, (int(bx), int(by)), 24, 2)
            pygame.draw.circle(self.screen, COLOR_CYAN, (int(bx), int(by)), 32, 1)

        # Particles
        self.particles.draw(self.screen)

        # UI Overlay & Dock
        self._draw_ui()

        pygame.display.flip()

    def _draw_ui(self):
        # 1. Top HUD Info Bar
        grav_name = self.gravity_modes[self.gravity_idx][0]
        slow_txt = " [BULLET-TIME ACTIVE]" if self.slow_motion else ""

        hud_left = f"FPS: {int(self.clock.get_fps())} | Objects: {len(self.world.entities)} | Gravity: {grav_name}{slow_txt}"
        surf_left = self.font_ui.render(hud_left, True, COLOR_CYAN)
        self.screen.blit(surf_left, (20, 16))

        # Title
        title = self.font_title.render("NEON CHAOS SANDBOX", True, COLOR_WHITE)
        self.screen.blit(title, (WINDOW_WIDTH // 2 - title.get_width() // 2, 12))

        # Help Guide toggle button
        help_btn_txt = "[H] Hide Controls" if self.show_help else "[H] Show Controls"
        surf_help = self.font_ui.render(help_btn_txt, True, (160, 180, 220))
        self.screen.blit(surf_help, (WINDOW_WIDTH - surf_help.get_width() - 20, 16))

        # 2. Controls Panel Overlay
        if self.show_help:
            panel_w, panel_h = 360, 190
            px = WINDOW_WIDTH - panel_w - 20
            py = 48
            surf_panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
            surf_panel.fill((18, 22, 38, 210))
            pygame.draw.rect(surf_panel, (60, 80, 130), (0, 0, panel_w, panel_h), 1, border_radius=8)
            self.screen.blit(surf_panel, (px, py))

            tips = [
                "- Left Click: Spawn / Drag & Toss Object",
                "- Right Click (Hold): Black Hole Singularity",
                "- Space / Middle Click: Kinetic Shockwave",
                "- Keys [1 - 7]: Select Spawn Tool",
                "- [G]: Cycle Gravity (Normal / Moon / Zero / Invert)",
                "- [T] / [Tab]: Toggle Slow-Motion Bullet Time",
                "- [C]: Clear Playground | [R]: Reset Scene",
            ]
            for i, tip in enumerate(tips):
                t_surf = self.font_ui.render(tip, True, (210, 230, 255))
                self.screen.blit(t_surf, (px + 14, py + 12 + i * 24))

        # 3. Bottom Tool Dock
        btn_w = 110
        btn_h = 44
        start_x = (WINDOW_WIDTH - (len(self.tools) * (btn_w + 10))) // 2
        dock_y = WINDOW_HEIGHT - 56

        dock_bg = pygame.Surface((len(self.tools) * (btn_w + 10) + 20, btn_h + 16), pygame.SRCALPHA)
        dock_bg.fill((16, 20, 34, 220))
        pygame.draw.rect(dock_bg, (50, 65, 100), (0, 0, dock_bg.get_width(), dock_bg.get_height()), 1, border_radius=10)
        self.screen.blit(dock_bg, (start_x - 10, dock_y - 8))

        mouse_pos = pygame.mouse.get_pos()
        for idx, (name, key) in enumerate(zip(self.tools, self.tool_keys)):
            bx = start_x + idx * (btn_w + 10)
            is_active = (idx == self.active_tool_idx)
            is_hover = (bx <= mouse_pos[0] <= bx + btn_w and dock_y <= mouse_pos[1] <= dock_y + btn_h)

            bg_color = (40, 60, 110) if is_active else ((30, 40, 65) if is_hover else (22, 28, 46))
            border_color = COLOR_CYAN if is_active else ((120, 160, 220) if is_hover else (50, 65, 95))

            pygame.draw.rect(self.screen, bg_color, (bx, dock_y, btn_w, btn_h), border_radius=6)
            pygame.draw.rect(self.screen, border_color, (bx, dock_y, btn_w, btn_h), 2 if is_active else 1, border_radius=6)

            # Text
            txt = self.font_ui.render(f"[{key}] {name}", True, COLOR_WHITE if is_active else (190, 210, 240))
            self.screen.blit(txt, (bx + btn_w // 2 - txt.get_width() // 2, dock_y + btn_h // 2 - txt.get_height() // 2))

    def run(self):
        ticks = 0
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            dt = min(dt, 0.05) # Prevent large time jumps

            self.handle_input()
            self.update(dt)

            if not self.test_mode:
                self.draw()

            if self.test_mode:
                ticks += 1
                # Test automated tool changes and steps
                if ticks == 20:
                    self.active_tool_idx = 0 # Jelly
                    self._spawn_selected_tool((400, 300))
                elif ticks == 40:
                    self.trigger_shockwave((500, 400))
                elif ticks == 60:
                    self.active_tool_idx = 3 # TNT
                    self._spawn_selected_tool((600, 350))
                elif ticks == 80:
                    self.slow_motion = True
                elif ticks >= 120:
                    print(f"Test mode successfully verified {ticks} frames!")
                    self.running = False

        pygame.quit()

if __name__ == "__main__":
    test_flag = "--test-mode" in sys.argv
    app = NeonChaosApp(test_mode=test_flag)
    app.run()

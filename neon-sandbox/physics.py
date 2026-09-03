"""
Verlet Physics Engine for Neon Chaos Sandbox.
Includes Soft-Body Jelly Blobs, Articulated Ragdolls, TNT Crates,
Elastic Bouncy Balls, Pinball Bumpers, and Gravitational Portals.
"""

import math
import random
import pygame

class PointMass:
    __slots__ = ('x', 'y', 'old_x', 'old_y', 'mass', 'radius', 'color', 'is_pinned', 'entity_id')
    def __init__(self, x, y, mass=1.0, radius=8.0, color=(0, 255, 255), entity_id=0):
        self.x = float(x)
        self.y = float(y)
        self.old_x = float(x)
        self.old_y = float(y)
        self.mass = float(mass)
        self.radius = float(radius)
        self.color = color
        self.is_pinned = False
        self.entity_id = entity_id

    @property
    def vx(self):
        return self.x - self.old_x

    @property
    def vy(self):
        return self.y - self.old_y

    def apply_force(self, fx, fy, dt):
        if self.is_pinned or self.mass <= 0:
            return
        inv_mass = 1.0 / self.mass
        self.x += fx * inv_mass * dt * dt
        self.y += fy * inv_mass * dt * dt

    def apply_impulse(self, ix, iy):
        if self.is_pinned or self.mass <= 0:
            return
        inv_mass = 1.0 / self.mass
        self.old_x -= ix * inv_mass
        self.old_y -= iy * inv_mass

    def verlet_step(self, dt, gravity, friction=0.992):
        if self.is_pinned:
            return
        vx = (self.x - self.old_x) * friction
        vy = (self.y - self.old_y) * friction

        self.old_x = self.x
        self.old_y = self.y

        self.x += vx + gravity[0] * dt * dt
        self.y += vy + gravity[1] * dt * dt

    def constrain_bounds(self, width, height, bounce=0.72):
        if self.is_pinned:
            return 0.0

        impact_speed = 0.0
        r = self.radius

        # Left / Right
        if self.x < r:
            vx = self.x - self.old_x
            self.x = r
            self.old_x = self.x + vx * bounce
            impact_speed = max(impact_speed, abs(vx))
        elif self.x > width - r:
            vx = self.x - self.old_x
            self.x = width - r
            self.old_x = self.x + vx * bounce
            impact_speed = max(impact_speed, abs(vx))

        # Top / Bottom
        if self.y < r:
            vy = self.y - self.old_y
            self.y = r
            self.old_y = self.y + vy * bounce
            impact_speed = max(impact_speed, abs(vy))
        elif self.y > height - r:
            vy = self.y - self.old_y
            self.y = height - r
            self.old_y = self.y + vy * bounce
            impact_speed = max(impact_speed, abs(vy))

        return impact_speed

class Constraint:
    __slots__ = ('p1', 'p2', 'target_dist', 'stiffness', 'color', 'visible')
    def __init__(self, p1, p2, stiffness=0.85, target_dist=None, color=(0, 255, 255), visible=True):
        self.p1 = p1
        self.p2 = p2
        dx = p2.x - p1.x
        dy = p2.y - p1.y
        self.target_dist = float(target_dist) if target_dist is not None else math.hypot(dx, dy)
        self.stiffness = float(stiffness)
        self.color = color
        self.visible = visible

    def resolve(self):
        dx = self.p2.x - self.p1.x
        dy = self.p2.y - self.p1.y
        dist = math.hypot(dx, dy)
        if dist < 1e-4:
            return

        diff = (dist - self.target_dist) / dist
        w1 = 0.0 if self.p1.is_pinned else (1.0 / self.p1.mass)
        w2 = 0.0 if self.p2.is_pinned else (1.0 / self.p2.mass)
        w_sum = w1 + w2
        if w_sum <= 0:
            return

        delta_x = dx * diff * self.stiffness / w_sum
        delta_y = dy * diff * self.stiffness / w_sum

        if not self.p1.is_pinned:
            self.p1.x += delta_x * w1
            self.p1.y += delta_y * w1
        if not self.p2.is_pinned:
            self.p2.x -= delta_x * w2
            self.p2.y -= delta_y * w2

class BouncyBall:
    def __init__(self, x, y, radius=18.0, color=None, entity_id=0):
        if color is None:
            color = random.choice([
                (0, 255, 255),    # Cyan
                (255, 0, 128),    # Neon Pink
                (0, 255, 128),    # Emerald
                (255, 215, 0),    # Electric Gold
                (180, 70, 255),   # Violet
            ])
        self.entity_id = entity_id
        mass = (radius / 15.0) ** 2
        self.point = PointMass(x, y, mass=mass, radius=radius, color=color, entity_id=entity_id)
        self.glow_radius = radius + 6
        self.trail = []

    def update_trail(self):
        self.trail.append((self.point.x, self.point.y))
        if len(self.trail) > 8:
            self.trail.pop(0)

    def draw(self, surface):
        px, py = int(self.point.x), int(self.point.y)
        r = int(self.point.radius)
        # Trail
        if len(self.trail) > 1:
            for i in range(len(self.trail) - 1):
                alpha = int(255 * (i / len(self.trail)))
                width = max(1, int(r * 0.4 * (i / len(self.trail))))
                pygame.draw.line(surface, self.point.color, self.trail[i], self.trail[i+1], width)

        # Outer neon glow ring
        pygame.draw.circle(surface, (max(0, self.point.color[0]//2),
                                    max(0, self.point.color[1]//2),
                                    max(0, self.point.color[2]//2)), (px, py), r + 4, 2)
        # Main solid orb
        pygame.draw.circle(surface, self.point.color, (px, py), r)
        # Inner highlight
        pygame.draw.circle(surface, (255, 255, 255), (px - r//3, py - r//3), max(2, r//4))

class SoftJellyBlob:
    def __init__(self, x, y, radius=42.0, num_points=10, color=(50, 255, 130), entity_id=0):
        self.entity_id = entity_id
        self.radius = radius
        self.color = color
        self.center = PointMass(x, y, mass=2.5, radius=12.0, color=color, entity_id=entity_id)
        self.points = [self.center]
        self.perimeter_points = []
        self.constraints = []
        self.blink_timer = random.uniform(2.0, 5.0)
        self.is_blinking = False

        # Generate perimeter points
        for i in range(num_points):
            angle = i * (math.tau / num_points)
            px = x + math.cos(angle) * radius
            py = y + math.sin(angle) * radius
            pm = PointMass(px, py, mass=0.8, radius=8.0, color=color, entity_id=entity_id)
            self.points.append(pm)
            self.perimeter_points.append(pm)

        # Perimeter constraints
        for i in range(num_points):
            p1 = self.perimeter_points[i]
            p2 = self.perimeter_points[(i + 1) % num_points]
            self.constraints.append(Constraint(p1, p2, stiffness=0.88, color=color))

        # Radial spokes to center
        for p in self.perimeter_points:
            self.constraints.append(Constraint(self.center, p, stiffness=0.75, color=color, visible=False))

        # Cross-diagonal structural springs for soft volume preservation
        for i in range(num_points):
            opp = self.perimeter_points[(i + num_points // 2) % num_points]
            self.constraints.append(Constraint(self.perimeter_points[i], opp, stiffness=0.45, color=color, visible=False))

    def update_eyes(self, dt):
        self.blink_timer -= dt
        if self.blink_timer <= 0:
            if not self.is_blinking:
                self.is_blinking = True
                self.blink_timer = 0.15 # Blink duration
            else:
                self.is_blinking = False
                self.blink_timer = random.uniform(2.5, 6.0)

    def draw(self, surface, mouse_pos):
        # Draw soft-body filled polygon
        poly_points = [(int(p.x), int(p.y)) for p in self.perimeter_points]
        if len(poly_points) >= 3:
            # Semi-transparent body
            body_surf = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
            r, g, b = self.color
            pygame.draw.polygon(body_surf, (r, g, b, 175), poly_points)
            # Glowing border
            pygame.draw.polygon(surface, self.color, poly_points, 3)
            surface.blit(body_surf, (0, 0))

        # Draw expressive cartoon eyes inside the blob
        cx, cy = self.center.x, self.center.y
        eye_offset = self.radius * 0.32
        eye_r = self.radius * 0.22

        # Eye positions relative to velocity or upright
        dx = mouse_pos[0] - cx
        dy = mouse_pos[1] - cy
        dist = max(1.0, math.hypot(dx, dy))
        look_dx = (dx / dist) * (eye_r * 0.45)
        look_dy = (dy / dist) * (eye_r * 0.45)

        for eye_x in (cx - eye_offset, cx + eye_offset):
            eye_y = cy - eye_offset * 0.3
            if self.is_blinking:
                # Closed blinking eye line
                pygame.draw.line(surface, (20, 20, 30), (int(eye_x - eye_r), int(eye_y)), (int(eye_x + eye_r), int(eye_y)), 3)
            else:
                # White sclera
                pygame.draw.circle(surface, (255, 255, 255), (int(eye_x), int(eye_y)), int(eye_r))
                # Black pupil tracking mouse
                pygame.draw.circle(surface, (20, 20, 35), (int(eye_x + look_dx), int(eye_y + look_dy)), max(2, int(eye_r * 0.55)))
                # Cute highlight shine
                pygame.draw.circle(surface, (255, 255, 255), (int(eye_x + look_dx - 2), int(eye_y + look_dy - 2)), max(1, int(eye_r * 0.2)))

class Ragdoll:
    def __init__(self, x, y, scale=1.0, color=(255, 220, 50), entity_id=0):
        self.entity_id = entity_id
        self.color = color
        self.points = []
        self.constraints = []

        # Points: Head, Chest, Pelvis, Left Hand, Right Hand, Left Knee, Right Knee, Left Foot, Right Foot
        self.head = PointMass(x, y - 45 * scale, mass=1.2, radius=12 * scale, color=color, entity_id=entity_id)
        self.chest = PointMass(x, y - 20 * scale, mass=2.0, radius=10 * scale, color=color, entity_id=entity_id)
        self.pelvis = PointMass(x, y + 10 * scale, mass=2.0, radius=10 * scale, color=color, entity_id=entity_id)
        self.l_hand = PointMass(x - 30 * scale, y - 10 * scale, mass=0.6, radius=6 * scale, color=color, entity_id=entity_id)
        self.r_hand = PointMass(x + 30 * scale, y - 10 * scale, mass=0.6, radius=6 * scale, color=color, entity_id=entity_id)
        self.l_knee = PointMass(x - 14 * scale, y + 35 * scale, mass=0.8, radius=7 * scale, color=color, entity_id=entity_id)
        self.r_knee = PointMass(x + 14 * scale, y + 35 * scale, mass=0.8, radius=7 * scale, color=color, entity_id=entity_id)
        self.l_foot = PointMass(x - 16 * scale, y + 60 * scale, mass=0.7, radius=6 * scale, color=color, entity_id=entity_id)
        self.r_foot = PointMass(x + 16 * scale, y + 60 * scale, mass=0.7, radius=6 * scale, color=color, entity_id=entity_id)

        self.points = [self.head, self.chest, self.pelvis, self.l_hand, self.r_hand, self.l_knee, self.r_knee, self.l_foot, self.r_foot]

        # Skeleton Constraints
        c = [
            (self.head, self.chest, 0.95),
            (self.chest, self.pelvis, 0.95),
            (self.chest, self.l_hand, 0.88),
            (self.chest, self.r_hand, 0.88),
            (self.pelvis, self.l_knee, 0.88),
            (self.pelvis, self.r_knee, 0.88),
            (self.l_knee, self.l_foot, 0.88),
            (self.r_knee, self.r_foot, 0.88),
            # Structural cross-springs
            (self.head, self.pelvis, 0.5),
            (self.l_hand, self.r_hand, 0.3),
        ]
        for p1, p2, stiff in c:
            self.constraints.append(Constraint(p1, p2, stiffness=stiff, color=color))

    def draw(self, surface):
        # Draw limbs
        for c in self.constraints:
            if c.visible:
                pygame.draw.line(surface, self.color, (int(c.p1.x), int(c.p1.y)), (int(c.p2.x), int(c.p2.y)), 4)

        # Draw head with glowing cyber-visor
        hx, hy = int(self.head.x), int(self.head.y)
        hr = int(self.head.radius)
        pygame.draw.circle(surface, (255, 255, 255), (hx, hy), hr)
        pygame.draw.circle(surface, self.color, (hx, hy), hr, 2)
        # Cyan visor line
        pygame.draw.line(surface, (0, 255, 255), (hx - hr//2, hy), (hx + hr//2, hy), 3)

        # Joints
        for p in self.points[1:]:
            pygame.draw.circle(surface, self.color, (int(p.x), int(p.y)), int(p.radius))

class TNTCrate:
    def __init__(self, x, y, size=38.0, entity_id=0):
        self.entity_id = entity_id
        self.size = size
        self.color = (240, 60, 40)
        hs = size / 2
        # 4 corners
        self.tl = PointMass(x - hs, y - hs, mass=1.8, radius=6.0, color=self.color, entity_id=entity_id)
        self.tr = PointMass(x + hs, y - hs, mass=1.8, radius=6.0, color=self.color, entity_id=entity_id)
        self.br = PointMass(x + hs, y + hs, mass=1.8, radius=6.0, color=self.color, entity_id=entity_id)
        self.bl = PointMass(x - hs, y + hs, mass=1.8, radius=6.0, color=self.color, entity_id=entity_id)
        self.points = [self.tl, self.tr, self.br, self.bl]

        # Perimeter box & structural X braces
        self.constraints = [
            Constraint(self.tl, self.tr, stiffness=0.98, color=self.color),
            Constraint(self.tr, self.br, stiffness=0.98, color=self.color),
            Constraint(self.br, self.bl, stiffness=0.98, color=self.color),
            Constraint(self.bl, self.tl, stiffness=0.98, color=self.color),
            Constraint(self.tl, self.br, stiffness=0.98, color=self.color, visible=False),
            Constraint(self.tr, self.bl, stiffness=0.98, color=self.color, visible=False),
        ]

        self.fuse_lit = False
        self.fuse_time = 1.6
        self.flash_timer = 0.0

    @property
    def center(self):
        cx = sum(p.x for p in self.points) / 4.0
        cy = sum(p.y for p in self.points) / 4.0
        return cx, cy

    def ignite(self):
        self.fuse_lit = True

    def update(self, dt):
        if not self.fuse_lit:
            # Check impact violence
            for p in self.points:
                speed = math.hypot(p.vx, p.vy) / max(dt, 0.001)
                if speed > 650:
                    self.ignite()
                    break
        else:
            self.fuse_time -= dt
            self.flash_timer += dt * 12.0
            return self.fuse_time <= 0 # Triggers detonation
        return False

    def draw(self, surface):
        poly = [(int(p.x), int(p.y)) for p in self.points]
        flash_white = self.fuse_lit and (int(self.flash_timer) % 2 == 0)
        fill_color = (255, 255, 255) if flash_white else self.color

        pygame.draw.polygon(surface, fill_color, poly)
        pygame.draw.polygon(surface, (255, 220, 220) if flash_white else (255, 200, 0), poly, 3)

        # Draw "TNT" label in center
        cx, cy = self.center
        font = pygame.font.SysFont("Impact, Arial Black, sans-serif", 16)
        label = font.render("TNT", True, (20, 20, 20) if flash_white else (255, 255, 255))
        r = label.get_rect(center=(int(cx), int(cy)))
        surface.blit(label, r)

class Bumper:
    def __init__(self, x, y, radius=34.0, color=(255, 0, 210)):
        self.x = float(x)
        self.y = float(y)
        self.radius = float(radius)
        self.color = color
        self.hit_flash = 0.0

    def update(self, dt):
        if self.hit_flash > 0:
            self.hit_flash = max(0.0, self.hit_flash - dt * 4.0)

    def check_collision(self, point_mass):
        dx = point_mass.x - self.x
        dy = point_mass.y - self.y
        dist = math.hypot(dx, dy)
        min_dist = self.radius + point_mass.radius
        if dist < min_dist and dist > 1e-4:
            nx = dx / dist
            ny = dy / dist
            # High kinetic repulsion
            point_mass.x = self.x + nx * min_dist
            point_mass.y = self.y + ny * min_dist
            boost_speed = 700.0
            point_mass.old_x = point_mass.x - nx * boost_speed * 0.016
            point_mass.old_y = point_mass.y - ny * boost_speed * 0.016
            self.hit_flash = 1.0
            return True
        return False

    def draw(self, surface):
        px, py = int(self.x), int(self.y)
        r = int(self.radius)
        flash_c = (255, 255, 255) if self.hit_flash > 0.5 else self.color
        # Outer ring
        pygame.draw.circle(surface, flash_c, (px, py), r, 4)
        # Inner solid core
        core_r = int(r * (0.6 + 0.2 * self.hit_flash))
        pygame.draw.circle(surface, flash_c, (px, py), core_r)
        # High-score style ring dots
        pygame.draw.circle(surface, (255, 255, 255), (px, py), max(2, int(r * 0.25)))

class Portal:
    def __init__(self, x1, y1, x2, y2):
        self.p1 = [float(x1), float(y1)]
        self.p2 = [float(x2), float(y2)]
        self.radius = 32.0
        self.color1 = (0, 180, 255) # Cyan entrance
        self.color2 = (255, 140, 0) # Orange exit
        self.cooldowns = {} # point_mass -> cooldown timer

    def update(self, dt):
        for pm in list(self.cooldowns.keys()):
            self.cooldowns[pm] -= dt
            if self.cooldowns[pm] <= 0:
                del self.cooldowns[pm]

    def check_teleport(self, point_mass):
        if point_mass in self.cooldowns:
            return False

        # Check Gate 1
        d1 = math.hypot(point_mass.x - self.p1[0], point_mass.y - self.p1[1])
        if d1 < self.radius + point_mass.radius:
            vx = point_mass.vx
            vy = point_mass.vy
            point_mass.x = self.p2[0] + (vx / (math.hypot(vx, vy) + 1e-4)) * (self.radius + 10)
            point_mass.y = self.p2[1] + (vy / (math.hypot(vx, vy) + 1e-4)) * (self.radius + 10)
            point_mass.old_x = point_mass.x - vx * 1.15
            point_mass.old_y = point_mass.y - vy * 1.15
            self.cooldowns[point_mass] = 0.35
            return True

        # Check Gate 2
        d2 = math.hypot(point_mass.x - self.p2[0], point_mass.y - self.p2[1])
        if d2 < self.radius + point_mass.radius:
            vx = point_mass.vx
            vy = point_mass.vy
            point_mass.x = self.p1[0] + (vx / (math.hypot(vx, vy) + 1e-4)) * (self.radius + 10)
            point_mass.y = self.p1[1] + (vy / (math.hypot(vx, vy) + 1e-4)) * (self.radius + 10)
            point_mass.old_x = point_mass.x - vx * 1.15
            point_mass.old_y = point_mass.y - vy * 1.15
            self.cooldowns[point_mass] = 0.35
            return True

        return False

    def draw(self, surface, angle_pulse):
        for center, color in ((self.p1, self.color1), (self.p2, self.color2)):
            cx, cy = int(center[0]), int(center[1])
            r = int(self.radius)
            # Outer swirling oval/ring
            pygame.draw.circle(surface, color, (cx, cy), r, 3)
            pygame.draw.circle(surface, (255, 255, 255), (cx, cy), r - 6, 2)
            # Spinning portal nodes
            for i in range(4):
                a = angle_pulse + i * (math.pi / 2)
                nx = int(cx + math.cos(a) * (r - 3))
                ny = int(cy + math.sin(a) * (r - 3))
                pygame.draw.circle(surface, (255, 255, 255), (nx, ny), 3)

class PhysicsWorld:
    def __init__(self, width=1280, height=720):
        self.width = width
        self.height = height
        self.gravity = [0.0, 980.0]
        self.point_masses = []
        self.constraints = []
        self.entities = []
        self.bumpers = []
        self.portals = []
        self._next_entity_id = 1
        self.black_hole_pos = None

    def add_entity(self, entity):
        self.entities.append(entity)
        if hasattr(entity, 'points'):
            self.point_masses.extend(entity.points)
        elif hasattr(entity, 'point'):
            self.point_masses.append(entity.point)
        if hasattr(entity, 'constraints'):
            self.constraints.extend(entity.constraints)
        return entity

    def remove_entity(self, entity):
        if entity in self.entities:
            self.entities.remove(entity)
            pts = getattr(entity, 'points', [getattr(entity, 'point', None)])
            for p in pts:
                if p and p in self.point_masses:
                    self.point_masses.remove(p)
            csts = getattr(entity, 'constraints', [])
            for c in csts:
                if c in self.constraints:
                    self.constraints.remove(c)

    def clear_all(self):
        self.point_masses.clear()
        self.constraints.clear()
        self.entities.clear()
        self.bumpers.clear()
        self.portals.clear()

    def resolve_ball_collisions(self, restitution=0.82):
        n = len(self.point_masses)
        for i in range(n):
            p1 = self.point_masses[i]
            for j in range(i + 1, n):
                p2 = self.point_masses[j]
                if p1.entity_id != 0 and p1.entity_id == p2.entity_id:
                    continue # Skip points belonging to the same rigid body

                dx = p2.x - p1.x
                dy = p2.y - p1.y
                dist = math.hypot(dx, dy)
                min_dist = p1.radius + p2.radius

                if dist < min_dist and dist > 1e-4:
                    overlap = min_dist - dist
                    nx = dx / dist
                    ny = dy / dist

                    w1 = 0.0 if p1.is_pinned else (1.0 / p1.mass)
                    w2 = 0.0 if p2.is_pinned else (1.0 / p2.mass)
                    w_sum = w1 + w2
                    if w_sum <= 0:
                        continue

                    sep_x = nx * overlap / w_sum
                    sep_y = ny * overlap / w_sum

                    if not p1.is_pinned:
                        p1.x -= sep_x * w1 * restitution
                        p1.y -= sep_y * w1 * restitution
                    if not p2.is_pinned:
                        p2.x += sep_x * w2 * restitution
                        p2.y += sep_y * w2 * restitution

    def step(self, dt, substeps=6):
        sub_dt = dt / substeps

        for _ in range(substeps):
            # Apply Black Hole Gravity Singularity
            if self.black_hole_pos:
                bx, by = self.black_hole_pos
                for p in self.point_masses:
                    dx = bx - p.x
                    dy = by - p.y
                    dist_sq = dx * dx + dy * dy + 400.0 # epsilon to prevent singularity explosion
                    dist = math.sqrt(dist_sq)
                    force = 1200000.0 / dist_sq
                    fx = (dx / dist) * force
                    fy = (dy / dist) * force
                    # Tangential orbital swirl force
                    tx = -dy / dist * force * 0.4
                    ty = dx / dist * force * 0.4
                    p.apply_force(fx + tx, fy + ty, sub_dt)

            # Verlet Step
            for p in self.point_masses:
                p.verlet_step(sub_dt, self.gravity)

            # Solve Constraints
            for c in self.constraints:
                c.resolve()

            # Collide with boundaries
            for p in self.point_masses:
                p.constrain_bounds(self.width, self.height)

            # Collide with Bumpers
            for b in self.bumpers:
                for p in self.point_masses:
                    b.check_collision(p)

            # Collide between balls
            self.resolve_ball_collisions()

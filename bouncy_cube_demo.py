# bouncy_cube_demo.py

import pygame
import math
import sys

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bouncy Cube Physics Demo")

# Colors
WHITE = (255, 255, 255)
BLUE = (0, 100, 255)
RED = (255, 0, 0)
BLACK = (0, 0, 0)

# Physics parameters
gravity = 0.5
bounce_factor = 0.7
damping = 0.98

class BouncyCube:
    def __init__(self, x, y, size=30):
        self.x = x
        self.y = y
        self.size = size
        self.velocity_y = 0
        self.velocity_x = 0
        self.color = BLUE
        
    def update(self, dt):
        # Apply gravity
        self.velocity_y += gravity
        
        # Apply damping
        self.velocity_x *= damping
        self.velocity_y *= damping
        
        # Update position
        self.x += self.velocity_x
        self.y += self.velocity_y
        
        # Ground collision
        if self.y > HEIGHT - self.size:
            self.y = HEIGHT - self.size
            self.velocity_y = -self.velocity_y * bounce_factor
            
            # Apply friction when hitting the ground
            self.velocity_x *= 0.9
            
        # Wall collisions
        if self.x < 0:
            self.x = 0
            self.velocity_x = -self.velocity_x * bounce_factor
        elif self.x > WIDTH - self.size:
            self.x = WIDTH - self.size
            self.velocity_x = -self.velocity_x * bounce_factor
            
    def draw(self, surface):
        pygame.draw.rect(surface, self.color, (self.x, self.y, self.size, self.size))
        pygame.draw.rect(surface, BLACK, (self.x, self.y, self.size, self.size), 2)

def main():
    clock = pygame.time.Clock()
    
    # Create a bouncy cube
    cube = BouncyCube(WIDTH // 2, 100, 50)
    
    running = True
    while running:
        dt = clock.tick(60) / 1000.0  # Delta time in seconds
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    # Add a random impulse when space is pressed
                    cube.velocity_x += (pygame.time.get_ticks() % 100 - 50) / 10.0
                    cube.velocity_y -= 5
                    
        # Update physics
        cube.update(dt)
        
        # Draw everything
        screen.fill(WHITE)
        cube.draw(screen)
        
        pygame.display.flip()
    
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
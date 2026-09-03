# simple_bounce.py

import time
import math

class BouncyCube:
    """A simple 1D bouncy cube simulation."""
    def __init__(self, position=5.0, velocity=0.0):
        self.position = position
        self.velocity = velocity
        
        # Physics parameters
        self.gravity = 9.81 * 1.5  # Increased gravity for dramatic effect
        self.bounce_factor = 0.7    # Energy retained after bounce
        self.damping = 0.95         # Energy loss per second

    def update(self, dt):
        """
        Updates the cube's position and velocity using physics.
        
        Args:
            dt (float): Time step in seconds.
        """
        # Apply gravity
        self.velocity += self.gravity * dt
        
        # Apply damping (energy loss)
        self.velocity *= self.damping
        
        # Update position
        self.position += self.velocity * dt
        
        # Ground collision
        ground_level = 0.0
        if self.position < ground_level:
            self.position = ground_level
            self.velocity = -self.velocity * self.bounce_factor
            
            # Apply friction on horizontal movement upon impact
            self.velocity *= 0.9

    def get_position(self):
        """Returns the current position."""
        return self.position

def main():
    print("--- Simple Bouncy Cube Simulation ---")
    print("This simulation runs purely in Python without any 3D libraries.")
    print("It demonstrates the physics logic that would be used in the full 3D version.")
    print()
    
    cube = BouncyCube(position=5.0)
    dt = 1/60.0  # 60 FPS
    simulation_duration = 10  # Run for 10 seconds
    
    start_time = time.time()
    
    while time.time() - start_time < simulation_duration:
        cube.update(dt)
        elapsed = time.time() - start_time
        print(f"Time: {elapsed:.2f}s | Position: {cube.get_position():.2f}")
        time.sleep(0.01)  # Small delay to prevent CPU overload
    
    print("\n--- Simulation Finished ---")

if __name__ == "__main__":
    main()
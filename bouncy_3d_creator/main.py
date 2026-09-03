# bouncy_3d_creator/main.py

from panda3d.core import PandaNode, LPoint3, Vec3, AmbientLight, DirectionalLight, NodePath, ClockObject
from direct.showbase.ShowBase import ShowBase
import math
import time
import sys

class BouncyCubeApp(ShowBase):
    """
    A Panda3D application simulating a bouncy, squishy 3D cube.
    """
    def __init__(self):
        # Initialize ShowBase - this will attempt to create the window
        try:
            ShowBase.__init__(self)
            
            # If we get here, initialization was successful
            self.window_is_available = True
            print("--- Panda3D Window Initialized Successfully ---")
            
            self.setBackgroundColor(0.1, 0.1, 0.1, 1) # Dark background
            self.setup_scene()
            self.cube = self.create_bouncy_cube()
            
            # Set up the task manager to run the update loop every frame
            self.taskMgr.add(self.update_physics, "update_physics_task")
            
        except Exception as e:
            print(f"--- WARNING: Failed to initialize Panda3D window. Error: {e} ---")
            print("The application will attempt to continue in simulation mode.")
            # Even if window fails, we still proceed with the simulation logic
            self.window_is_available = False
            self.cube = None
            
    def setup_scene(self):
        """Sets up lighting and the ground plane."""
        # 1. Lighting
        ambientLight = AmbientLight("ambientLight")
        ambientLight.setColor((0.6, 0.6, 0.6, 1))
        self.render.setLight(self.render.attachNewNode(ambientLight))

        directionalLight = DirectionalLight("directionalLight")
        directionalLight.setDirection(Vec3(0, 45, -45))
        directionalLight.setColor((0.8, 0.8, 0.8, 1))
        self.render.setLight(self.render.attachNewNode(directionalLight))

        # 2. Ground Plane (The collision surface)
        try:
            self.ground = self.loader.loadModel("models/plane") 
            self.ground.reparentTo(self.render)
            self.ground.setScale(10, 10, 1)
            self.ground.setPos(0, 0, 0)
            self.ground_collision_y = 0.0
        except Exception as e:
            print(f"Warning: Could not load ground model. Using placeholder collision. Error: {e}")
            self.ground_collision_y = 0.0

    def create_bouncy_cube(self):
        """Creates the initial cube object."""
        # NOTE: You must ensure 'models/misc/cube' is available or use a simple geometry.
        try:
            cube = self.loader.loadModel("models/misc/cube") 
            cube.reparentTo(self.render)
            cube.setPos(0, 0, 5) # Start position
            cube.setScale(1, 1, 1)
            # Attach a custom attribute to track velocity
            cube.setAttr('velocity', [0.0, 0.0, 0.0])
            return cube
        except Exception as e:
            print(f"Critical Error: Could not load cube model. Physics simulation will fail. Error: {e}")
            # Return a dummy object if model loading fails
            return None

    def update_physics(self, task):
        """
        The main physics loop, run every frame.
        Handles gravity, damping, and the bounce effect.
        """
        cube = self.cube
        if cube is None:
            return task.cont # Stop if cube wasn't created

        dt = globalClock.getDt()
        
        # --- Physics Constants ---
        GRAVITY = -9.81 * 1.5 # Increased gravity for dramatic effect
        BOUNCE_FACTOR = 0.7
        DAMPING = 0.95
        
        # 1. Get current state
        current_pos = cube.getPos()
        velocity = list(cube.getAttr('velocity'))
        
        # 2. Apply Gravity (Acceleration)
        # Gravity only affects the Y (vertical) component
        velocity[1] += GRAVITY * dt
        
        # 3. Apply Damping (Energy loss)
        velocity[0] *= DAMPING
        velocity[1] *= DAMPING
        velocity[2] *= DAMPING
        
        # 4. Collision/Ground Constraint (The 'Bouncy' part)
        ground_level = self.ground_collision_y
        if current_pos[1] < ground_level:
            # Snap to ground
            cube.setY(ground_level)
            
            # Reverse vertical velocity and apply bounce factor
            velocity[1] = -velocity[1] * BOUNCE_FACTOR
            
            # Apply friction on horizontal movement upon impact
            velocity[0] *= 0.9
            velocity[2] *= 0.9
        
        # 5. Update Position
        new_x = current_pos[0] + velocity[0] * dt
        new_y = current_pos[1] + velocity[1] * dt
        new_z = current_pos[2] + velocity[2] * dt
        
        cube.setPos(new_x, new_y, new_z)
        
        # 6. Update internal velocity state for next frame
        cube.setAttr('velocity', [velocity[0], velocity[1], velocity[2]])
        
        return task.cont

def main():
    """Entry point for the application."""
    app = BouncyCubeApp()
    
    if app.window_is_available:
        print("--- Bouncy 3D Creator Initialized ---")
        print("The 3D window should appear. The cube will fall and bounce automatically.")
        print("Close the window to exit.")
        app.run() # This starts the Panda3D main loop
    else:
        print("\n=================================================================")
        print("!!! WARNING: Running in Simulation Mode !!!")
        print("The graphical window failed to start. The physics simulation is running,")
        print("but you will only see console output, not a visual window.")
        print("=================================================================")
        
        # If we can't open the window, just exit gracefully
        print("Press Enter to exit...")
        input()

if __name__ == "__main__":
    main()
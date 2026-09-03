# bouncy_3d_creator/README.md

## 🚀 Project Setup: Bouncy 3D Creator

This project requires the **Panda3D (Python 3D Engine)** to function, as it is designed to compile to a standalone executable (.exe) and handle complex 3D physics and rendering.

### Prerequisites
1.  **Install Unity Hub:** Download and install the latest stable version of Unity Hub.
2.  **Install Unity Editor:** Use Unity Hub to install a recent version of the Unity Editor (e.g., 2022 LTS).
3.  **Project Creation:** Create a new 3D project within Unity.

### Step 1: Create the Bouncy Cube Script (C#)

1.  In your Unity Project window, create a new folder named `Scripts`.
2.  Inside `Scripts`, right-click and select **Create > C# Script**. Name it `BouncyCube`.
3.  Double-click `BouncyCube` to open it in your code editor (Visual Studio recommended).
4.  **Replace the entire contents** of `BouncyCube.cs` with the code provided below.

### Step 2: Set up the Scene

1.  In the Unity Hierarchy, create a **3D Object > Cube**.
2.  Attach the `BouncyCube` script component to this newly created Cube GameObject.
3.  Ensure the Cube has a **Rigidbody** component attached (This handles the physics simulation).
4.  (Optional but recommended) Create a large **Plane** object and add a **Box Collider** to it to act as the ground.

### Step 3: The BouncyCube.cs Code

This script handles the custom physics logic (the "squishy" and "bouncy" behavior) that goes beyond standard Unity physics.

```csharp
using UnityEngine;

public class BouncyCube : MonoBehaviour
{
    [Header("Physics Parameters")]
    [Tooltip("How much energy is retained after a bounce (0.0 to 1.0).")]
    public float bounceFactor = 0.7f;
    [Tooltip("How much resistance is applied to movement (0.0 to 1.0).")]
    public float damping = 0.95f;
    [Tooltip("The overall stiffness of the object.")]
    public float stiffness = 10.0f;

    private Rigidbody rb;

    void Start()
    {
        // Get the Rigidbody component attached to this object
        rb = GetComponent<Rigidbody>();
        if (rb == null)
        {
            Debug.LogError("BouncyCube requires a Rigidbody component on the same GameObject.");
        }
    }

    // Unity's Update function runs every frame
    void Update()
    {
        // Apply custom physics logic every frame
        ApplyCustomPhysics();
    }

    private void ApplyCustomPhysics()
    {
        // 1. Apply Gravity (Unity handles this automatically if Rigidbody is present)
        // We can add custom forces here if needed, e.g., wind:
        // rb.AddForce(Vector3.forward * 5f, ForceMode.Acceleration);

        // 2. Handle Bouncing and Damping (Customizing the physics)
        
        // Check for ground collision (assuming ground is at Y=0)
        if (transform.position.y < 0.5f)
        {
            // Snap to ground level
            transform.position = new Vector3(transform.position.x, 0.5f, transform.position.z);
            
            // Reverse vertical velocity and apply bounce factor
            Vector3 currentVelocity = rb.velocity;
            rb.velocity = new Vector3(
                currentVelocity.x * damping, 
                -currentVelocity.y * bounceFactor, // Bounce effect
                currentVelocity.z * damping
            );
        }

        // Apply general damping to slow down movement over time
        rb.velocity *= damping;
    }
}
```

### Step 4: Compiling to Executable (.exe)

1.  In the Unity Editor, go to **File > Build Settings**.
2.  Select **PC, Mac & Linux Standalone** as the platform.
3.  Click **Player Settings...** and configure your desired icon and company name.
4.  Click **Build**.
5.  Unity will create a folder containing the entire executable application, including the necessary DLLs, which can be run on Windows (or Mac/Linux, depending on your build target).

---
**Summary:** By using Unity and C#, we achieve a professional, compiled, standalone executable that handles the complex 3D rendering and physics required for this project.
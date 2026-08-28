using System;
using System.Numerics;
using Raylib_cs;

namespace CrazyCattle3D
{
    public class Sheep
    {
        public int Id { get; }
        public string Name { get; }
        public bool IsPlayer { get; }
        public bool IsAlive { get; set; } = true;

        public Vector3 Position;
        public Vector3 Velocity;
        public float Yaw;   // radians
        public float Pitch; // radians
        public float Roll;  // radians
        public float YawVelocity;
        public float RollVelocity;
        public float PitchVelocity;

        public float Radius { get; } = 0.95f;
        public float Mass => IsSuperHeavy ? 80.0f : 1.0f;
        public bool IsSuperHeavy { get; set; }
        public bool IsFlying { get; set; }
        public bool IsGodMode { get; set; }
        public float SpeedMultiplier { get; set; } = 1.0f;
        public bool IsGrounded { get; private set; } = true;

        public float DashEnergy { get; set; } = 1.0f;
        public bool IsDashing { get; private set; }
        public float DashTimer { get; private set; }
        public float DashCooldown { get; private set; }

        public bool IsTipped { get; private set; }
        public float TippedTimer { get; private set; }

        public float BaaTimer { get; private set; }
        public string BaaText { get; private set; } = "BAAA!";
        public float TrotPhase { get; private set; }
        public int Kills { get; set; }

        public Color WoolColor { get; }
        public Color SkinColor { get; } = new Color(25, 25, 25, 255);

        // AI specific
        private float _aiDecisionTimer;
        private float _aiThrottle;
        private float _aiSteer;
        private float _aiBaaCooldown;
        private Sheep? _aiTarget;

        public Sheep(int id, string name, bool isPlayer, Vector3 startPos, float startYaw)
        {
            Id = id;
            Name = name;
            IsPlayer = isPlayer;
            Position = startPos;
            Yaw = startYaw;

            if (isPlayer)
            {
                WoolColor = new Color(255, 250, 230, 255);
            }
            else
            {
                // Varied fun wool colors for bots
                int colorSeed = id % 7;
                WoolColor = colorSeed switch
                {
                    0 => new Color(245, 245, 245, 255), // Classic White
                    1 => new Color(230, 230, 225, 255), // Off-white
                    2 => new Color(60, 55, 50, 255),    // Black sheep
                    3 => new Color(180, 150, 120, 255), // Tan sheep
                    4 => new Color(250, 210, 215, 255), // Pastel Pink sheep
                    5 => new Color(210, 235, 255, 255), // Light Blue sheep
                    _ => new Color(240, 240, 230, 255)
                };
            }

            _aiBaaCooldown = 2.0f + (float)Random.Shared.NextDouble() * 10.0f;
        }

        public void TriggerBaa(string? customText = null)
        {
            BaaTimer = 1.2f;
            BaaText = customText ?? (Random.Shared.Next(0, 5) switch
            {
                0 => "BAAA!",
                1 => "MEEEHH!",
                2 => "WOOOL!",
                3 => "RAM!",
                _ => "BAAAHH!"
            });

            float pitch = IsPlayer ? 1.05f : (0.75f + (Id % 10) * 0.08f);
            AudioEngine.PlayBaa(pitch);
        }

        public void Update(float dt, Terrain terrain, Sheep[] allSheep)
        {
            if (!IsAlive) return;

            // Update timers
            if (BaaTimer > 0) BaaTimer -= dt;
            if (DashTimer > 0)
            {
                DashTimer -= dt;
                if (DashTimer <= 0) IsDashing = false;
            }

            // Dash energy recharge
            if (!IsDashing && DashEnergy < 1.0f)
            {
                DashEnergy = MathF.Min(1.0f, DashEnergy + dt * 0.35f);
            }

            if (DashCooldown > 0) DashCooldown -= dt;

            // Handle Input / AI
            float throttle = 0.0f;
            float steer = 0.0f;
            bool wantDash = false;
            bool wantJump = false;

            if (IsPlayer)
            {
                GetPlayerInputs(out throttle, out steer, out wantDash, out wantJump);
            }
            else
            {
                UpdateBotAI(dt, terrain, allSheep, out throttle, out steer, out wantDash, out wantJump);
            }

            if (wantDash && DashEnergy >= 0.30f && DashCooldown <= 0 && !IsTipped)
            {
                PerformDash();
            }

            if (wantJump && IsGrounded && !IsTipped)
            {
                PerformJump();
            }

            // Simulate vehicle physics
            SimulatePhysics(dt, throttle, steer, terrain);

            // Tipping check
            CheckTippingState(dt);
        }

        private void GetPlayerInputs(out float throttle, out float steer, out bool wantDash, out bool wantJump)
        {
            throttle = 0.0f;
            steer = 0.0f;

            if (Raylib.IsKeyDown(KeyboardKey.W) || Raylib.IsKeyDown(KeyboardKey.Up)) throttle += 1.0f;
            if (Raylib.IsKeyDown(KeyboardKey.S) || Raylib.IsKeyDown(KeyboardKey.Down)) throttle -= 0.6f;

            if (Raylib.IsKeyDown(KeyboardKey.A) || Raylib.IsKeyDown(KeyboardKey.Left)) steer -= 1.0f;
            if (Raylib.IsKeyDown(KeyboardKey.D) || Raylib.IsKeyDown(KeyboardKey.Right)) steer += 1.0f;

            // Mouse steering assistance (turning towards mouse cursor delta)
            Vector2 mouseDelta = Raylib.GetMouseDelta();
            if (MathF.Abs(mouseDelta.X) > 0.5f)
            {
                steer += Math.Clamp(mouseDelta.X * 0.08f, -1.0f, 1.0f);
            }

            wantDash = Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift);
            wantJump = Raylib.IsKeyPressed(KeyboardKey.Space);

            if (Raylib.IsKeyPressed(KeyboardKey.E))
            {
                TriggerBaa();
            }

            if (Raylib.IsKeyPressed(KeyboardKey.F2))
            {
                IsSuperHeavy = !IsSuperHeavy;
                TriggerBaa(IsSuperHeavy ? "SUPER HEAVY!" : "NORMAL");
                AudioEngine.PlayCrash(1.0f);
            }
        }

        private void UpdateBotAI(float dt, Terrain terrain, Sheep[] allSheep, out float throttle, out float steer, out bool wantDash, out bool wantJump)
        {
            _aiDecisionTimer -= dt;
            _aiBaaCooldown -= dt;

            if (_aiBaaCooldown <= 0)
            {
                _aiBaaCooldown = 8.0f + (float)Random.Shared.NextDouble() * 15.0f;
                if (Random.Shared.NextDouble() < 0.35)
                {
                    TriggerBaa();
                }
            }

            if (_aiDecisionTimer <= 0)
            {
                _aiDecisionTimer = 0.25f + (float)Random.Shared.NextDouble() * 0.4f;

                // Pick closest alive target
                float closestDistSq = float.MaxValue;
                Sheep? closest = null;

                for (int i = 0; i < allSheep.Length; i++)
                {
                    Sheep other = allSheep[i];
                    if (other.Id == Id || !other.IsAlive) continue;

                    float dSq = Vector3.DistanceSquared(Position, other.Position);
                    if (dSq < closestDistSq)
                    {
                        closestDistSq = dSq;
                        closest = other;
                    }
                }
                _aiTarget = closest;

                // Avoid boundary fences
                float distFromCenter = MathF.Sqrt(Position.X * Position.X + Position.Z * Position.Z);
                if (distFromCenter > terrain.ArenaRadius * 0.78f)
                {
                    // Steer towards center (0, 0)
                    float angleToCenter = MathF.Atan2(-Position.X, -Position.Z);
                    float diff = NormalizeAngle(angleToCenter - Yaw);
                    _aiSteer = Math.Clamp(diff * 2.5f, -1.0f, 1.0f);
                    _aiThrottle = 0.85f;
                }
                else if (_aiTarget != null)
                {
                    Vector3 toTarget = _aiTarget.Position - Position;
                    float angleToTarget = MathF.Atan2(toTarget.X, toTarget.Z);
                    float diff = NormalizeAngle(angleToTarget - Yaw);

                    _aiSteer = Math.Clamp(diff * 3.0f, -1.0f, 1.0f);

                    // Aggressive charge
                    if (MathF.Abs(diff) < 0.4f)
                    {
                        _aiThrottle = 1.0f;
                        if (closestDistSq < 15.0f * 15.0f && Random.Shared.NextDouble() < 0.25)
                        {
                            _aiThrottle = 1.2f;
                        }
                    }
                    else
                    {
                        _aiThrottle = 0.7f;
                    }
                }
                else
                {
                    _aiThrottle = 0.8f;
                    _aiSteer = ((float)Random.Shared.NextDouble() - 0.5f) * 0.8f;
                }
            }

            throttle = _aiThrottle;
            steer = _aiSteer;
            wantDash = false;
            wantJump = false;

            // AI occasionally dashes when target is in front
            if (_aiTarget != null && DashEnergy > 0.7f && DashCooldown <= 0)
            {
                float dSq = Vector3.DistanceSquared(Position, _aiTarget.Position);
                if (dSq is > 6.0f * 6.0f and < 25.0f * 25.0f && MathF.Abs(_aiSteer) < 0.25f)
                {
                    wantDash = Random.Shared.NextDouble() < 0.45;
                }
            }

            // AI hops over obstacles or jumps into charges
            if (Random.Shared.NextDouble() < 0.008 && IsGrounded)
            {
                wantJump = true;
            }
        }

        private void PerformDash()
        {
            IsDashing = true;
            DashTimer = 0.45f;
            DashCooldown = 1.8f;
            DashEnergy = MathF.Max(0.0f, DashEnergy - 0.35f);

            Vector3 forward = new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
            Velocity += forward * 16.0f;
            AudioEngine.PlayDash();
        }

        private void PerformJump()
        {
            Velocity.Y += 8.5f;
            Vector3 forward = new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
            Velocity += forward * 3.5f;
            IsGrounded = false;
            AudioEngine.PlayJump();
        }

        private void SimulatePhysics(float dt, float throttle, float steer, Terrain terrain)
        {
            if (IsFlying)
            {
                float flySpeed = 35.0f * SpeedMultiplier;
                Vector3 moveDir = Vector3.Zero;
                Vector3 fwd = new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
                Vector3 right = new Vector3(MathF.Cos(Yaw), 0, -MathF.Sin(Yaw));
                if (Raylib.IsKeyDown(KeyboardKey.W)) moveDir += fwd;
                if (Raylib.IsKeyDown(KeyboardKey.S)) moveDir -= fwd;
                if (Raylib.IsKeyDown(KeyboardKey.A)) moveDir -= right;
                if (Raylib.IsKeyDown(KeyboardKey.D)) moveDir += right;
                if (Raylib.IsKeyDown(KeyboardKey.Space)) moveDir.Y += 1.0f;
                if (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.LeftControl)) moveDir.Y -= 1.0f;

                if (moveDir.LengthSquared() > 0.001f)
                    Velocity = Vector3.Normalize(moveDir) * flySpeed;
                else
                    Velocity = Vector3.Zero;

                Position += Velocity * dt;
                IsTipped = false;
                TippedTimer = 0.0f;
                return;
            }

            if (IsGodMode)
            {
                IsTipped = false;
                TippedTimer = 0.0f;
            }

            float groundH = terrain.GetHeight(Position.X, Position.Z);
            Vector3 groundNormal = terrain.GetNormal(Position.X, Position.Z);

            float currentY = Position.Y;
            float targetGroundY = groundH + Radius;

            // Gravity
            const float gravity = 24.0f;
            Velocity.Y -= gravity * dt;

            // Ground contact / suspension
            if (currentY <= targetGroundY)
            {
                Position.Y = targetGroundY;
                IsGrounded = true;
                if (Velocity.Y < 0) Velocity.Y = 0;

                // Vehicle-like car steering:
                // Heading rotates based on steering input and forward speed
                float forwardSpeed = Vector3.Dot(Velocity, new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw)));
                float turnRate = 2.8f;

                if (!IsTipped)
                {
                    YawVelocity = steer * turnRate;
                    Yaw += YawVelocity * dt;

                    // Forward acceleration & engine throttle
                    float maxSpeed = IsDashing ? 36.0f : (IsSuperHeavy ? 32.0f : 17.5f);
                    float accel = IsDashing ? 70.0f : (IsSuperHeavy ? 90.0f : 28.0f);

                    Vector3 forwardDir = new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
                    Velocity += forwardDir * (throttle * accel * dt);

                    // Downhill momentum boost (the iconic slope mechanic)
                    // The slope gravity pushes sheep downhill
                    Vector3 slopePush = new Vector3(groundNormal.X, 0, groundNormal.Z) * (gravity * 1.35f);
                    Velocity -= slopePush * dt;

                    // Lateral friction / drift
                    Vector3 rightDir = new Vector3(MathF.Cos(Yaw), 0, -MathF.Sin(Yaw));
                    float lateralSpeed = Vector3.Dot(Velocity, rightDir);
                    Velocity -= rightDir * (lateralSpeed * (1.0f - terrain.Friction) * 18.0f * dt);

                    // General drag
                    Velocity.X *= MathF.Pow(terrain.Friction, dt * 60.0f);
                    Velocity.Z *= MathF.Pow(terrain.Friction, dt * 60.0f);

                    // Speed cap
                    float horizSpeed = MathF.Sqrt(Velocity.X * Velocity.X + Velocity.Z * Velocity.Z);
                    if (horizSpeed > maxSpeed)
                    {
                        float scale = maxSpeed / horizSpeed;
                        Velocity.X *= scale;
                        Velocity.Z *= scale;
                    }

                    // Align Pitch & Roll with terrain normal
                    float targetPitch = -MathF.Asin(Math.Clamp(groundNormal.Z * MathF.Cos(Yaw) + groundNormal.X * MathF.Sin(Yaw), -0.99f, 0.99f));
                    float targetRoll = MathF.Asin(Math.Clamp(groundNormal.X * MathF.Cos(Yaw) - groundNormal.Z * MathF.Sin(Yaw), -0.99f, 0.99f));

                    Pitch = Lerp(Pitch, targetPitch, dt * 10.0f);
                    Roll = Lerp(Roll, targetRoll, dt * 10.0f);
                }
                else
                {
                    // Tipped over! Sliding on its side
                    Velocity.X *= MathF.Pow(0.96f, dt * 60.0f);
                    Velocity.Z *= MathF.Pow(0.96f, dt * 60.0f);
                    Roll += RollVelocity * dt;
                    Pitch += PitchVelocity * dt;
                }
            }
            else
            {
                IsGrounded = false;
                // Airborne physics: tumbling if tipped
                if (IsTipped)
                {
                    Roll += RollVelocity * dt;
                    Pitch += PitchVelocity * dt;
                    Yaw += YawVelocity * dt;
                }
                else
                {
                    // Gentle air control
                    Yaw += steer * 1.5f * dt;
                }
            }

            // Apply velocity
            Position += Velocity * dt;

            // Trot leg animation
            float currentSpeed = MathF.Sqrt(Velocity.X * Velocity.X + Velocity.Z * Velocity.Z);
            if (IsGrounded && currentSpeed > 0.5f)
            {
                TrotPhase += currentSpeed * dt * 3.5f;
            }
        }

        public void ApplyImpulse(Vector3 impulse, Vector3 torque)
        {
            Velocity += impulse / Mass;
            RollVelocity += torque.Z;
            PitchVelocity += torque.X;
            YawVelocity += torque.Y;

            // If hit hard enough laterally, tip the sheep over!
            if (MathF.Abs(torque.Z) > 4.5f || MathF.Abs(torque.X) > 4.5f || impulse.Length() > 18.0f)
            {
                IsTipped = true;
                Roll += MathF.Sign(torque.Z) * 0.8f;
            }
        }

        private void CheckTippingState(float dt)
        {
            if (IsSuperHeavy)
            {
                IsTipped = false;
                TippedTimer = 0.0f;
                return;
            }

            float rollDeg = MathF.Abs(Roll) * (180.0f / MathF.PI);
            float pitchDeg = MathF.Abs(Pitch) * (180.0f / MathF.PI);

            if (rollDeg > 58.0f || pitchDeg > 65.0f)
            {
                IsTipped = true;
            }

            if (IsTipped)
            {
                TippedTimer += dt;
            }
            else
            {
                TippedTimer = 0.0f;
            }
        }

        public bool ShouldExplodeFromTipping()
        {
            // If tipped and on the ground for more than 0.45s, BOOM!
            return IsTipped && TippedTimer > 0.45f;
        }

        private static float NormalizeAngle(float angle)
        {
            while (angle > MathF.PI) angle -= MathF.PI * 2.0f;
            while (angle < -MathF.PI) angle += MathF.PI * 2.0f;
            return angle;
        }

        private static float Lerp(float a, float b, float t)
        {
            return a + (b - a) * Math.Clamp(t, 0.0f, 1.0f);
        }
    }
}

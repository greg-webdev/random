using System;
using System.Collections.Generic;
using KeyRecorder.Models;
using KeyRecorder.Services;

namespace KeyRecorder.Tests
{
    public static class FormatterTests
    {
        public static void RunAllTests()
        {
            Console.WriteLine("=== Running KeyRecorder Dual-Track & Exact Timing Tests ===");

            // Test 1: Simple sequential hold and release
            {
                var events = new List<KeyEventRecord>
                {
                    new() { KeyName = "W", IsKeyDown = true, TimestampMs = 100 },
                    new() { KeyName = "W", IsKeyDown = false, TimestampMs = 450 },
                    new() { KeyName = "Space", IsKeyDown = true, TimestampMs = 570 },
                    new() { KeyName = "Space", IsKeyDown = false, TimestampMs = 650 },
                    new() { KeyName = "D", IsKeyDown = true, TimestampMs = 850 },
                    new() { KeyName = "D", IsKeyDown = false, TimestampMs = 1150 }
                };

                var options = new FormattingOptions();
                var result = KeyInstructionFormatter.FormatToString(events, options);
                string expected = "hold W for 350ms, release for 120ms, hold Space for 80ms, release for 200ms, hold D for 300ms";

                Assert(result == expected, $"Test 1 Failed.\nGot: '{result}'\nExpected: '{expected}'");
                Console.WriteLine("✓ Test 1 Passed: Simple sequential key hold & release with commas");
            }

            // Test 2: Dual Track (Sustained Held Key vs Quick Pressed Keys)
            {
                var events = new List<KeyEventRecord>
                {
                    // t=100: UpArrow down (held all the way until t=1500 -> 1400ms)
                    new() { KeyName = "UpArrow", IsKeyDown = true, TimestampMs = 100 },
                    // t=300: RightArrow down
                    new() { KeyName = "RightArrow", IsKeyDown = true, TimestampMs = 300 },
                    // t=700: RightArrow up (400ms)
                    new() { KeyName = "RightArrow", IsKeyDown = false, TimestampMs = 700 },
                    // t=900: LeftArrow down
                    new() { KeyName = "LeftArrow", IsKeyDown = true, TimestampMs = 900 },
                    // t=1300: LeftArrow up (400ms)
                    new() { KeyName = "LeftArrow", IsKeyDown = false, TimestampMs = 1300 },
                    // t=1500: UpArrow up
                    new() { KeyName = "UpArrow", IsKeyDown = false, TimestampMs = 1500 }
                };

                var options = new FormattingOptions { EnableDualTrack = true };
                var dual = KeyInstructionFormatter.ParseDualTrackInstructions(events, options);

                Assert(dual.HasSustainedKeys, "Test 2 Failed: missing sustained keys");
                Assert(dual.SustainedInstructions.Count == 1, $"Test 2 Failed: expected 1 sustained key, got {dual.SustainedInstructions.Count}");
                Assert(dual.SustainedInstructions[0].KeyName == "UpArrow", "Test 2 Failed: sustained key is not UpArrow");
                Assert(dual.SustainedInstructions[0].DurationMs == 1400, $"Test 2 Failed: expected 1400ms, got {dual.SustainedInstructions[0].DurationMs}");

                Assert(dual.QuickInstructions.Count == 3, $"Test 2 Failed: expected 3 quick instructions (2 holds, 1 release gap), got {dual.QuickInstructions.Count}");
                Assert(dual.QuickInstructions[0].KeyName == "RightArrow" && dual.QuickInstructions[0].DurationMs == 400, "Step 0 mismatch");
                Assert(dual.QuickInstructions[1].Type == InstructionType.ReleaseGap && dual.QuickInstructions[1].DurationMs == 200, "Step 1 mismatch");
                Assert(dual.QuickInstructions[2].KeyName == "LeftArrow" && dual.QuickInstructions[2].DurationMs == 400, "Step 2 mismatch");

                var formattedText = KeyInstructionFormatter.FormatToString(events, options);
                Assert(formattedText.Contains("[HELD KEYS]"), "Formatted text missing [HELD KEYS] section");
                Assert(formattedText.Contains("[QUICK KEYS]"), "Formatted text missing [QUICK KEYS] section");

                Console.WriteLine("✓ Test 2 Passed: Dual track separated into Held Keys & Quick Keys successfully!");
            }

            // Test 2b: Multiple held keys with delays in between
            {
                var events = new List<KeyEventRecord>
                {
                    // Held key 1: UpArrow from 100 to 1100 (1000ms)
                    new() { KeyName = "UpArrow", IsKeyDown = true, TimestampMs = 100 },
                    new() { KeyName = "RightArrow", IsKeyDown = true, TimestampMs = 300 },
                    new() { KeyName = "RightArrow", IsKeyDown = false, TimestampMs = 700 },
                    new() { KeyName = "UpArrow", IsKeyDown = false, TimestampMs = 1100 },

                    // Gap of 500ms between held keys (1100 to 1600)

                    // Held key 2: Shift from 1600 to 2600 (1000ms)
                    new() { KeyName = "Shift", IsKeyDown = true, TimestampMs = 1600 },
                    new() { KeyName = "LeftArrow", IsKeyDown = true, TimestampMs = 1800 },
                    new() { KeyName = "LeftArrow", IsKeyDown = false, TimestampMs = 2200 },
                    new() { KeyName = "Shift", IsKeyDown = false, TimestampMs = 2600 }
                };

                var options = new FormattingOptions { EnableDualTrack = true };
                var dual = KeyInstructionFormatter.ParseDualTrackInstructions(events, options);

                Assert(dual.SustainedInstructions.Count == 3, $"Test 2b Failed: expected 3 sustained instructions (2 holds, 1 delay), got {dual.SustainedInstructions.Count}");
                Assert(dual.SustainedInstructions[0].KeyName == "UpArrow" && dual.SustainedInstructions[0].DurationMs == 1000, "Held key 1 mismatch");
                Assert(dual.SustainedInstructions[1].Type == InstructionType.ReleaseGap && dual.SustainedInstructions[1].DurationMs == 500, "Held delay mismatch");
                Assert(dual.SustainedInstructions[2].KeyName == "Shift" && dual.SustainedInstructions[2].DurationMs == 1000, "Held key 2 mismatch");

                Console.WriteLine("✓ Test 2b Passed: Delays accurately inserted between consecutive held keys!");
            }

            // Test 2c: Holding multiple keys together in [HELD KEYS] (e.g. Shift and W held together)
            {
                var events = new List<KeyEventRecord>
                {
                    // Shift and W pressed together at t=100
                    new() { KeyName = "Shift", IsKeyDown = true, TimestampMs = 100 },
                    new() { KeyName = "W", IsKeyDown = true, TimestampMs = 110 },

                    // Space tapped at t=500..580
                    new() { KeyName = "Space", IsKeyDown = true, TimestampMs = 500 },
                    new() { KeyName = "Space", IsKeyDown = false, TimestampMs = 580 },

                    // Shift and W released at t=2100
                    new() { KeyName = "Shift", IsKeyDown = false, TimestampMs = 2100 },
                    new() { KeyName = "W", IsKeyDown = false, TimestampMs = 2100 }
                };

                var options = new FormattingOptions { EnableDualTrack = true };
                var dual = KeyInstructionFormatter.ParseDualTrackInstructions(events, options);

                Assert(dual.SustainedInstructions.Count == 1, $"Test 2c Failed: expected 1 multi-key sustained instruction, got {dual.SustainedInstructions.Count}");
                Assert(dual.SustainedInstructions[0].Keys.Count == 2, $"Test 2c Failed: expected 2 keys held together, got {dual.SustainedInstructions[0].Keys.Count}");
                Assert(dual.SustainedInstructions[0].InstructionText.Contains("hold") &&
                       dual.SustainedInstructions[0].InstructionText.Contains("Shift") &&
                       dual.SustainedInstructions[0].InstructionText.Contains("W"),
                       $"Test 2c Failed: unexpected text {dual.SustainedInstructions[0].InstructionText}");

                Assert(dual.QuickInstructions.Count == 1 && dual.QuickInstructions[0].KeyName == "Space", "Test 2c Failed: Quick instruction mismatch");

                Console.WriteLine("✓ Test 2c Passed: Multiple keys held together formatted as multi-key hold in [HELD KEYS]!");
            }

            // Test 3: Parse Dual Track back from string with held key delays
            {
                string script = @"[HELD KEYS]
hold UpArrow for 1000ms, release for 500ms, hold Shift for 1000ms

[QUICK KEYS]
hold RightArrow for 400ms, release for 900ms, hold LeftArrow for 400ms";

                var parsed = KeyInstructionFormatter.ParseDualTrackFromString(script);
                Assert(parsed.HasSustainedKeys, "Test 3 Failed: missing sustained keys");
                Assert(parsed.SustainedInstructions.Count == 3, "Sustained count mismatch");
                Assert(parsed.SustainedInstructions[1].Type == InstructionType.ReleaseGap && parsed.SustainedInstructions[1].DurationMs == 500, "Delay mismatch");

                Console.WriteLine("✓ Test 3 Passed: Reverse string parser for [HELD KEYS] with delays");
            }

            // Test 4: Key translation & mappings
            {
                Assert(MacroPlayer.GetVkCodeFromName("RightArrow") == 0x27, "VK_RIGHT failed");
                Assert(MacroPlayer.GetVkCodeFromName("UpArrow") == 0x26, "VK_UP failed");
                Assert(MacroPlayer.GetVkCodeFromName("LeftArrow") == 0x25, "VK_LEFT failed");
                Assert(MacroPlayer.GetVkCodeFromName("Space") == 0x20, "VK_SPACE failed");
                Assert(MacroPlayer.GetVkCodeFromName("F4") == 0x73, "VK_F4 failed");
                Assert(MacroPlayer.GetVkCodeFromName("F8") == 0x77, "VK_F8 failed");

                Console.WriteLine("✓ Test 4 Passed: Win32 Virtual Key code mappings");
            }

            Console.WriteLine("=== All Tests Passed Successfully! ===");
        }

        private static void Assert(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
        }
    }
}

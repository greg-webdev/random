using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using KeyRecorder.Models;

namespace KeyRecorder.Services
{
    public class PlaybackProgressEventArgs : EventArgs
    {
        public int CurrentLoop { get; set; }
        public int TotalLoops { get; set; }
        public int CurrentStep { get; set; }
        public int TotalSteps { get; set; }
        public string CurrentInstruction { get; set; } = string.Empty;
        public int CountdownRemainingSeconds { get; set; }
    }

    public class MacroPlayer
    {
        private static readonly IntPtr MAGIC_EXTRA_INFO = (IntPtr)0x55AA;

        private const uint INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYDOWN = 0x0000;
        private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        private CancellationTokenSource? _cts;
        private readonly HashSet<ushort> _activeDownKeys = new();
        private readonly object _lock = new();

        public bool IsPlaying { get; private set; }
        public bool EnableTypematicRepeat { get; set; } = true;

        public event EventHandler<PlaybackProgressEventArgs>? ProgressChanged;
        public event EventHandler? PlaybackStarted;
        public event EventHandler? PlaybackStopped;

        /// <summary>
        /// Plays back 2 independent parallel instruction tracks:
        /// Track 1: Long sustained held keys (never released or interrupted)
        /// Track 2: Quick action keys (taps, switches, and release gaps)
        /// </summary>
        public async Task PlayDualTrackAsync(
            DualTrackInstructions dualTrack,
            double speedMultiplier = 1.0,
            int loopCount = 1,
            int countdownSeconds = 0)
        {
            if (IsPlaying || dualTrack == null || dualTrack.TotalCount == 0)
            {
                return;
            }

            IsPlaying = true;
            _cts = new CancellationTokenSource();
            var token = _cts.Token;

            PlaybackStarted?.Invoke(this, EventArgs.Empty);

            try
            {
                if (countdownSeconds > 0)
                {
                    for (int s = countdownSeconds; s > 0; s--)
                    {
                        token.ThrowIfCancellationRequested();
                        ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                        {
                            CountdownRemainingSeconds = s,
                            CurrentInstruction = $"Starting playback in {s}s... Switch to your game window!"
                        });
                        await Task.Delay(1000, token);
                    }
                }

                int currentLoop = 1;
                bool infinite = (loopCount <= 0);

                while (!token.IsCancellationRequested && (infinite || currentLoop <= loopCount))
                {
                    var tasks = new List<Task>();

                    // Task 1: Sustained track (Base keys held continuously)
                    if (dualTrack.HasSustainedKeys)
                    {
                        tasks.Add(ExecuteSustainedTrackAsync(dualTrack.SustainedInstructions, speedMultiplier, currentLoop, loopCount, token));
                    }

                    // Task 2: Quick track (Action keys pressed/switched concurrently)
                    if (dualTrack.HasQuickKeys)
                    {
                        tasks.Add(ExecuteQuickTrackAsync(dualTrack.QuickInstructions, speedMultiplier, currentLoop, loopCount, token));
                    }

                    await Task.WhenAll(tasks);

                    ReleaseAllActiveKeys();
                    currentLoop++;
                }
            }
            catch (OperationCanceledException)
            {
                // Normal cancel
            }
            finally
            {
                ReleaseAllActiveKeys();
                IsPlaying = false;
                _cts?.Dispose();
                _cts = null;
                PlaybackStopped?.Invoke(this, EventArgs.Empty);
            }
        }

        private async Task ExecuteSustainedTrackAsync(
            List<KeyInstruction> sustainedInstructions,
            double speedMultiplier,
            int currentLoop,
            int loopCount,
            CancellationToken token)
        {
            var activeSustainedKeys = new HashSet<ushort>();

            for (int stepIdx = 0; stepIdx < sustainedInstructions.Count; stepIdx++)
            {
                token.ThrowIfCancellationRequested();

                var step = sustainedInstructions[stepIdx];
                double adjustedDuration = Math.Max(1, step.DurationMs / Math.Max(0.1, speedMultiplier));

                if (step.Type == InstructionType.HoldKeys && step.Keys.Count > 0)
                {
                    var targetVkCodes = new HashSet<ushort>(step.Keys.Select(GetVkCodeFromName).Where(vk => vk != 0));

                    lock (_lock)
                    {
                        // Release keys that are no longer part of the current held chord
                        foreach (var vk in activeSustainedKeys.ToList())
                        {
                            if (!targetVkCodes.Contains(vk))
                            {
                                ushort sc = GetScanCodeFromVk(vk);
                                SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: false);
                                activeSustainedKeys.Remove(vk);
                                _activeDownKeys.Remove(vk);
                            }
                        }

                        // Press down any new keys in the current held chord
                        foreach (var vk in targetVkCodes)
                        {
                            if (!activeSustainedKeys.Contains(vk))
                            {
                                ushort sc = GetScanCodeFromVk(vk);
                                SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: true);
                                activeSustainedKeys.Add(vk);
                                _activeDownKeys.Add(vk);
                            }
                        }
                    }

                    ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                    {
                        CurrentLoop = currentLoop,
                        TotalLoops = (loopCount <= 0) ? -1 : loopCount,
                        CurrentInstruction = $"[HELD] {step.InstructionText}"
                    });

                    // Hold for duration with typematic auto-repeat pulses on all held keys
                    await HoldDurationWithTypematicPulse((int)adjustedDuration, activeSustainedKeys, token);

                    // Look ahead: if next step is not another HoldKeys step, release all currently held keys
                    bool isNextHold = (stepIdx + 1 < sustainedInstructions.Count) && (sustainedInstructions[stepIdx + 1].Type == InstructionType.HoldKeys);
                    if (!isNextHold)
                    {
                        lock (_lock)
                        {
                            foreach (var vk in activeSustainedKeys.ToList())
                            {
                                ushort sc = GetScanCodeFromVk(vk);
                                SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: false);
                                _activeDownKeys.Remove(vk);
                            }
                            activeSustainedKeys.Clear();
                        }
                    }
                }
                else if (step.Type == InstructionType.ReleaseGap)
                {
                    lock (_lock)
                    {
                        foreach (var vk in activeSustainedKeys.ToList())
                        {
                            ushort sc = GetScanCodeFromVk(vk);
                            SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: false);
                            _activeDownKeys.Remove(vk);
                        }
                        activeSustainedKeys.Clear();
                    }

                    ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                    {
                        CurrentLoop = currentLoop,
                        TotalLoops = (loopCount <= 0) ? -1 : loopCount,
                        CurrentInstruction = $"[HELD DELAY] {step.InstructionText}"
                    });

                    await PreciseDelay((int)adjustedDuration, token);
                }
            }
        }

        private async Task ExecuteQuickTrackAsync(
            List<KeyInstruction> quickInstructions,
            double speedMultiplier,
            int currentLoop,
            int loopCount,
            CancellationToken token)
        {
            for (int i = 0; i < quickInstructions.Count; i++)
            {
                token.ThrowIfCancellationRequested();

                var step = quickInstructions[i];
                double adjustedDuration = Math.Max(1, step.DurationMs / Math.Max(0.1, speedMultiplier));

                ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                {
                    CurrentLoop = currentLoop,
                    TotalLoops = (loopCount <= 0) ? -1 : loopCount,
                    CurrentStep = i + 1,
                    TotalSteps = quickInstructions.Count,
                    CurrentInstruction = $"[QUICK] {step.InstructionText}"
                });

                if (step.Type == InstructionType.HoldKeys && step.Keys.Count > 0)
                {
                    var vkCodes = step.Keys.Select(GetVkCodeFromName).Where(vk => vk != 0).ToList();

                    lock (_lock)
                    {
                        foreach (var vk in vkCodes)
                        {
                            ushort sc = GetScanCodeFromVk(vk);
                            SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: true);
                            _activeDownKeys.Add(vk);
                        }
                    }

                    await HoldDurationWithTypematicPulse((int)adjustedDuration, vkCodes, token);

                    lock (_lock)
                    {
                        foreach (var vk in vkCodes)
                        {
                            ushort sc = GetScanCodeFromVk(vk);
                            SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: false);
                            _activeDownKeys.Remove(vk);
                        }
                    }
                }
                else if (step.Type == InstructionType.ReleaseGap)
                {
                    await PreciseDelay((int)adjustedDuration, token);
                }
            }
        }

        public async Task PlayAsync(
            List<KeyInstruction> instructions,
            double speedMultiplier = 1.0,
            int loopCount = 1,
            int countdownSeconds = 0)
        {
            var dual = new DualTrackInstructions { QuickInstructions = instructions };
            await PlayDualTrackAsync(dual, speedMultiplier, loopCount, countdownSeconds);
        }

        /// <summary>
        /// Plays back 100% exact raw recorded events with microsecond timing and hardware scan codes.
        /// </summary>
        public async Task PlayRawEventsAsync(
            IReadOnlyList<KeyEventRecord> rawEvents,
            double speedMultiplier = 1.0,
            int loopCount = 1,
            int countdownSeconds = 0)
        {
            if (IsPlaying || rawEvents == null || rawEvents.Count == 0)
            {
                return;
            }

            IsPlaying = true;
            _cts = new CancellationTokenSource();
            var token = _cts.Token;

            PlaybackStarted?.Invoke(this, EventArgs.Empty);

            try
            {
                if (countdownSeconds > 0)
                {
                    for (int s = countdownSeconds; s > 0; s--)
                    {
                        token.ThrowIfCancellationRequested();
                        ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                        {
                            CountdownRemainingSeconds = s,
                            CurrentInstruction = $"Starting playback in {s}s... Switch to your game window!"
                        });
                        await Task.Delay(1000, token);
                    }
                }

                int currentLoop = 1;
                bool infinite = (loopCount <= 0);

                while (!token.IsCancellationRequested && (infinite || currentLoop <= loopCount))
                {
                    long initialTimestamp = rawEvents[0].TimestampMs;
                    var sw = Stopwatch.StartNew();
                    long lastPulseMs = 0;

                    for (int i = 0; i < rawEvents.Count; i++)
                    {
                        token.ThrowIfCancellationRequested();

                        var evt = rawEvents[i];
                        long targetElapsedMs = (long)((evt.TimestampMs - initialTimestamp) / Math.Max(0.1, speedMultiplier));

                        while (sw.ElapsedMilliseconds < targetElapsedMs)
                        {
                            token.ThrowIfCancellationRequested();
                            long remaining = targetElapsedMs - sw.ElapsedMilliseconds;

                            if (EnableTypematicRepeat && (sw.ElapsedMilliseconds - lastPulseMs) >= 30)
                            {
                                lastPulseMs = sw.ElapsedMilliseconds;
                                lock (_lock)
                                {
                                    foreach (var downVk in _activeDownKeys.ToList())
                                    {
                                        ushort pulseSc = GetScanCodeFromVk(downVk);
                                        SendHardwareKey(downVk, pulseSc, IsExtendedKey(downVk), isDown: true);
                                    }
                                }
                            }

                            if (remaining > 25)
                            {
                                await Task.Delay((int)(remaining - 15), token);
                            }
                            else
                            {
                                Thread.SpinWait(10);
                            }
                        }

                        ushort vk = (ushort)evt.VirtualKeyCode;
                        if (vk == 0) vk = GetVkCodeFromName(evt.KeyName);

                        ushort sc = (ushort)evt.ScanCode;
                        if (sc == 0) sc = GetScanCodeFromVk(vk);

                        bool extended = evt.IsExtended || IsExtendedKey(vk);

                        lock (_lock)
                        {
                            SendHardwareKey(vk, sc, extended, evt.IsKeyDown);

                            if (evt.IsKeyDown) _activeDownKeys.Add(vk);
                            else _activeDownKeys.Remove(vk);
                        }

                        ProgressChanged?.Invoke(this, new PlaybackProgressEventArgs
                        {
                            CurrentLoop = currentLoop,
                            TotalLoops = infinite ? -1 : loopCount,
                            CurrentStep = i + 1,
                            TotalSteps = rawEvents.Count,
                            CurrentInstruction = $"[{(evt.IsKeyDown ? "DOWN" : "UP")}] {evt.KeyName}"
                        });
                    }

                    ReleaseAllActiveKeys();
                    currentLoop++;
                }
            }
            catch (OperationCanceledException)
            {
                // Normal cancel
            }
            finally
            {
                ReleaseAllActiveKeys();
                IsPlaying = false;
                _cts?.Dispose();
                _cts = null;
                PlaybackStopped?.Invoke(this, EventArgs.Empty);
            }
        }

        public void Stop()
        {
            if (IsPlaying && _cts != null)
            {
                _cts.Cancel();
            }
        }

        private void ReleaseAllActiveKeys()
        {
            lock (_lock)
            {
                foreach (var vk in _activeDownKeys.ToList())
                {
                    ushort sc = GetScanCodeFromVk(vk);
                    SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: false);
                }
                _activeDownKeys.Clear();
            }
        }

        private async Task HoldDurationWithTypematicPulse(int milliseconds, IEnumerable<ushort> heldKeys, CancellationToken token)
        {
            if (milliseconds <= 0) return;

            var sw = Stopwatch.StartNew();
            long lastPulseMs = 0;
            var keyList = heldKeys.ToList();

            while (sw.ElapsedMilliseconds < milliseconds)
            {
                token.ThrowIfCancellationRequested();

                long elapsed = sw.ElapsedMilliseconds;

                if (EnableTypematicRepeat && (elapsed - lastPulseMs) >= 30)
                {
                    lastPulseMs = elapsed;
                    lock (_lock)
                    {
                        foreach (var vk in keyList)
                        {
                            ushort sc = GetScanCodeFromVk(vk);
                            SendHardwareKey(vk, sc, IsExtendedKey(vk), isDown: true);
                        }
                    }
                }

                long remaining = milliseconds - elapsed;
                if (remaining > 25)
                {
                    await Task.Delay(10, token);
                }
                else
                {
                    Thread.SpinWait(10);
                }
            }
        }

        private static async Task PreciseDelay(int milliseconds, CancellationToken token)
        {
            if (milliseconds <= 0) return;

            var sw = Stopwatch.StartNew();

            if (milliseconds > 25)
            {
                int coarseDelay = milliseconds - 15;
                await Task.Delay(coarseDelay, token);
            }

            while (sw.ElapsedMilliseconds < milliseconds)
            {
                token.ThrowIfCancellationRequested();
                Thread.SpinWait(10);
            }
        }

        private static void SendHardwareKey(ushort vkCode, ushort scanCode, bool isExtended, bool isDown)
        {
            if (scanCode == 0 && vkCode != 0)
            {
                scanCode = GetScanCodeFromVk(vkCode);
            }

            uint flags = (isDown ? KEYEVENTF_KEYDOWN : KEYEVENTF_KEYUP);
            if (isExtended)
            {
                flags |= KEYEVENTF_EXTENDEDKEY;
            }

            INPUT[] inputs = new INPUT[1];
            inputs[0] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = vkCode,
                        wScan = scanCode,
                        dwFlags = flags,
                        time = 0,
                        dwExtraInfo = MAGIC_EXTRA_INFO
                    }
                }
            };

            SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));

            byte bVk = (byte)(vkCode & 0xFF);
            byte bScan = (byte)(scanCode & 0xFF);
            uint kFlags = (isExtended ? 1u : 0u) | (isDown ? 0u : 2u);
            keybd_event(bVk, bScan, kFlags, MAGIC_EXTRA_INFO);
        }

        public static bool IsExtendedKey(ushort vkCode)
        {
            return vkCode switch
            {
                0x21 or 0x22 or 0x23 or 0x24 => true, // PageUp, PageDown, End, Home
                0x25 or 0x26 or 0x27 or 0x28 => true, // Left, Up, Right, Down
                0x2D or 0x2E => true,                 // Insert, Delete
                0x5B or 0x5C => true,                 // Left/Right Win
                0x6F => true,                         // NumDivide
                0xA3 or 0xA5 => true,                 // RCtrl, RAlt
                _ => false
            };
        }

        public static ushort GetScanCodeFromVk(ushort vkCode)
        {
            return vkCode switch
            {
                0x1B => 0x01, // Esc
                0x31 => 0x02, // 1
                0x32 => 0x03, // 2
                0x33 => 0x04, // 3
                0x34 => 0x05, // 4
                0x35 => 0x06, // 5
                0x36 => 0x07, // 6
                0x37 => 0x08, // 7
                0x38 => 0x09, // 8
                0x39 => 0x0A, // 9
                0x30 => 0x0B, // 0
                0xBD => 0x0C, // -
                0xBB => 0x0D, // =
                0x08 => 0x0E, // Backspace
                0x09 => 0x0F, // Tab
                0x51 => 0x10, // Q
                0x57 => 0x11, // W
                0x45 => 0x12, // E
                0x52 => 0x13, // R
                0x54 => 0x14, // T
                0x59 => 0x15, // Y
                0x55 => 0x16, // U
                0x49 => 0x17, // I
                0x4F => 0x18, // O
                0x50 => 0x19, // P
                0xDB => 0x1A, // [
                0xDD => 0x1B, // ]
                0x0D => 0x1C, // Enter
                0x11 or 0xA2 => 0x1D, // Ctrl (Left)
                0x41 => 0x1E, // A
                0x53 => 0x1F, // S
                0x44 => 0x20, // D
                0x46 => 0x21, // F
                0x47 => 0x22, // G
                0x48 => 0x23, // H
                0x4A => 0x24, // J
                0x4B => 0x25, // K
                0x4C => 0x26, // L
                0xBA => 0x27, // ;
                0xDE => 0x28, // '
                0xC0 => 0x29, // `
                0x10 or 0xA0 => 0x2A, // Shift (Left)
                0xDC => 0x2B, // \
                0x5A => 0x2C, // Z
                0x58 => 0x2D, // X
                0x43 => 0x2E, // C
                0x56 => 0x2F, // V
                0x42 => 0x30, // B
                0x4E => 0x31, // N
                0x4D => 0x32, // M
                0xBC => 0x33, // ,
                0xBE => 0x34, // .
                0xBF => 0x35, // /
                0xA1 => 0x36, // Shift (Right)
                0x6A => 0x37, // Num *
                0x12 or 0xA4 => 0x38, // Alt (Left)
                0x20 => 0x39, // Space
                0x14 => 0x3A, // CapsLock
                0x70 => 0x3B, // F1
                0x71 => 0x3C, // F2
                0x72 => 0x3D, // F3
                0x73 => 0x3E, // F4
                0x74 => 0x3F, // F5
                0x75 => 0x40, // F6
                0x76 => 0x41, // F7
                0x77 => 0x42, // F8
                0x78 => 0x43, // F9
                0x79 => 0x44, // F10
                0x7A => 0x57, // F11
                0x7B => 0x58, // F12

                // Extended keys
                0x26 => 0x48, // UpArrow
                0x25 => 0x4B, // LeftArrow
                0x27 => 0x4D, // RightArrow
                0x28 => 0x50, // DownArrow
                0x2D => 0x52, // Insert
                0x2E => 0x53, // Delete
                0x24 => 0x47, // Home
                0x23 => 0x4F, // End
                0x21 => 0x49, // PageUp
                0x22 => 0x51, // PageDown
                0xA3 => 0x1D, // Right Ctrl
                0xA5 => 0x38, // Right Alt
                0x6F => 0x35, // Num /

                _ => (ushort)MapVirtualKey(vkCode, 0)
            };
        }

        public static ushort GetVkCodeFromName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return 0;
            var clean = name.Trim().ToLowerInvariant().Replace(" ", "").Replace("_", "").Replace("-", "");

            return clean switch
            {
                "rightarrow" or "right" => 0x27,
                "uparrow" or "up" => 0x26,
                "leftarrow" or "left" => 0x25,
                "downarrow" or "down" => 0x28,
                "space" or "spacebar" => 0x20,
                "shift" or "lshift" or "rshift" => 0x10,
                "ctrl" or "control" or "lctrl" or "rctrl" => 0x11,
                "alt" or "lalt" or "ralt" => 0x12,
                "enter" or "return" => 0x0D,
                "tab" => 0x09,
                "backspace" or "back" => 0x08,
                "esc" or "escape" => 0x1B,
                "capslock" or "caps" => 0x14,
                "pageup" or "pgup" => 0x21,
                "pagedown" or "pgdn" => 0x22,
                "end" => 0x23,
                "home" => 0x24,
                "insert" or "ins" => 0x2D,
                "delete" or "del" => 0x2E,
                "win" or "windows" => 0x5B,

                // Letters
                "a" => 0x41, "b" => 0x42, "c" => 0x43, "d" => 0x44, "e" => 0x45,
                "f" => 0x46, "g" => 0x47, "h" => 0x48, "i" => 0x49, "j" => 0x4A,
                "k" => 0x4B, "l" => 0x4C, "m" => 0x4D, "n" => 0x4E, "o" => 0x4F,
                "p" => 0x50, "q" => 0x51, "r" => 0x52, "s" => 0x53, "t" => 0x54,
                "u" => 0x55, "v" => 0x56, "w" => 0x57, "x" => 0x58, "y" => 0x59,
                "z" => 0x5A,

                // Digits
                "0" => 0x30, "1" => 0x31, "2" => 0x32, "3" => 0x33, "4" => 0x34,
                "5" => 0x35, "6" => 0x36, "7" => 0x37, "8" => 0x38, "9" => 0x39,

                // Numpad
                "num0" => 0x60, "num1" => 0x61, "num2" => 0x62, "num3" => 0x63, "num4" => 0x64,
                "num5" => 0x65, "num6" => 0x66, "num7" => 0x67, "num8" => 0x68, "num9" => 0x69,
                "nummultiply" or "multiply" or "num*" => 0x6A,
                "numadd" or "add" or "num+" => 0x6B,
                "numsubtract" or "subtract" or "num-" => 0x6D,
                "numdecimal" or "decimal" or "num." => 0x6E,
                "numdivide" or "divide" or "num/" => 0x6F,

                // Function keys
                "f1" => 0x70, "f2" => 0x71, "f3" => 0x72, "f4" => 0x73,
                "f5" => 0x74, "f6" => 0x75, "f7" => 0x76, "f8" => 0x77,
                "f9" => 0x78, "f10" => 0x79, "f11" => 0x7A, "f12" => 0x7B,

                // Punctuation
                ";" or "semicolon" => 0xBA,
                "=" or "equals" => 0xBB,
                "," or "comma" => 0xBC,
                "-" or "minus" => 0xBD,
                "." or "period" => 0xBE,
                "/" or "slash" => 0xBF,
                "`" or "grave" => 0xC0,
                "[" or "openbracket" => 0xDB,
                "\\" or "backslash" => 0xDC,
                "]" or "closebracket" => 0xDD,
                "'" or "quote" => 0xDE,

                _ => 0
            };
        }

        #region Win32 Native Structs & Methods

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedType.LPArray), In] INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern uint MapVirtualKey(uint uCode, uint uMapType);

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
            [FieldOffset(0)] public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT
        {
            public uint uMsg;
            public ushort wParamL;
            public ushort wParamH;
        }

        #endregion
    }
}

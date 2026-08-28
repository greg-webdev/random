using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Input;
using KeyRecorder.Models;

namespace KeyRecorder.Services
{
    public class Win32Hook : IDisposable
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        private const int VK_F4 = 0x73;
        private const int VK_F8 = 0x77;

        [StructLayout(LayoutKind.Sequential)]
        private struct KBDLLHOOKSTRUCT
        {
            public uint vkCode;
            public uint scanCode;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private readonly LowLevelKeyboardProc _proc;
        private IntPtr _hookId = IntPtr.Zero;

        private readonly HashSet<int> _pressedVkCodes = new();
        private readonly Stopwatch _stopwatch = new();
        
        public bool IsRecording { get; private set; }
        public int RecordHotKeyVk { get; set; } = VK_F4;   // Default F4 to record
        public int PlaybackHotKeyVk { get; set; } = VK_F8; // Default F8 to play macro

        public event Action<bool>? RecordingStateChanged;
        public event Action? PlaybackHotKeyTriggered;
        public event Action<KeyEventRecord>? KeyRecorded;

        public Win32Hook()
        {
            _proc = HookCallback;
        }

        public void StartHook()
        {
            if (_hookId == IntPtr.Zero)
            {
                using var curProcess = Process.GetCurrentProcess();
                using var curModule = curProcess.MainModule;
                _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule?.ModuleName), 0);
            }
        }

        public void StopHook()
        {
            if (_hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
            }
        }

        public void StartRecording()
        {
            if (IsRecording) return;
            _pressedVkCodes.Clear();
            _stopwatch.Restart();
            IsRecording = true;
            RecordingStateChanged?.Invoke(true);
        }

        public void StopRecording()
        {
            if (!IsRecording) return;
            _stopwatch.Stop();
            IsRecording = false;
            _pressedVkCodes.Clear();
            RecordingStateChanged?.Invoke(false);
        }

        public void ToggleRecording()
        {
            if (IsRecording)
            {
                StopRecording();
            }
            else
            {
                StartRecording();
            }
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                bool isKeyDown = (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN);
                bool isKeyUp = (msg == WM_KEYUP || msg == WM_SYSKEYUP);

                if (isKeyDown || isKeyUp)
                {
                    var hookStruct = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
                    
                    // Ignore our own synthetic playback keystrokes so they never interfere with recording or hotkeys
                    if (hookStruct.dwExtraInfo == (IntPtr)0x55AA)
                    {
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
                    }

                    int vkCode = (int)hookStruct.vkCode;
                    int scanCode = (int)hookStruct.scanCode;
                    bool isExtended = (hookStruct.flags & 0x01) != 0;

                    // 1. Check for Record Toggle Hotkey (F4 by default)
                    if (vkCode == RecordHotKeyVk)
                    {
                        if (isKeyDown)
                        {
                            if (!_pressedVkCodes.Contains(vkCode))
                            {
                                _pressedVkCodes.Add(vkCode);
                                ToggleRecording();
                            }
                        }
                        else
                        {
                            _pressedVkCodes.Remove(vkCode);
                        }
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
                    }

                    // 2. Check for Macro Playback Hotkey (F8 by default)
                    if (vkCode == PlaybackHotKeyVk)
                    {
                        if (isKeyDown)
                        {
                            if (!_pressedVkCodes.Contains(vkCode))
                            {
                                _pressedVkCodes.Add(vkCode);
                                PlaybackHotKeyTriggered?.Invoke();
                            }
                        }
                        else
                        {
                            _pressedVkCodes.Remove(vkCode);
                        }
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
                    }

                    // 3. Process recorded keystrokes if recording is active
                    if (IsRecording)
                    {
                        long currentMs = _stopwatch.ElapsedMilliseconds;

                        if (isKeyDown)
                        {
                            // Filter out OS auto-repeat keydown messages so true hold is tracked
                            if (!_pressedVkCodes.Contains(vkCode))
                            {
                                _pressedVkCodes.Add(vkCode);
                                var keyName = GetFriendlyKeyName(vkCode);
                                var record = new KeyEventRecord
                                {
                                    VirtualKeyCode = vkCode,
                                    ScanCode = scanCode,
                                    IsExtended = isExtended,
                                    Key = KeyInterop.KeyFromVirtualKey(vkCode),
                                    KeyName = keyName,
                                    IsKeyDown = true,
                                    TimestampMs = currentMs
                                };
                                KeyRecorded?.Invoke(record);
                            }
                        }
                        else if (isKeyUp)
                        {
                            _pressedVkCodes.Remove(vkCode);
                            var keyName = GetFriendlyKeyName(vkCode);
                            var record = new KeyEventRecord
                            {
                                VirtualKeyCode = vkCode,
                                ScanCode = scanCode,
                                IsExtended = isExtended,
                                Key = KeyInterop.KeyFromVirtualKey(vkCode),
                                KeyName = keyName,
                                IsKeyDown = false,
                                TimestampMs = currentMs
                            };
                            KeyRecorded?.Invoke(record);
                        }
                    }
                }
            }

            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        public static string GetFriendlyKeyName(int vkCode)
        {
            return vkCode switch
            {
                0x08 => "Backspace",
                0x09 => "Tab",
                0x0D => "Enter",
                0x10 or 0xA0 or 0xA1 => "Shift",
                0x11 or 0xA2 or 0xA3 => "Ctrl",
                0x12 or 0xA4 or 0xA5 => "Alt",
                0x13 => "Pause",
                0x14 => "CapsLock",
                0x1B => "Esc",
                0x20 => "Space",
                0x21 => "PageUp",
                0x22 => "PageDown",
                0x23 => "End",
                0x24 => "Home",
                0x25 => "LeftArrow",
                0x26 => "UpArrow",
                0x27 => "RightArrow",
                0x28 => "DownArrow",
                0x2C => "PrintScreen",
                0x2D => "Insert",
                0x2E => "Delete",
                0x5B or 0x5C => "Win",
                >= 0x30 and <= 0x39 => ((char)vkCode).ToString(), // 0-9
                >= 0x41 and <= 0x5A => ((char)vkCode).ToString(), // A-Z
                >= 0x60 and <= 0x69 => $"Num{vkCode - 0x60}",     // Numpad 0-9
                0x6A => "NumMultiply",
                0x6B => "NumAdd",
                0x6D => "NumSubtract",
                0x6E => "NumDecimal",
                0x6F => "NumDivide",
                >= 0x70 and <= 0x87 => $"F{vkCode - 0x70 + 1}",   // F1-F24
                0xBA => ";",
                0xBB => "=",
                0xBC => ",",
                0xBD => "-",
                0xBE => ".",
                0xBF => "/",
                0xC0 => "`",
                0xDB => "[",
                0xDC => "\\",
                0xDD => "]",
                0xDE => "'",
                _ => KeyInterop.KeyFromVirtualKey(vkCode).ToString()
            };
        }

        public void Dispose()
        {
            StopHook();
            GC.SuppressFinalize(this);
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string? lpModuleName);
    }
}

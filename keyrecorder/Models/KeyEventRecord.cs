using System;
using System.Windows.Input;

namespace KeyRecorder.Models
{
    public class KeyEventRecord
    {
        public Key Key { get; set; }
        public int VirtualKeyCode { get; set; }
        public int ScanCode { get; set; }
        public bool IsExtended { get; set; }
        public string KeyName { get; set; } = string.Empty;
        public bool IsKeyDown { get; set; }
        public long TimestampMs { get; set; }

        public override string ToString()
        {
            return $"[{(IsKeyDown ? "DOWN" : "UP  ")}] {KeyName,-14} at {TimestampMs}ms (VK: 0x{VirtualKeyCode:X2}, SC: 0x{ScanCode:X2})";
        }
    }
}

using System.Collections.Generic;

namespace KeyRecorder.Models
{
    public enum InstructionType
    {
        HoldKeys,
        ReleaseGap,
        Custom
    }

    public class KeyInstruction
    {
        public InstructionType Type { get; set; }
        public List<string> Keys { get; set; } = new();
        public string KeyName => Keys.Count > 0 ? Keys[0] : string.Empty;
        public long DurationMs { get; set; }
        public string InstructionText { get; set; } = string.Empty;

        public KeyInstruction() { }

        public KeyInstruction(InstructionType type, IEnumerable<string> keys, long durationMs, string text)
        {
            Type = type;
            Keys = new List<string>(keys);
            DurationMs = durationMs;
            InstructionText = text;
        }

        public KeyInstruction(InstructionType type, string singleKey, long durationMs, string text)
        {
            Type = type;
            if (!string.IsNullOrEmpty(singleKey))
            {
                Keys.Add(singleKey);
            }
            DurationMs = durationMs;
            InstructionText = text;
        }

        public override string ToString()
        {
            return InstructionText;
        }
    }
}

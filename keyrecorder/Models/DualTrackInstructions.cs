using System.Collections.Generic;

namespace KeyRecorder.Models
{
    public class DualTrackInstructions
    {
        public List<KeyInstruction> SustainedInstructions { get; set; } = new();
        public List<KeyInstruction> QuickInstructions { get; set; } = new();

        public bool HasSustainedKeys => SustainedInstructions.Count > 0;
        public bool HasQuickKeys => QuickInstructions.Count > 0;
        public int TotalCount => SustainedInstructions.Count + QuickInstructions.Count;
    }
}

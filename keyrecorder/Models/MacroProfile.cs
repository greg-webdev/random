using System;
using System.Collections.Generic;

namespace KeyRecorder.Models
{
    public class MacroProfile
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "Untitled Macro";
        public string Description { get; set; } = string.Empty;
        public string FormattedText { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public int StepCount { get; set; }
        public long TotalDurationMs { get; set; }
    }
}

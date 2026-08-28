using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using KeyRecorder.Models;

namespace KeyRecorder.Services
{
    public enum OutputFormatMode
    {
        CommaSeparatedInline,
        LineByLine,
        DetailedList
    }

    public class FormattingOptions
    {
        public OutputFormatMode FormatMode { get; set; } = OutputFormatMode.CommaSeparatedInline;
        public bool EnableDualTrack { get; set; } = true; // Separate sustained held keys from quick action keys
        public bool SmartChordGrouping { get; set; } = true;
        public int ChordStaggerToleranceMs { get; set; } = 45;
        public int SustainedHoldMinThresholdMs { get; set; } = 400; // Minimum duration to qualify as sustained base key
        public bool IncludeInitialDelay { get; set; } = false;
        public int MinDurationThresholdMs { get; set; } = 5;
        public string MultiKeyConnector { get; set; } = " and ";
        public string HoldTemplate { get; set; } = "hold {key} for {ms}ms";
        public string ReleaseTemplate { get; set; } = "release for {ms}ms";
        public string Separator { get; set; } = ", ";
    }

    public class KeyInstructionFormatter
    {
        private class KeyInterval
        {
            public string KeyName { get; set; } = string.Empty;
            public int VkCode { get; set; }
            public int ScanCode { get; set; }
            public bool IsExtended { get; set; }
            public long DownTimestamp { get; set; }
            public long UpTimestamp { get; set; }
            public long Duration => Math.Max(0, UpTimestamp - DownTimestamp);
        }

        private class StateSlice
        {
            public HashSet<string> Keys { get; set; } = new(StringComparer.OrdinalIgnoreCase);
            public long StartTime { get; set; }
            public long EndTime { get; set; }
            public long Duration => Math.Max(0, EndTime - StartTime);

            public bool HasSameKeys(HashSet<string> other)
            {
                return Keys.SetEquals(other);
            }
        }

        /// <summary>
        /// Analyzes raw events and splits them into 2 distinct sets:
        /// Set 1: Long sustained held keys (supports holding multiple keys together!)
        /// Set 2: Quick pressed keys (dynamic taps and switches)
        /// </summary>
        public static DualTrackInstructions ParseDualTrackInstructions(IReadOnlyList<KeyEventRecord> rawEvents, FormattingOptions? options = null)
        {
            options ??= new FormattingOptions();
            var result = new DualTrackInstructions();

            if (rawEvents == null || rawEvents.Count == 0)
            {
                return result;
            }

            // 1. Reconstruct discrete key intervals: Down -> Up
            var intervals = new List<KeyInterval>();
            var activeDowns = new Dictionary<string, KeyEventRecord>(StringComparer.OrdinalIgnoreCase);

            foreach (var evt in rawEvents)
            {
                if (evt.IsKeyDown)
                {
                    if (!activeDowns.ContainsKey(evt.KeyName))
                    {
                        activeDowns[evt.KeyName] = evt;
                    }
                }
                else
                {
                    if (activeDowns.TryGetValue(evt.KeyName, out var downEvt))
                    {
                        intervals.Add(new KeyInterval
                        {
                            KeyName = evt.KeyName,
                            VkCode = evt.VirtualKeyCode,
                            ScanCode = evt.ScanCode,
                            IsExtended = evt.IsExtended,
                            DownTimestamp = downEvt.TimestampMs,
                            UpTimestamp = evt.TimestampMs
                        });
                        activeDowns.Remove(evt.KeyName);
                    }
                }
            }

            // Include any keys held until recording stopped
            long finalTimestamp = rawEvents[^1].TimestampMs;
            foreach (var kvp in activeDowns)
            {
                intervals.Add(new KeyInterval
                {
                    KeyName = kvp.Key,
                    VkCode = kvp.Value.VirtualKeyCode,
                    ScanCode = kvp.Value.ScanCode,
                    IsExtended = kvp.Value.IsExtended,
                    DownTimestamp = kvp.Value.TimestampMs,
                    UpTimestamp = finalTimestamp
                });
            }

            if (intervals.Count == 0) return result;

            // 2. Classify: Sustained Held Keys vs Quick Keys
            var sustainedList = new List<KeyInterval>();
            var quickList = new List<KeyInterval>();

            foreach (var interval in intervals)
            {
                bool hasSubEvents = intervals.Any(other =>
                    other != interval &&
                    other.DownTimestamp >= interval.DownTimestamp &&
                    other.DownTimestamp <= interval.UpTimestamp);

                if (options.EnableDualTrack && hasSubEvents && interval.Duration >= options.SustainedHoldMinThresholdMs)
                {
                    sustainedList.Add(interval);
                }
                else
                {
                    quickList.Add(interval);
                }
            }

            // If everything ended up in sustained and quick is empty, move them all to quick
            if (sustainedList.Count > 0 && quickList.Count == 0)
            {
                quickList.AddRange(sustainedList);
                sustainedList.Clear();
            }

            // 3. Format Track Instructions (Supports Multi-Key Chords & Delays in Both Tracks!)
            result.SustainedInstructions = GenerateTrackInstructions(sustainedList, options);
            result.QuickInstructions = GenerateTrackInstructions(quickList, options);

            return result;
        }

        private static List<KeyInstruction> GenerateTrackInstructions(List<KeyInterval> intervals, FormattingOptions options)
        {
            var instructions = new List<KeyInstruction>();
            if (intervals == null || intervals.Count == 0) return instructions;

            // Collect all boundary timestamps
            var timestamps = new SortedSet<long>();
            foreach (var interval in intervals)
            {
                timestamps.Add(interval.DownTimestamp);
                timestamps.Add(interval.UpTimestamp);
            }

            var timeList = timestamps.ToList();
            var rawSlices = new List<StateSlice>();

            for (int i = 0; i < timeList.Count - 1; i++)
            {
                long tStart = timeList[i];
                long tEnd = timeList[i + 1];
                if (tEnd <= tStart) continue;

                var activeKeys = intervals
                    .Where(x => x.DownTimestamp <= tStart && x.UpTimestamp >= tEnd)
                    .Select(x => x.KeyName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                rawSlices.Add(new StateSlice
                {
                    Keys = activeKeys,
                    StartTime = tStart,
                    EndTime = tEnd
                });
            }

            // Merge consecutive identical active key states
            var mergedSlices = new List<StateSlice>();
            foreach (var slice in rawSlices)
            {
                if (slice.Duration <= 0) continue;
                if (mergedSlices.Count > 0 && mergedSlices[^1].HasSameKeys(slice.Keys))
                {
                    mergedSlices[^1].EndTime = slice.EndTime;
                }
                else
                {
                    mergedSlices.Add(new StateSlice
                    {
                        Keys = new HashSet<string>(slice.Keys, StringComparer.OrdinalIgnoreCase),
                        StartTime = slice.StartTime,
                        EndTime = slice.EndTime
                    });
                }
            }

            // Handle finger micro-staggers (< ChordStaggerToleranceMs) when pressing/releasing multi keys together
            if (options.SmartChordGrouping && mergedSlices.Count > 1)
            {
                var cleaned = new List<StateSlice>();
                for (int i = 0; i < mergedSlices.Count; i++)
                {
                    var cur = mergedSlices[i];
                    if (cur.Keys.Count > 0 && cur.Duration <= options.ChordStaggerToleranceMs && i + 1 < mergedSlices.Count)
                    {
                        var next = mergedSlices[i + 1];
                        if (next.Keys.Count > 0 && (cur.Keys.IsSubsetOf(next.Keys) || next.Keys.IsSubsetOf(cur.Keys)))
                        {
                            next.StartTime = cur.StartTime;
                            continue;
                        }
                    }
                    cleaned.Add(cur);
                }

                var finalSlices = new List<StateSlice>();
                foreach (var s in cleaned)
                {
                    if (s.Duration <= 0) continue;
                    if (finalSlices.Count > 0 && finalSlices[^1].HasSameKeys(s.Keys))
                    {
                        finalSlices[^1].EndTime = s.EndTime;
                    }
                    else
                    {
                        finalSlices.Add(s);
                    }
                }
                mergedSlices = finalSlices;
            }

            // Convert slices to instructions
            bool hadFirstAction = false;
            foreach (var slice in mergedSlices)
            {
                long duration = slice.Duration;
                if (duration < options.MinDurationThresholdMs) continue;

                if (slice.Keys.Count == 0)
                {
                    // Delay gap between holds
                    if (hadFirstAction || options.IncludeInitialDelay)
                    {
                        instructions.Add(new KeyInstruction(
                            InstructionType.ReleaseGap,
                            string.Empty,
                            duration,
                            options.ReleaseTemplate.Replace("{ms}", duration.ToString())
                        ));
                    }
                }
                else
                {
                    hadFirstAction = true;
                    var keyList = slice.Keys.ToList();
                    string joinedKeys = string.Join(options.MultiKeyConnector, keyList);
                    string text = options.HoldTemplate
                        .Replace("{key}", joinedKeys)
                        .Replace("{ms}", duration.ToString());

                    instructions.Add(new KeyInstruction(
                        InstructionType.HoldKeys,
                        keyList,
                        duration,
                        text
                    ));
                }
            }

            return instructions;
        }

        public static string FormatToString(IReadOnlyList<KeyEventRecord> rawEvents, FormattingOptions? options = null)
        {
            options ??= new FormattingOptions();
            var dualTrack = ParseDualTrackInstructions(rawEvents, options);

            if (dualTrack.TotalCount == 0)
            {
                return string.Empty;
            }

            // If there are sustained held keys, output 2 clearly demarcated sets:
            if (dualTrack.HasSustainedKeys)
            {
                var sb = new System.Text.StringBuilder();

                sb.AppendLine("[HELD KEYS]");
                sb.AppendLine(string.Join(options.Separator, dualTrack.SustainedInstructions.Select(x => x.InstructionText)));
                sb.AppendLine();

                sb.AppendLine("[QUICK KEYS]");
                sb.AppendLine(string.Join(options.Separator, dualTrack.QuickInstructions.Select(x => x.InstructionText)));

                return sb.ToString().TrimEnd();
            }
            else
            {
                // Single set of quick actions
                return options.FormatMode switch
                {
                    OutputFormatMode.CommaSeparatedInline => string.Join(options.Separator, dualTrack.QuickInstructions.Select(x => x.InstructionText)),
                    OutputFormatMode.LineByLine => string.Join("," + Environment.NewLine, dualTrack.QuickInstructions.Select(x => x.InstructionText)),
                    OutputFormatMode.DetailedList => string.Join(Environment.NewLine, dualTrack.QuickInstructions.Select((x, idx) => $"{idx + 1}. {x.InstructionText}")),
                    _ => string.Join(options.Separator, dualTrack.QuickInstructions.Select(x => x.InstructionText))
                };
            }
        }

        /// <summary>
        /// Parses text back into DualTrackInstructions for macro playback.
        /// Supports both dual-set format ("[HELD KEYS]" / "[QUICK KEYS]") and single-set comma format.
        /// </summary>
        public static DualTrackInstructions ParseDualTrackFromString(string scriptText)
        {
            var result = new DualTrackInstructions();
            if (string.IsNullOrWhiteSpace(scriptText)) return result;

            if (scriptText.IndexOf("[HELD KEYS]", StringComparison.OrdinalIgnoreCase) >= 0 ||
                scriptText.IndexOf("[QUICK KEYS]", StringComparison.OrdinalIgnoreCase) >= 0 ||
                scriptText.IndexOf("[SUSTAINED KEYS]", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var lines = scriptText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                bool inHeld = false;
                bool inQuick = false;

                var heldLines = new List<string>();
                var quickLines = new List<string>();

                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    if (trimmed.Equals("[HELD KEYS]", StringComparison.OrdinalIgnoreCase) ||
                        trimmed.Equals("[SUSTAINED KEYS]", StringComparison.OrdinalIgnoreCase))
                    {
                        inHeld = true;
                        inQuick = false;
                        continue;
                    }
                    if (trimmed.Equals("[QUICK KEYS]", StringComparison.OrdinalIgnoreCase) ||
                        trimmed.Equals("[ACTION KEYS]", StringComparison.OrdinalIgnoreCase))
                    {
                        inHeld = false;
                        inQuick = true;
                        continue;
                    }

                    if (inHeld) heldLines.Add(trimmed);
                    else if (inQuick) quickLines.Add(trimmed);
                    else quickLines.Add(trimmed);
                }

                result.SustainedInstructions = ParseInstructionsFromChunk(string.Join(", ", heldLines));
                result.QuickInstructions = ParseInstructionsFromChunk(string.Join(", ", quickLines));
            }
            else
            {
                result.QuickInstructions = ParseInstructionsFromChunk(scriptText);
            }

            return result;
        }

        public static List<KeyInstruction> ParseFromString(string scriptText)
        {
            var dual = ParseDualTrackFromString(scriptText);
            var combined = new List<KeyInstruction>(dual.SustainedInstructions);
            combined.AddRange(dual.QuickInstructions);
            return combined;
        }

        private static List<KeyInstruction> ParseInstructionsFromChunk(string chunk)
        {
            var result = new List<KeyInstruction>();
            if (string.IsNullOrWhiteSpace(chunk)) return result;

            var parts = chunk
                .Split(new[] { ',', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrWhiteSpace(p));

            var holdRegex = new Regex(@"^hold\s+(?<keys>.+?)\s+for\s+(?<ms>\d+)\s*ms", RegexOptions.IgnoreCase);
            var releaseRegex = new Regex(@"^(?:release|wait|delay|pause)\s*(?:for)?\s*(?<ms>\d+)\s*ms", RegexOptions.IgnoreCase);

            foreach (var part in parts)
            {
                var cleanPart = Regex.Replace(part, @"^\d+[\.\)]\s*", "").Trim();

                var holdMatch = holdRegex.Match(cleanPart);
                if (holdMatch.Success)
                {
                    string rawKeys = holdMatch.Groups["keys"].Value;
                    long ms = long.Parse(holdMatch.Groups["ms"].Value);

                    var keys = Regex.Split(rawKeys, @"\s+(?:and|\+|&)\s+|\s*,\s*", RegexOptions.IgnoreCase)
                        .Select(k => k.Trim())
                        .Where(k => !string.IsNullOrEmpty(k))
                        .ToList();

                    result.Add(new KeyInstruction(InstructionType.HoldKeys, keys, ms, cleanPart));
                    continue;
                }

                var releaseMatch = releaseRegex.Match(cleanPart);
                if (releaseMatch.Success)
                {
                    long ms = long.Parse(releaseMatch.Groups["ms"].Value);
                    result.Add(new KeyInstruction(InstructionType.ReleaseGap, string.Empty, ms, cleanPart));
                }
            }

            return result;
        }
    }
}

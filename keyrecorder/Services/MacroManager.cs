using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using KeyRecorder.Models;

namespace KeyRecorder.Services
{
    public class MacroManager
    {
        private readonly string _macroDirectory;

        public MacroManager()
        {
            _macroDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "KeyRecorder",
                "Macros");

            try
            {
                if (!Directory.Exists(_macroDirectory))
                {
                    Directory.CreateDirectory(_macroDirectory);
                }
            }
            catch
            {
                // Fallback to local ./macros
                _macroDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "macros");
                if (!Directory.Exists(_macroDirectory))
                {
                    Directory.CreateDirectory(_macroDirectory);
                }
            }
        }

        public List<MacroProfile> GetAllMacros()
        {
            var list = new List<MacroProfile>();
            try
            {
                var files = Directory.GetFiles(_macroDirectory, "*.json");
                foreach (var file in files)
                {
                    try
                    {
                        string json = File.ReadAllText(file);
                        var profile = JsonSerializer.Deserialize<MacroProfile>(json);
                        if (profile != null)
                        {
                            list.Add(profile);
                        }
                    }
                    catch
                    {
                        // Skip corrupted files
                    }
                }
            }
            catch
            {
                // Ignore directory scan errors
            }

            return list;
        }

        public void SaveMacro(MacroProfile profile)
        {
            profile.UpdatedAt = DateTime.Now;
            string fileName = SanitizeFileName(profile.Name) + "_" + profile.Id.Substring(0, 8) + ".json";
            string fullPath = Path.Combine(_macroDirectory, fileName);
            string json = JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(fullPath, json);
        }

        public void DeleteMacro(MacroProfile profile)
        {
            try
            {
                var files = Directory.GetFiles(_macroDirectory, "*" + profile.Id.Substring(0, 8) + "*.json");
                foreach (var f in files)
                {
                    File.Delete(f);
                }
            }
            catch
            {
                // Ignore delete errors
            }
        }

        private static string SanitizeFileName(string name)
        {
            var invalid = Path.GetInvalidFileNameChars();
            foreach (var c in invalid)
            {
                name = name.Replace(c, '_');
            }
            return string.IsNullOrWhiteSpace(name) ? "macro" : name.Trim();
        }
    }
}

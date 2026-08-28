using System;
using System.Threading.Tasks;

namespace KeyRecorder.Services
{
    public static class SoundFeedback
    {
        public static bool Enabled { get; set; } = true;

        public static void PlayStartSound()
        {
            if (!Enabled) return;
            Task.Run(() =>
            {
                try
                {
                    // High pitch short double chirp
                    Console.Beep(1046, 70); // C6
                    Console.Beep(1318, 90); // E6
                }
                catch
                {
                    // Ignore on environments where beep isn't available
                }
            });
        }

        public static void PlayStopSound()
        {
            if (!Enabled) return;
            Task.Run(() =>
            {
                try
                {
                    // Downward chirp
                    Console.Beep(1318, 70); // E6
                    Console.Beep(880, 90);  // A5
                }
                catch
                {
                    // Ignore on environments where beep isn't available
                }
            });
        }
    }
}

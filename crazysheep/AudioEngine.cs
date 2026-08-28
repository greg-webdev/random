using System;
using System.Runtime.InteropServices;
using Raylib_cs;

namespace CrazyCattle3D
{
    public static class AudioEngine
    {
        private static Sound s_baaSound;
        private static Sound s_crashSound;
        private static Sound s_explosionSound;
        private static Sound s_dashSound;
        private static Sound s_jumpSound;
        private static Sound s_winSound;
        private static Sound s_gameOverSound;
        private static bool s_initialized;

        public static void Initialize()
        {
            if (s_initialized) return;

            try
            {
                Raylib.InitAudioDevice();
                if (Raylib.IsAudioDeviceReady())
                {
                    s_baaSound = GenerateBaaSound();
                    s_crashSound = GenerateCrashSound();
                    s_explosionSound = GenerateExplosionSound();
                    s_dashSound = GenerateDashSound();
                    s_jumpSound = GenerateJumpSound();
                    s_winSound = GenerateWinSound();
                    s_gameOverSound = GenerateGameOverSound();
                    s_initialized = true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Audio init exception: {ex.Message}");
            }
        }

        public static void PlayBaa(float pitch = 1.0f)
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_baaSound, Math.Clamp(pitch, 0.6f, 1.6f));
            Raylib.SetSoundVolume(s_baaSound, 0.9f);
            Raylib.PlaySound(s_baaSound);
        }

        public static void PlayCrash(float volume = 0.8f)
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_crashSound, 0.9f + (float)Random.Shared.NextDouble() * 0.2f);
            Raylib.SetSoundVolume(s_crashSound, Math.Clamp(volume, 0.2f, 1.0f));
            Raylib.PlaySound(s_crashSound);
        }

        public static void PlayExplosion()
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_explosionSound, 0.85f + (float)Random.Shared.NextDouble() * 0.3f);
            Raylib.SetSoundVolume(s_explosionSound, 1.0f);
            Raylib.PlaySound(s_explosionSound);
        }

        public static void PlayDash()
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_dashSound, 1.0f + (float)Random.Shared.NextDouble() * 0.2f);
            Raylib.SetSoundVolume(s_dashSound, 0.75f);
            Raylib.PlaySound(s_dashSound);
        }

        public static void PlayJump()
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_jumpSound, 1.0f);
            Raylib.SetSoundVolume(s_jumpSound, 0.7f);
            Raylib.PlaySound(s_jumpSound);
        }

        public static void PlayWin()
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_winSound, 1.0f);
            Raylib.SetSoundVolume(s_winSound, 1.0f);
            Raylib.PlaySound(s_winSound);
        }

        public static void PlayGameOver()
        {
            if (!s_initialized) return;
            Raylib.SetSoundPitch(s_gameOverSound, 1.0f);
            Raylib.SetSoundVolume(s_gameOverSound, 1.0f);
            Raylib.PlaySound(s_gameOverSound);
        }

        public static void Shutdown()
        {
            if (!s_initialized) return;
            Raylib.UnloadSound(s_baaSound);
            Raylib.UnloadSound(s_crashSound);
            Raylib.UnloadSound(s_explosionSound);
            Raylib.UnloadSound(s_dashSound);
            Raylib.UnloadSound(s_jumpSound);
            Raylib.UnloadSound(s_winSound);
            Raylib.UnloadSound(s_gameOverSound);
            Raylib.CloseAudioDevice();
            s_initialized = false;
        }

        private static unsafe Sound GenerateSoundFromSamples(short[] samples, uint sampleRate = 44100)
        {
            int byteCount = samples.Length * sizeof(short);
            IntPtr buffer = Marshal.AllocHGlobal(byteCount);
            Marshal.Copy(samples, 0, buffer, samples.Length);

            Wave wave = new Wave
            {
                SampleCount = (uint)samples.Length,
                SampleRate = sampleRate,
                SampleSize = 16,
                Channels = 1,
                Data = (void*)buffer
            };

            Sound sound = Raylib.LoadSoundFromWave(wave);
            Marshal.FreeHGlobal(buffer);
            return sound;
        }

        // Synthesize a funny cartoon sheep "Baa-a-a-h!"
        private static Sound GenerateBaaSound()
        {
            const int sampleRate = 44100;
            float duration = 0.55f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                // Vibrato / tremolo typical of a sheep bleat (around 6-8 Hz wobble)
                float wobble = 1.0f + 0.12f * MathF.Sin(2.0f * MathF.PI * 7.5f * t);
                float baseFreq = (220.0f - 30.0f * (t / duration)) * wobble;

                // Formant-like harmonics: fundamental + 2nd, 3rd harmonics + subtle nasal buzzy timbre
                float s = 0.45f * MathF.Sin(2.0f * MathF.PI * baseFreq * t);
                s += 0.35f * MathF.Sin(2.0f * MathF.PI * (baseFreq * 2.05f) * t);
                s += 0.20f * MathF.Sin(2.0f * MathF.PI * (baseFreq * 3.1f) * t);
                s += 0.12f * MathF.Sin(2.0f * MathF.PI * (baseFreq * 4.2f) * t);

                // Attack-Decay-Sustain-Release envelope
                float env = 1.0f;
                if (t < 0.05f) env = t / 0.05f;
                else if (t > 0.40f) env = MathF.Max(0.0f, (duration - t) / (duration - 0.40f));

                float sample = Math.Clamp(s * env, -1.0f, 1.0f);
                samples[i] = (short)(sample * 30000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Heavy physics punch / bumper car collision thud
        private static Sound GenerateCrashSound()
        {
            const int sampleRate = 44100;
            float duration = 0.28f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];
            Random rnd = new Random(42);

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                float env = MathF.Exp(-14.0f * t);
                float freq = 120.0f * MathF.Exp(-18.0f * t) + 45.0f;
                float tonal = MathF.Sin(2.0f * MathF.PI * freq * t);
                float noise = (float)(rnd.NextDouble() * 2.0 - 1.0) * MathF.Exp(-22.0f * t);

                float s = Math.Clamp((tonal * 0.7f + noise * 0.5f) * env, -1.0f, 1.0f);
                samples[i] = (short)(s * 31000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Comic explosion boom with sub-bass kick + noisy shrapnel
        private static Sound GenerateExplosionSound()
        {
            const int sampleRate = 44100;
            float duration = 0.85f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];
            Random rnd = new Random(1337);

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                float env = MathF.Exp(-4.5f * t);
                float subFreq = 85.0f * MathF.Exp(-6.0f * t) + 25.0f;
                float sub = MathF.Sin(2.0f * MathF.PI * subFreq * t);
                float noise = (float)(rnd.NextDouble() * 2.0 - 1.0);
                
                // Distorted overdrive for punchy cartoon boom
                float raw = (sub * 0.6f + noise * 0.6f) * env;
                float s = MathF.Tanh(raw * 2.2f);

                samples[i] = (short)(s * 32000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Whoosh dash sound
        private static Sound GenerateDashSound()
        {
            const int sampleRate = 44100;
            float duration = 0.35f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];
            Random rnd = new Random(77);

            float last = 0.0f;
            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                float env = MathF.Sin(MathF.PI * (t / duration));
                float white = (float)(rnd.NextDouble() * 2.0 - 1.0);
                
                // Simple low-pass filter to make it whooshy
                float filtered = last + 0.25f * (white - last);
                last = filtered;

                float s = Math.Clamp(filtered * env * 1.5f, -1.0f, 1.0f);
                samples[i] = (short)(s * 28000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Boing jump sound
        private static Sound GenerateJumpSound()
        {
            const int sampleRate = 44100;
            float duration = 0.22f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                float env = MathF.Max(0.0f, 1.0f - (t / duration));
                float freq = 180.0f + 400.0f * (t / duration);
                float s = MathF.Sin(2.0f * MathF.PI * freq * t) * env;

                samples[i] = (short)(s * 25000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Triumphant win fanfare
        private static Sound GenerateWinSound()
        {
            const int sampleRate = 44100;
            float duration = 1.2f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];

            float[] notes = { 523.25f, 659.25f, 783.99f, 1046.50f }; // C5, E5, G5, C6
            float noteDur = 0.25f;

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                int noteIndex = Math.Min((int)(t / noteDur), notes.Length - 1);
                float noteFreq = notes[noteIndex];
                float noteT = t - (noteIndex * noteDur);
                float env = MathF.Exp(-2.5f * noteT);
                
                float s = (MathF.Sin(2.0f * MathF.PI * noteFreq * t) + 
                           0.4f * MathF.Sin(2.0f * MathF.PI * noteFreq * 2.0f * t)) * env;

                samples[i] = (short)(Math.Clamp(s * 0.7f, -1.0f, 1.0f) * 28000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }

        // Sad trombone defeat
        private static Sound GenerateGameOverSound()
        {
            const int sampleRate = 44100;
            float duration = 1.4f;
            int totalSamples = (int)(sampleRate * duration);
            short[] samples = new short[totalSamples];

            float[] freqs = { 293.66f, 277.18f, 261.63f, 246.94f }; // D4, C#4, C4, B3
            float noteDur = 0.35f;

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                int noteIndex = Math.Min((int)(t / noteDur), freqs.Length - 1);
                float f = freqs[noteIndex];
                if (noteIndex == freqs.Length - 1)
                {
                    // wobble / slide down
                    f *= (1.0f - 0.15f * (t - 3.0f * noteDur) + 0.04f * MathF.Sin(2.0f * MathF.PI * 6.0f * t));
                }

                float noteT = t - (noteIndex * noteDur);
                float env = MathF.Exp(-1.8f * noteT);
                float s = (MathF.Sin(2.0f * MathF.PI * f * t) + 0.3f * MathF.Sin(2.0f * MathF.PI * f * 3.0f * t)) * env;

                samples[i] = (short)(Math.Clamp(s * 0.65f, -1.0f, 1.0f) * 27000);
            }

            return GenerateSoundFromSamples(samples, sampleRate);
        }
    }
}

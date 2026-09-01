using System;

namespace OreFinder.Services
{
    /// <summary>
    /// Exact implementation of java.util.Random (48-bit Linear Congruential Generator).
    /// Guarantees 100% bit-exact parity with Minecraft Java Edition 1.8 and 1.12.
    /// </summary>
    public class JavaRandom
    {
        private long _seed;
        private const long Multiplier = 0x5DEECE66DL;
        private const long Addend = 0xBL;
        private const long Mask = (1L << 48) - 1;

        public JavaRandom() : this(DateTime.UtcNow.Ticks)
        {
        }

        public JavaRandom(long seed)
        {
            SetSeed(seed);
        }

        public void SetSeed(long seed)
        {
            _seed = (seed ^ Multiplier) & Mask;
        }

        public int Next(int bits)
        {
            _seed = (_seed * Multiplier + Addend) & Mask;
            return (int)((ulong)_seed >> (48 - bits));
        }

        public int NextInt()
        {
            return Next(32);
        }

        public int NextInt(int bound)
        {
            if (bound <= 0)
                throw new ArgumentException("bound must be positive", nameof(bound));

            if ((bound & -bound) == bound) // Power of 2
                return (int)((bound * (long)Next(31)) >> 31);

            int bits, val;
            do
            {
                bits = Next(31);
                val = bits % bound;
            } while (bits - val + (bound - 1) < 0);

            return val;
        }

        public long NextLong()
        {
            return ((long)Next(32) << 32) + Next(32);
        }

        public float NextFloat()
        {
            return Next(24) / ((float)(1 << 24));
        }

        public double NextDouble()
        {
            return (((long)Next(26) << 27) + Next(27)) / (double)(1L << 53);
        }

        public bool NextBoolean()
        {
            return Next(1) != 0;
        }

        /// <summary>
        /// Converts a Minecraft seed string (numeric or string hash) to a 64-bit long seed.
        /// </summary>
        public static long ParseSeed(string seedStr)
        {
            if (string.IsNullOrWhiteSpace(seedStr))
                return 0L;

            seedStr = seedStr.Trim();
            if (long.TryParse(seedStr, out long numericSeed))
            {
                return numericSeed;
            }

            // Java String.hashCode() algorithm for alphanumeric seeds
            int hash = 0;
            foreach (char c in seedStr)
            {
                hash = 31 * hash + c;
            }
            return hash;
        }
    }
}

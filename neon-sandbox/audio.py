"""
Procedural Synthesizer Sound Engine for Neon Chaos Sandbox.
Generates all sound effects dynamically using NumPy waveforms and Pygame Mixer.
Zero external audio files required.
"""

import math
import numpy as np
import pygame

SAMPLE_RATE = 44100

class SoundEngine:
    def __init__(self):
        self.enabled = False
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=SAMPLE_RATE, size=-16, channels=2, buffer=512)
            self.enabled = True
            pygame.mixer.set_num_channels(24)
        except Exception as e:
            print(f"[SoundEngine] Audio init disabled: {e}")
            return

        self.pentatonic_scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]
        self._cache = {}
        self._pregenerate_sounds()

    def _make_sound(self, samples_mono):
        """Converts float numpy array [-1.0, 1.0] to 16-bit stereo pygame Sound."""
        samples_mono = np.clip(samples_mono, -1.0, 1.0)
        samples_16bit = (samples_mono * 32767).astype(np.int16)
        samples_stereo = np.column_stack((samples_16bit, samples_16bit))
        return pygame.sndarray.make_sound(samples_stereo)

    def _pregenerate_sounds(self):
        # 1. Pentatonic chimes for bounces
        self.chimes = []
        for freq in self.pentatonic_scale:
            dur = 0.22
            t = np.linspace(0, dur, int(SAMPLE_RATE * dur), False)
            decay = np.exp(-t * 18.0)
            wave = (np.sin(2 * np.pi * freq * t) * 0.7 +
                    np.sin(4 * np.pi * freq * t) * 0.2 +
                    np.sin(6 * np.pi * freq * t) * 0.1) * decay
            self.chimes.append(self._make_sound(wave * 0.45))

        # 2. Squish sound (soft body)
        dur = 0.15
        t = np.linspace(0, dur, int(SAMPLE_RATE * dur), False)
        freq_sweep = np.linspace(350, 120, len(t))
        phase = 2 * np.pi * np.cumsum(freq_sweep) / SAMPLE_RATE
        decay = np.exp(-t * 16.0)
        squish_wave = np.sin(phase) * decay * 0.4
        self.squish_sound = self._make_sound(squish_wave)

        # 3. Bumper ping (crisp retro arcade tone)
        dur = 0.18
        t = np.linspace(0, dur, int(SAMPLE_RATE * dur), False)
        ping_wave = (np.sin(2 * np.pi * 880 * t) * 0.6 +
                     np.sin(2 * np.pi * 1320 * t) * 0.4) * np.exp(-t * 22.0)
        self.bumper_sound = self._make_sound(ping_wave * 0.5)

        # 4. Explosion rumble
        dur = 0.6
        n_samples = int(SAMPLE_RATE * dur)
        t = np.linspace(0, dur, n_samples, False)
        noise = np.random.uniform(-1, 1, n_samples)
        # Apply moving average filter for low rumble
        kernel_size = 25
        kernel = np.ones(kernel_size) / kernel_size
        smooth_noise = np.convolve(noise, kernel, mode='same')
        sub_boom = np.sin(2 * np.pi * np.linspace(90, 25, n_samples) * t) * 0.7
        decay = np.exp(-t * 6.5)
        boom = (smooth_noise * 1.2 + sub_boom) * decay * 0.7
        self.explosion_sound = self._make_sound(boom)

        # 5. Shockwave blast
        dur = 0.35
        n_samples = int(SAMPLE_RATE * dur)
        t = np.linspace(0, dur, n_samples, False)
        punch = np.sin(2 * np.pi * np.linspace(140, 35, n_samples) * t) * np.exp(-t * 9.0)
        self.shockwave_sound = self._make_sound(punch * 0.6)

        # 6. Portal teleport warp
        dur = 0.28
        t = np.linspace(0, dur, int(SAMPLE_RATE * dur), False)
        warp = (np.sin(2 * np.pi * 440 * (1 + 0.3 * np.sin(2 * np.pi * 20 * t)) * t) * 0.5 +
                np.sin(2 * np.pi * 660 * t) * 0.3) * np.exp(-t * 10.0)
        self.portal_sound = self._make_sound(warp * 0.4)

    def play_bounce(self, velocity):
        if not self.enabled:
            return
        speed = min(abs(velocity), 1000.0)
        if speed < 40:
            return
        idx = int((speed / 1000.0) * (len(self.chimes) - 1))
        idx = max(0, min(idx, len(self.chimes) - 1))
        vol = max(0.1, min(1.0, speed / 600.0))
        sound = self.chimes[idx]
        sound.set_volume(vol)
        sound.play()

    def play_squish(self, intensity=0.5):
        if not self.enabled:
            return
        self.squish_sound.set_volume(max(0.1, min(1.0, intensity)))
        self.squish_sound.play()

    def play_bumper(self):
        if not self.enabled:
            return
        self.bumper_sound.play()

    def play_explosion(self):
        if not self.enabled:
            return
        self.explosion_sound.play()

    def play_shockwave(self):
        if not self.enabled:
            return
        self.shockwave_sound.play()

    def play_portal(self):
        if not self.enabled:
            return
        self.portal_sound.play()

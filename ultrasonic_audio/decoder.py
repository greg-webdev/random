"""
Ultrasonic Data Decoder.

This script reads an audio file containing encoded ultrasonic tones
and attempts to decode the original text string.

Usage:
python decoder.py <input_filename.wav>
"""

import numpy as np
import scipy.io.wavfile as wavfile
import sys

# --- Configuration ---
SAMPLE_RATE = 44100
TONE_DURATION = 0.05
GAP_DURATION = 0.02
# Minimum required energy (normalized amplitude) to consider a tone valid
MIN_ENERGY_THRESHOLD = 0.005 

# The frequency map must be the inverse of the encoder's map for decoding.
DECODE_MAP = {
    18000: 'A', 18010: 'a',
    18020: 'B', 18030: 'b',
    18040: 'C', 18050: 'c',
    18060: 'D', 18070: 'd',
    18080: 'E', 18090: 'e',
    18100: 'F', 18110: 'f',
    18120: 'G', 18130: 'g',
    18140: 'H', 18150: 'h',
    18160: 'I', 18170: 'i',
    18180: 'J', 18190: 'j',
    18200: 'K', 18210: 'k',
    18220: 'L', 18230: 'l',
    18240: 'M', 18250: 'm',
    18260: 'N', 18270: 'n',
    18280: 'O', 18290: 'o',
    18300: 'P', 18310: 'p',
    18320: 'Q', 18330: 'q',
    18340: 'R', 18350: 'r',
    18360: 'S', 18370: 's',
    18380: 'T', 18390: 't',
    18400: 'U', 18410: 'u',
    18420: 'V', 18430: 'v',
    18440: 'W', 18450: 'w',
    18460: 'X', 18470: 'x',
    18480: 'Y', 18490: 'y',
    18500: 'Z', 18510: 'z',
    18520: ' ', # Space carrier frequency
    18600: '0', 18610: '1', 18620: '2', 18630: '3', 18640: '4',
    18650: '5', 18660: '6', 18670: '7', 18680: '8', 18690: '9'
}

def detect_peak_frequency(audio_segment: np.ndarray, sample_rate: int) -> float | None:
    """
    Analyzes the segment by calculating the energy for every known frequency 
    and selecting the one with the highest energy above a threshold.
    """
    best_frequency = None
    max_energy = 0.0
    
    # Iterate through all known frequencies in the map
    for freq in DECODE_MAP.keys():
        # Generate a pure sine wave at the test frequency, matching the segment length
        t = np.linspace(0., TONE_DURATION, len(audio_segment), False)
        test_signal = np.sin(2. * np.pi * freq * t)
        
        # Calculate the correlation/energy between the segment and the pure tone
        # We use the dot product (correlation) as a measure of match strength.
        energy = np.sum(np.abs(audio_segment) * np.abs(test_signal))
        
        if energy > max_energy and energy > MIN_ENERGY_THRESHOLD:
            max_energy = energy
            best_frequency = float(freq)
            
    return best_frequency

def decode_audio_to_text(audio_path: str):
    """
    Reads the audio file, segments it, and decodes the frequency sequence.
    """
    try:
        # Read the WAV file
        sample_rate, audio_data = wavfile.read(audio_path)
    except FileNotFoundError:
        print("Error: File not found at " + audio_path)
        return
    except Exception as e:
        print("Error reading audio file: " + str(e))
        return

    # Normalize the audio data to float32 for consistent processing
    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)
    
    # Normalize amplitude to prevent clipping/underflow issues
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        audio_data = audio_data / max_val
    
    print("--- Decoding Audio (" + str(sample_rate) + " Hz) ---")
    
    decoded_characters = []
    current_index = 0
    
    while current_index < len(audio_data):
        # 1. Attempt to detect a tone starting at current_index
        # We analyze a window slightly larger than the tone duration to capture the peak.
        analysis_window_size = int((TONE_DURATION + GAP_DURATION) * sample_rate)
        
        if current_index + analysis_window_size > len(audio_data):
            break # Not enough data left for a full cycle
        
        segment = audio_data[current_index : current_index + analysis_window_size]
        
        # 2. Analyze the segment for a peak frequency
        peak_freq = detect_peak_frequency(segment, sample_rate)
        
        if peak_freq:
            # 3. Map frequency back to character
            decoded_char = None
            for freq, char in DECODE_MAP.items():
                if abs(peak_freq - float(f"{int(freq)}")) < 50:
                    decoded_char = char
                    break
            
            if decoded_char:
                decoded_characters.append(decoded_char)
            else:
                decoded_characters.append("[UNKNOWN]")
            
            # Advance the index by the full cycle length (Tone + Gap)
            current_index += int((TONE_DURATION + GAP_DURATION) * sample_rate)
        else:
            # If no tone is detected, we assume we are in a gap or noise.
            # We advance by a small fraction of the gap duration to prevent infinite loops.
            current_index += int(GAP_DURATION * sample_rate * 0.8)

    # 4. Output result
    result_text = "".join(decoded_characters)
    print("\n=========================================")
    print("Decoding Complete.")
    print("   Decoded Text: '" + result_text + "'")
    print("=========================================")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python decoder.py <input_filename.wav>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    decode_audio_to_text(input_file)
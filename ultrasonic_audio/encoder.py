"""
Ultrasonic Data Encoder.

This script encodes a text string into a sequence of high-frequency audio tones
(18-20 kHz) and saves it to an audio file.

Usage:
python encoder.py <text_string> <output_filename.wav>
"""

import numpy as np
import scipy.io.wavfile as wavfile
import sys

# --- Configuration ---
SAMPLE_RATE = 44100  # Standard sample rate
FREQUENCY_RANGE = (18000, 20000) # Target ultrasonic frequency range
TONE_DURATION = 0.05 # Duration of a single tone (seconds)
GAP_DURATION = 0.02 # Gap between tones (seconds)

def text_to_frequency_sequence(text: str) -> list[float]:
    """
    Converts a text string into a sequence of representative frequencies.
    
    Uses a comprehensive, unique frequency mapping for all alphanumeric characters 
    and space within the 18-20 kHz range.
    """
    frequency_map = {
        'A': 18000, 'a': 18010,
        'B': 18020, 'b': 18030,
        'C': 18040, 'c': 18050,
        'D': 18060, 'd': 18070,
        'E': 18080, 'e': 18090,
        'F': 18100, 'f': 18110,
        'G': 18120, 'g': 18130,
        'H': 18140, 'h': 18150,
        'I': 18160, 'i': 18170,
        'J': 18180, 'j': 18190,
        'K': 18200, 'k': 18210,
        'L': 18220, 'l': 18230,
        'M': 18240, 'm': 18250,
        'N': 18260, 'n': 18270,
        'O': 18280, 'o': 18290,
        'P': 18300, 'p': 18310,
        'Q': 18320, 'q': 18330,
        'R': 18340, 'r': 18350,
        'S': 18360, 's': 18370,
        'T': 18380, 't': 18390,
        'U': 18400, 'u': 18410,
        'V': 18420, 'v': 18430,
        'W': 18440, 'w': 18450,
        'X': 18460, 'x': 18470,
        'Y': 18480, 'y': 18490,
        'Z': 18500, 'z': 18510,
        ' ': 18520, # Space carrier frequency
        '0': 18600, '1': 18610, '2': 18620, '3': 18630, '4': 18640,
        '5': 18650, '6': 18660, '7': 18670, '8': 18680, '9': 18690
    }
    
    frequencies = []
    for char in text:
        freq = frequency_map.get(char)
        if freq:
            frequencies.append(freq)
        else:
            # Handle unknown characters by skipping or using a default
            print(f"Warning: Character '{char}' not mapped. Skipping.")
            pass
            
    return frequencies

def generate_tone(frequency: float, duration: float, sample_rate: int) -> np.ndarray:
    """Generates a sine wave tone."""
    t = np.linspace(0., duration, int(sample_rate * duration), False)
    amplitude = 1.0
    audio = amplitude * np.sin(2. * np.pi * frequency * t)
    return audio

def encode_text_to_audio(text: str, output_path: str):
    """
    Encodes the text and saves the resulting audio data.
    """
    if not text:
        print("Error: Input text cannot be empty.")
        return

    print(f"Encoding text: '{text}'...")
    
    # 1. Get frequency sequence
    frequencies = text_to_frequency_sequence(text)
    
    if not frequencies:
        print("Error: Could not generate any frequencies. Check mapping.")
        return

    # 2. Generate audio segments
    audio_segments = []
    for freq in frequencies:
        # Generate the tone
        tone = generate_tone(freq, TONE_DURATION, SAMPLE_RATE)
        audio_segments.append(tone)
        
        # Add a gap (silence)
        silence = np.zeros(int(SAMPLE_RATE * GAP_DURATION))
        audio_segments.append(silence)

    # 3. Concatenate all segments
    full_audio = np.concatenate(audio_segments)

    # 4. Save the file
    try:
        wavfile.write(output_path, SAMPLE_RATE, full_audio.astype(np.float32))
        print("\n[SUCCESS] Audio encoded and saved to " + output_path)
        print("Remember to play this file through speakers to hear the ultrasonic tones.")
    except Exception as e:
        print(f"\n[ERROR] Error saving file: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python encoder.py <text_string> <output_filename.wav>")
        sys.exit(1)
    
    input_text = sys.argv[1]
    output_file = sys.argv[2]
    
    encode_text_to_audio(input_text, output_file)
# Ultrasonic Data Encoder/Decoder

This project allows encoding small text strings into high-frequency audio tones (18–20 kHz) and provides a script to decode them.

## 🚀 Overview

1.  **Encoding:** `encoder.py` takes a text string and saves it as a `.wav` file containing ultrasonic tones.
2.  **Decoding:** `decoder.py` reads the `.wav` file, analyzes the frequency spectrum, and attempts to reconstruct the original text.

## 🛠️ Setup and Usage

### Prerequisites
*   Python 3.x
*   Required libraries: `numpy`, `scipy`

### Installation
Install dependencies:
```bash
pip install numpy scipy
```

### 1. Encoding Text
Use `encoder.py` to convert text into an audio file.

**Syntax:**
```bash
python encoder.py "<TEXT_STRING>" <OUTPUT_FILENAME.wav>
```

**Example:**
```bash
python encoder.py "Hello World" encoded_message.wav
```
*Note: The tones are in the ultrasonic range (18-20 kHz) and may not be audible on standard speakers. Use headphones or a specialized speaker setup.*

### 2. Decoding Audio
Use `decoder.py` to read the generated audio file and decode the message.

**Syntax:**
```bash
python decoder.py <INPUT_FILENAME.wav>
```

## 🧪 Testing

To test the full cycle:
1.  Run the encoding command.
2.  Run the decoding command using the output file from step 1.

---
*Disclaimer: The encoding/decoding scheme uses a simplified character-to-frequency mapping for demonstration purposes. A production system would require a much more robust and collision-free encoding scheme.*
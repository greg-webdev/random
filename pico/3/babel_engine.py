"""
Library of Babel Algorithmic Engine
Deterministic, reversible generator for the universal library.
Compatible with Python 3 and CircuitPython.
"""

import sys

# The Borges-expanded alphabet: space, 26 lowercase letters, digits 0-9, common punctuation
ALPHABET = " abcdefghijklmnopqrstuvwxyz0123456789,.-!?"
ALPHABET_LEN = len(ALPHABET)  # 42
CHAR_TO_IDX = {c: i for i, c in enumerate(ALPHABET)}

LINES_PER_PAGE = 40
CHARS_PER_LINE = 80
CHARS_PER_PAGE = LINES_PER_PAGE * CHARS_PER_LINE  # 3200

# Constants for coordinate bounds
WALLS = 4
SHELVES = 5
VOLUMES = 32
PAGES = 410

# Base-36 characters for Hexagon addresses
BASE36_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz"
BASE36_MAP = {c: i for i, c in enumerate(BASE36_CHARS)}

# Large primes for fast LCG / PRNG diffusion
A = 6364136223846793005
C = 1442695040888963407
CIPHER_KEY = 0x5A827999BEEFCAFE


def clean_text(text):
    """Normalize input text to only valid alphabet characters in lowercase."""
    res = []
    for ch in str(text).lower():
        if ch in CHAR_TO_IDX:
            res.append(ch)
        elif ch in "\r\n\t":
            res.append(" ")
        else:
            res.append(" ")
    cleaned = "".join(res)
    return cleaned if cleaned else " "


def int_to_base36(n):
    """Convert integer to base-36 string."""
    if n == 0:
        return "0"
    digits = []
    num = abs(n)
    while num:
        digits.append(BASE36_CHARS[num % 36])
        num //= 36
    return "".join(reversed(digits))


def base36_to_int(s):
    """Convert base-36 string to integer."""
    s = str(s).strip().lower()
    val = 0
    for ch in s:
        if ch in BASE36_MAP:
            val = val * 36 + BASE36_MAP[ch]
        else:
            val = val * 36 + (ord(ch) % 36)
    return val


def compute_page_seed(hexagon, wall, shelf, volume, page):
    """
    Compute a unique 64-bit seed from the coordinate tuple.
    """
    h_int = base36_to_int(hexagon)
    packed = (
        ((h_int & 0xFFFFFFFFFFFF) << 20)
        ^ (((wall - 1) & 0x3) << 18)
        ^ (((shelf - 1) & 0x7) << 15)
        ^ (((volume - 1) & 0x1F) << 10)
        ^ ((page - 1) & 0x1FF)
    )
    # 64-bit LCG diffusion
    seed = (packed * A + C) & 0xFFFFFFFFFFFFFFFF
    seed ^= (seed >> 21)
    seed = (seed * A + C) & 0xFFFFFFFFFFFFFFFF
    seed ^= (seed >> 35)
    return seed


def generate_char_at(seed, index):
    """
    Generate the character at page index [0..3199] using fast splitmix64 step.
    """
    z = (seed + index * 0x9E3779B97F4A7C15) & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9 & 0xFFFFFFFFFFFFFFFF
    z = (z ^ (z >> 27)) * 0x94D049BB133111EB & 0xFFFFFFFFFFFFFFFF
    z = z ^ (z >> 31)
    return ALPHABET[z % ALPHABET_LEN]


def encode_payload(text, wall, shelf, volume, page, offset):
    """
    Encodes text and coordinate offset into a reversible base-36 Hexagon string.
    Format:
      (header << (t_len * 6)) | text_num
      then shifted by 8 bits with t_len stored in the lowest 8 bits for O(1) decode.
    """
    cleaned = clean_text(text)
    if len(cleaned) > 200:
        cleaned = cleaned[:200]
    t_len = len(cleaned)

    header = (
        (0xBA << 43)
        | (((wall - 1) & 0x3) << 41)
        | (((shelf - 1) & 0x7) << 38)
        | (((volume - 1) & 0x1F) << 33)
        | (((page - 1) & 0x1FF) << 24)
        | ((offset & 0xFFF) << 12)
        | (t_len & 0xFFF)
    )

    # Encode text into big integer
    text_num = 0
    for ch in cleaned:
        text_num = text_num * ALPHABET_LEN + CHAR_TO_IDX[ch]

    # Combine: (header << (t_len * 6)) | text_num
    core = (header << (t_len * 6)) | text_num
    # Place t_len in lowest 8 bits for instant O(1) decode on RP2040
    combined = (core << 8) | (t_len & 0xFF)
    combined ^= CIPHER_KEY
    return int_to_base36(combined)


def try_decode_payload(hexagon, wall, shelf, volume, page):
    """
    O(1) instant payload decoder for RP2040 CircuitPython and browser JS.
    """
    try:
        combined = base36_to_int(hexagon) ^ CIPHER_KEY
        t_len = combined & 0xFF
        if t_len == 0 or t_len > 200:
            return (None, 0)

        core = combined >> 8
        shift = t_len * 6
        hdr = core >> shift
        if (hdr >> 43) != 0xBA:
            return (None, 0)

        h_wall = ((hdr >> 41) & 0x3) + 1
        h_shelf = ((hdr >> 38) & 0x7) + 1
        h_vol = ((hdr >> 33) & 0x1F) + 1
        h_page = ((hdr >> 24) & 0x1FF) + 1
        h_offset = (hdr >> 12) & 0xFFF
        declared_len = hdr & 0xFFF

        if (
            h_wall == wall
            and h_shelf == shelf
            and h_vol == volume
            and h_page == page
            and declared_len == t_len
            and h_offset + declared_len <= CHARS_PER_PAGE
        ):
            mask = (1 << shift) - 1
            t_num = core & mask
            chars = []
            curr = t_num
            for _ in range(declared_len):
                chars.append(ALPHABET[curr % ALPHABET_LEN])
                curr //= ALPHABET_LEN
            return ("".join(reversed(chars)), h_offset)
    except Exception:
        pass
    return (None, 0)


def generate_line(hexagon, wall, shelf, volume, page, line_idx):
    """
    Generate a single 80-character line (0 <= line_idx < 40) for fast streaming on RP2040.
    """
    seed = compute_page_seed(hexagon, wall, shelf, volume, page)
    start = line_idx * CHARS_PER_LINE
    chars = [generate_char_at(seed, start + i) for i in range(CHARS_PER_LINE)]

    embedded_text, offset = try_decode_payload(hexagon, wall, shelf, volume, page)
    if embedded_text:
        e_len = len(embedded_text)
        e_start = offset
        e_end = offset + e_len
        line_start = start
        line_end = start + CHARS_PER_LINE

        # Check overlap
        o_start = max(line_start, e_start)
        o_end = min(line_end, e_end)
        if o_start < o_end:
            for pos in range(o_start, o_end):
                chars[pos - line_start] = embedded_text[pos - e_start]

    return "".join(chars)


def generate_page(hexagon, wall, shelf, volume, page, line_wrap=True):
    """
    Generate all 3,200 characters for the requested page.
    Deterministically blends universal pseudo-random noise with any embedded text.
    """
    lines = [generate_line(hexagon, wall, shelf, volume, page, i) for i in range(LINES_PER_PAGE)]
    if line_wrap:
        return "\n".join(lines)
    return "".join(lines)


def search_text(query):
    """
    Invertible Search:
    Given any string query, computes the exact coordinate (Hexagon, Wall, Shelf, Volume, Page, Offset)
    where this query is GUARANTEED to exist.
    """
    cleaned = clean_text(query)
    if len(cleaned) > 200:
        cleaned = cleaned[:200]

    # Deterministic coordinate selection
    h = 5381
    for ch in cleaned:
        h = (((h << 5) + h) + ord(ch)) & 0xFFFFFFFFFFFFFFFF

    wall = (h % WALLS) + 1
    shelf = ((h >> 3) % SHELVES) + 1
    vol = ((h >> 6) % VOLUMES) + 1
    page = ((h >> 11) % PAGES) + 1

    max_offset = CHARS_PER_PAGE - len(cleaned)
    offset = (h >> 16) % (max_offset + 1) if max_offset > 0 else 0

    hexagon = encode_payload(cleaned, wall, shelf, vol, page, offset)

    return {
        "hexagon": hexagon,
        "wall": wall,
        "shelf": shelf,
        "volume": vol,
        "page": page,
        "offset": offset,
        "length": len(cleaned),
        "query": cleaned,
    }

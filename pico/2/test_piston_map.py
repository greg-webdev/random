PISTON_DATA = {
    'sticky': {
        'down':  (2046, 2040, 2092, (0, -1, 0)),
        'up':    (2045, 2039, 2088, (0, 1, 0)),
        'north': (2041, 2035, 2072, (0, 0, -1)),
        'south': (2043, 2037, 2080, (0, 0, 1)),
        'west':  (2044, 2038, 2084, (-1, 0, 0)),
        'east':  (2042, 2036, 2076, (1, 0, 0)),
    },
    'normal': {
        'down':  (2068, 2062, 2091, (0, -1, 0)),
        'up':    (2067, 2061, 2087, (0, 1, 0)),
        'north': (2063, 2057, 2071, (0, 0, -1)),
        'south': (2065, 2059, 2079, (0, 0, 1)),
        'west':  (2066, 2060, 2083, (-1, 0, 0)),
        'east':  (2064, 2058, 2075, (1, 0, 0)),
    }
}

# Reverse lookup from any piston block state ID to (type, facing, is_extended)
STATE_TO_PISTON = {}
for p_type, facings in PISTON_DATA.items():
    for facing, (unext, ext, head, offset) in facings.items():
        STATE_TO_PISTON[unext] = (p_type, facing, False, ext, head, offset)
        STATE_TO_PISTON[ext]   = (p_type, facing, True,  unext, head, offset)

print("STATE_TO_PISTON entries:", len(STATE_TO_PISTON))
print("Sticky Up unextended (2045):", STATE_TO_PISTON.get(2045))
print("Sticky Up extended (2039):", STATE_TO_PISTON.get(2039))

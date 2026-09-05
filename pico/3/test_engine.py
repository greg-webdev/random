import sys
import babel_engine as be

queries = [
    "antigravity pi pico 2020 connected",
    "hello world!",
    "to be or not to be, that is the question.",
    "the library of babel is infinite"
]

print("Running Babel Engine verification tests...")

for q in queries:
    res = be.search_text(q)
    print(f"\nSearching: '{q}'")
    print(f"Hexagon: {res['hexagon']}")
    print(f"Location: Wall {res['wall']}, Shelf {res['shelf']}, Vol {res['volume']}, Page {res['page']}, Offset {res['offset']}")
    
    page = be.generate_page(res['hexagon'], res['wall'], res['shelf'], res['volume'], res['page'], line_wrap=False)
    idx = page.find(res['query'])
    assert idx == res['offset'], f"Failed: found at {idx}, expected {res['offset']}"
    
    start = max(0, idx - 15)
    end = min(len(page), idx + len(res['query']) + 15)
    print(f"Excerpt: ...{page[start:end]}...")
    print("MATCH VERIFIED!")

# Test purely pseudo-random coordinates
print("\nTesting raw coordinate (Hexagon: '0', W: 1, S: 1, V: 1, P: 1)...")
raw_page = be.generate_page("0", 1, 1, 1, 1, line_wrap=True)
print("Line 1:", raw_page.split("\n")[0])
print(f"Total lines: {len(raw_page.split('\n'))}, chars: {len(raw_page.replace('\n', ''))}")
print("All tests passed successfully!")

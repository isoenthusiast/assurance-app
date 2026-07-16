"""Count braces in a file to find mismatches."""
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else "src/app/api/convert/route.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines, 1):
    for ch in line:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
    # Don't print every line, just track depth
    if '{' in line or '}' in line:
        print(f"L{i:4d} depth={depth:3d} | {line.rstrip()[:100]}")

print(f"\nFinal depth: {depth} (should be 0)")

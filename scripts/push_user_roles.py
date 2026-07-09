"""Push updated UserRole / UserRoleMapping schema to PostgreSQL."""
import subprocess, sys, os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "db", "push", "--accept-data-loss"],
    capture_output=True, text=True, timeout=120
)

print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:2000])
print(f"EXIT CODE: {result.returncode}")

if result.returncode != 0:
    sys.exit(result.returncode)

# Also regenerate prisma client
result2 = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result2.stdout)

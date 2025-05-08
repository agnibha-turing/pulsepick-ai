#!/usr/bin/env python3
import os
import sys
import subprocess

# Print the current working directory for debugging
current_dir = os.getcwd()
print(f"Current working directory: {current_dir}")

# Add the backend directory to Python path
sys.path.insert(0, current_dir)

# Set the PYTHONPATH environment variable
os.environ['PYTHONPATH'] = current_dir

print("Python path:", sys.path)

try:
    # Try importing to make sure it works
    import app.core.config
    print("Successfully imported app.core.config")
except ImportError as e:
    print(f"Import error: {e}")

# Now run the alembic migration
print("Running alembic migration...")
result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print(f"Return code: {result.returncode}")

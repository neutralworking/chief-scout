"""Shared fixtures for pipeline tests."""
import sys
from pathlib import Path

# Add pipeline dir to path so we can import scripts
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

"""
Centralised configuration — loads credentials from .env file or environment.

Usage:
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, POSTGRES_DSN
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Load .env from repo root
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists() and load_dotenv:
    load_dotenv(_env_path)
elif _env_path.with_suffix(".local").exists() and load_dotenv:
    load_dotenv(_env_path.with_suffix(".local"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
POSTGRES_DSN = os.environ.get("POSTGRES_DSN", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Common paths
REPO_ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = REPO_ROOT / "pipeline"
CACHE_DIR = PIPELINE_DIR / ".cache"
IMPORTS_DIR = REPO_ROOT / "imports"
VAULT_DIR = REPO_ROOT / "docs" / "research" / "rsg.db" / "main"

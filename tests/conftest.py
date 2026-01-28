"""pytest configuration and fixtures"""
import os
import sys
from pathlib import Path

import pytest

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture
def project_root():
    """Return the project root directory"""
    return PROJECT_ROOT


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing"""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test_key")
    monkeypatch.setenv("DART_API_KEY", "test_dart_key")
    monkeypatch.setenv("GROQ_API_KEY", "test_groq_key")

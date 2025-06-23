"""Constants for the application."""

from pathlib import Path

DEFAULT_CONFIG_ROOT = Path(__file__).parent / "config"
BASE_CONFIG_PATH = DEFAULT_CONFIG_ROOT / "base.yml"
LOCAL_CONFIG_PATH = DEFAULT_CONFIG_ROOT / "local.yml"


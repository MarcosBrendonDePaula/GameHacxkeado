"""
Utils package for game modification tools
"""

from .find_autocast_delays import AutoCastDelayFinder
from .find_durability_lines import DurabilityLineFinder
from .auto_pause_system import AutoPauseSystemGenerator

__version__ = "1.0.0"
__author__ = "Game Analyzer"

__all__ = [
    "AutoCastDelayFinder",
    "DurabilityLineFinder",
    "AutoPauseSystemGenerator"
]
import logging
import sys
from datetime import datetime

from app.core.config import settings


class CustomFormatter(logging.Formatter):
    """Custom formatter with colors and structured format"""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
        "ENDC": "\033[0m",  # End color
    }

    def format(self, record):
        # Add timestamp
        record.timestamp = datetime.now().isoformat()

        # Add color for console output
        if hasattr(record, "levelname"):
            color = self.COLORS.get(record.levelname, "")
            record.colored_levelname = f"{color}{record.levelname}{self.COLORS['ENDC']}"

        return super().format(record)


def setup_logging():
    """Setup centralized logging configuration"""

    # Create formatters
    detailed_formatter = CustomFormatter(
        fmt=" | ".join(
            [
                "%(timestamp)s",
                "%(colored_levelname)-8s",
                "%(name)s:%(lineno)d",
                "%(message)s",
            ]
        )
    )

    simple_formatter = CustomFormatter(
        fmt="%(timestamp)s | %(levelname)-8s | %(message)s"
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(
        detailed_formatter if settings.debug else simple_formatter
    )

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # Clear existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Add our handler
    root_logger.addHandler(console_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("docker").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name"""
    return logging.getLogger(name)

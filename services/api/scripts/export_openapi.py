from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.main import app


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the API's deterministic OpenAPI schema.")
    parser.add_argument("--output", type=Path, default=API_ROOT / "openapi.json")
    output = parser.parse_args().output
    output.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_cli_smoke() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "src/main.py"],
        input="Add milk to my shopping list\nyes\nquit\n",
        text=True,
        capture_output=True,
        cwd=repo_root,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "CORTEX: Please confirm: shopping_list_tool with {'item': 'milk'}" in result.stdout
    assert "CORTEX: Added 'milk' to your shopping list." in result.stdout


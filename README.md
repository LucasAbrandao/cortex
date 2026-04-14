# CORTEX

CORTEX is a local-first conversational assistant built with strict Spec-Driven Development (SDD). The current MVP state includes deterministic orchestrator flows, recipe and shopping-list tools, confirmation handling, a CLI runtime, and a FastAPI web scaffold.

## Interfaces

- CLI (active): terminal conversation through `src/main.py`
- Web (FastAPI scaffold): local `GET /` + `POST /chat` adapter surface

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run

CLI:

```powershell
python src/main.py
```

Web:

```powershell
uvicorn src.main:app --reload
```

## Tests

```powershell
python -m pytest
python -m pytest tests/unit
python -m pytest tests/integration
```

## Spec System

- `prompt.md`: master specification and project rules
- `docs/architecture.md`: stable architecture and contracts
- `docs/checkpoint.md`: current status snapshot
- `docs/currentTask.md`: only active implementation scope

## Project Structure

```text
cortex/
|- docs/              # architecture, checkpoint, current task
|- src/               # interfaces, orchestrator, tools, llm, memory, schemas
|- tests/             # unit, integration, conversation tests
|- prompt.md          # master spec
|- AGENTS.md          # SDD operating rules
|- README.md          # setup/run/test + project orientation
|- requirements.txt   # pinned dependencies
```

# Checkpoint - JARVIS

## Last updated
2026-04-14 (America/Sao_Paulo)

## Project phase
Phase 1 - MVP Core

---

## Task status
- [x] T01 completed
- [x] T02 completed
- [x] T03 completed
- [x] T04 completed
- [x] T05 completed
- [x] T06 completed
- [x] T07 completed
- [x] T08 completed
- [x] T09 completed
- [x] T10A completed (repository cleanup and git prep)
- [ ] T10 current (active task resumed)

## Current sprint goal
Deliver **T10 - Error and Observability Hardening**.

---

## What is working right now
- Master spec and core project docs are in place and aligned (`prompt.md`, `AGENTS.md`, `docs/architecture.md`)
- Repository essentials exist: `README.md`, `.env.example`, `.gitignore`, `requirements.txt`
- `src/main.py` boots configuration, FastAPI scaffold, and CLI-orchestrator runtime wiring
- Shared contracts exist in `src/schemas.py` for input/output and orchestrator scaffold structures
- Tool discovery contract is implemented in `src/tools/registry.py`
- MVP tools are implemented and deterministic:
  - `src/tools/recipe_tool.py` provides local recipe suggestions from ingredient inputs
  - `src/tools/shopping_list_tool.py` provides in-memory shopping add/list behavior
- Startup registry wiring now registers MVP tools in `src/main.py` through `ToolRegistry`
- LLM abstraction is implemented in `src/llm/adapters/base.py`, `src/llm/adapters/ollama.py`, and `src/llm/adapters/mock.py`
- In-memory session state scaffold is implemented in `src/memory/session.py`
- Orchestrator now includes deterministic T04 scaffolding in `src/orchestrator/pipeline.py`:
  - rule-based tool match before LLM fallback
  - deterministic parameter extraction hooks for simple patterns
  - deterministic missing-parameter re-prompt behavior
  - multi-turn `collected_params` reuse and accumulation
- Orchestrator confirmation handling is now hardened for T05:
  - explicit `yes` deterministically executes pending executable actions
  - explicit `no` deterministically cancels and clears pending state
  - unresolved replies deterministically re-prompt without starting new executable flows
- Unit and integration test suites for completed tasks are passing with `pytest.ini` constrained to `tests/`
- T06 coverage is in place:
  - `tests/unit/test_recipe_tool.py`
  - `tests/unit/test_shopping_list_tool.py`
  - `tests/integration/test_orchestrator_pipeline.py` (recipe flow + shopping add confirmation flow)
- T07 runtime wiring is complete:
  - `src/interface/cli.py` now normalizes CLI input, sends `InputMessage` into `OrchestratorPipeline`, renders `OutputMessage.text`, and preserves a single runtime session across turns
  - `src/main.py` now composes startup dependencies (`ToolRegistry`, `SessionMemoryStore`, LLM client, `OrchestratorPipeline`) in a minimal composition root
  - `tests/integration/test_cli_smoke.py` now validates CLI -> orchestrator -> confirmation -> tool execution for shopping add flow
- T08 conversation script coverage is complete:
  - `tests/conversation/test_mvp_conversation_scripts.py` now validates the 4-turn MVP recipe script, including confirmation and final executable completion
  - `tests/conversation/test_mvp_conversation_scripts.py` now validates executable cancel flow (`no`) with deterministic pending-confirmation clearing
- T09 web scaffold is complete:
  - `src/interface/web.py` now provides a minimal adapter-only FastAPI web surface with:
    - `GET /` server-rendered HTML form for local input
    - `POST /chat` HTTP form normalization into `InputMessage`
    - orchestrator invocation through `OrchestratorPipeline`
    - HTML rendering from `OutputMessage` contract fields (`text`, `status`, `session_id`, `confirmation_id`)
  - `src/main.py` now wires the web adapter in the startup composition root without moving tool or confirmation logic into interface code
  - `tests/integration/test_web_smoke.py` now covers GET scaffold, POST response rendering, and multi-turn confirmation continuity (`Add milk` -> `yes`) using one in-memory runtime session
- T10A repository hygiene/doc alignment is complete:
  - `.gitignore` now contains the required minimal local/transient patterns only
  - `README.md` now reflects current interfaces (CLI + web scaffold), setup/run/test instructions, spec documents, and concise structure
  - Removed artifacts with normal deletion (no ACL/ownership escalation): `docs/.venv`, root `.venv`, non-venv `__pycache__`, non-venv `*.pyc`, `.pytest_cache`, and root `pytest-cache-files-*`
  - Locked/unremovable artifacts during cleanup: none (`Access is denied` was not encountered during removal attempts)
  - Audit files (`project_root_listing.txt`, `project_tree_filtered.txt`, `project_tree_full.txt`, `suspicious_artifacts.txt`) were intentionally kept because they are explicit inspection outputs and were referenced during task review
  - Full test suite passed before root `.venv` removal via `.\.venv\Scripts\python.exe -m pytest` (34 passed)

## What is not implemented yet
- Persistent storage
- Alexa adapter
- Full observability/error-contract hardening in orchestrator runtime paths

---

## Risks / notes
- Keep strict Spec-Driven Development flow: implement only active `docs/currentTask.md` scope
- Keep deterministic decision boundaries in orchestrator code
- Keep LLM usage behind the shared client abstraction only
- Root virtual environment was intentionally removed as part of T10A cleanup; recreate `.venv` before local runtime/test execution in future sessions

## Next
Execute T10 exactly as defined in `docs/currentTask.md`.

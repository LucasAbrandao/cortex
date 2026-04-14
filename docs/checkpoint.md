# Checkpoint - CORTEX

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
- [ ] T10 paused (Error and Observability Hardening)
- [x] T11 completed (root reorganization + global rename + git bootstrap)
- [ ] T12 current (active task)

## Current sprint goal
Deliver **T12 - Pipeline Validation and First End-to-End Functional Flow Hardening**.

---

## What changed in T11
- Global identity rename completed from legacy branding to `CORTEX` across code, docs, prompts, interfaces, and tests.
- Surface runtime branding is now configurable via `APP_NAME` with safe fallback to `CORTEX`.
- `.env.example` was standardized with core, LLM, and session variables (`ENV`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `SESSION_MAX_TURNS`).
- `.gitignore` was hardened to include local env files and transient artifacts (`.env.*`, logs, caches, db files, data directories).
- Root audit artifacts were removed:
  - `project_root_listing.txt`
  - `project_tree_filtered.txt`
  - `project_tree_full.txt`
  - `suspicious_artifacts.txt`
- Markdown/spec docs were normalized and aligned with the CORTEX identity.

## Why T10 is paused
T10 was paused because repository-level naming, configuration hygiene, and publication readiness were blocking reliable public versioning and branch workflow.

## What is working right now
- Master spec and project docs are aligned to CORTEX (`prompt.md`, `AGENTS.md`, `docs/architecture.md`).
- MVP runtime remains functional:
  - deterministic orchestrator pipeline
  - recipe and shopping-list tools
  - confirmation flow
  - CLI adapter and FastAPI web scaffold
- LLM abstraction remains behind adapters (`base`, `mock`, `ollama`).
- Session memory and orchestrator routing contracts remain unchanged.

## What is not implemented yet
- T10 error/observability hardening is still pending (paused)
- Persistent storage
- Alexa adapter

---

## Risks / notes
- Keep strict Spec-Driven Development flow: implement only active `docs/currentTask.md` scope.
- Keep deterministic boundaries in orchestrator decisions and confirmation handling.
- Keep all LLM usage behind the shared client abstraction.

## Next
Execute T12 exactly as defined in `docs/currentTask.md`.

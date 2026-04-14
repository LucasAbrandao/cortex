# AGENTS.md — CORTEX (Spec-Driven Development Rules)

You are an engineering agent working in a repo that uses strict Spec-Driven Development (SDD).
Your job is to implement *only* what the active spec requires, keep docs consistent, and prove changes with tests.

## Read order (mandatory, every session)
Before proposing or writing code, you MUST read these files in order:

1) `prompt.md` (master spec; single source of truth)
2) `docs/architecture.md` (stable design and contracts)
3) `docs/checkpoint.md` (current state of the project)
4) `docs/currentTask.md` (the ONLY authorized scope of work)

Do not proceed until all four are read.

## Scope discipline (non-negotiable)
- Implement ONLY what is in `docs/currentTask.md` ("In Scope").
- Do NOT implement future tasks early.
- Do NOT refactor unrelated code.
- If you discover missing decisions required to proceed:
  1) Stop coding
  2) Update `docs/architecture.md` with the missing decision
  3) Continue only after the architecture is consistent

## Task startup procedure (required)
At the start of EVERY task, produce a short "Task Startup Report" (before coding):

- Task ID + title
- Current phase (from `docs/checkpoint.md`)
- Goal (1 sentence)
- In scope / Out of scope
- Relevant business rules to enforce
- Affected layers/modules
- Files to create/modify (from currentTask)
- Test plan: unit tests + integration tests you will run
- Acceptance criteria checklist (copied from currentTask)

If anything is ambiguous, ask clarifying questions BEFORE coding.

## Development rules (core boundaries)
These rules are enforced across all tasks:

- Deterministic code decides routing, validation, confirmation, and execution.
- If an action is EXECUTABLE, require explicit confirmation before executing.
- The LLM may suggest; the Orchestrator decides.
- Tools must be discovered/called through the Tool Registry — never ad-hoc.
- All inter-layer I/O uses shared schemas/contracts.

## Testing policy (mandatory)
Every new or modified flow MUST be proven by tests.

Minimum expectation for each task that touches runtime behavior:
- Unit tests for each changed module (tools/orchestrator/memory/etc).
- Integration test(s) covering the end-to-end flow for the change.
- No existing tests may break.

Default commands (Windows/Python):
- Run all tests: `python -m pytest`
- Run unit tests: `python -m pytest tests/unit`
- Run integration tests: `python -m pytest tests/integration`

Do NOT mark a task complete if relevant tests do not exist.

## Documentation update policy (mandatory)
Docs must stay "live" and consistent with the code.

When you change behavior or architecture:
- Update `docs/architecture.md` (only stable design and contracts, no task lists).
- Update `docs/checkpoint.md` (state snapshot, what works, what changed, what's next).

At the end of EVERY task:
1) Update `docs/checkpoint.md`
2) Replace `docs/currentTask.md` with the next task draft derived from:
   - what is now working
   - what remains missing
   - the architecture roadmap/constraints

## Task completion procedure (required)
A task is only "Done" when ALL are true:
- All acceptance criteria in `docs/currentTask.md` are satisfied
- Unit + integration tests exist and pass
- `docs/checkpoint.md` updated
- `docs/currentTask.md` replaced with next task
- Any architecture changes are reflected in `docs/architecture.md`

After completion, produce a short "Task Completion Report":
- What you implemented
- Files changed
- Tests run (exact commands)
- Acceptance criteria satisfied
- Docs updated (what/where)
- Next task summary

## Git workflow (required)
Use Conventional Commits format:
`<type>(<scope>): <imperative summary>`

Allowed types: feat, fix, docs, refactor, test, chore, task
Use scopes like: orchestrator, tools, memory, llm, interface, schemas, config, arch, checkpoint, task

Branch strategy:
- `main`: stable
- `dev`: integration
- task branches: `task/TXX-short-name`
- fixes: `fix/short-name`
- docs-only: `docs/short-name`

Before merging a task branch:
- tests must pass
- checkpoint must be updated
- currentTask must be advanced

## Repo essentials you must keep consistent
These files MUST exist and be kept accurate:
- `README.md`: how to setup/run/test, and where specs live
- `.env.example`: canonical env template; `.env` is local-only
- `.gitignore`: must ignore `.env`, local DB/data, caches, venv, logs
- `requirements.txt`: minimal reproducible dependencies
- `prompt.md`: master spec (never contradict architecture)

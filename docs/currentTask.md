# Current Task - T10: Error and Observability Hardening

## Status
[ ] Not started

## Goal
Harden orchestrator runtime behavior so error responses and runtime events consistently follow the architecture contracts.

---

## Scope (In)
- Enforce orchestrator error output alignment with the shared error contract (`status=error`, `error_code`, `message`, `recoverable`)
- Add deterministic handling for tool/LLM runtime exceptions so user-facing responses are safe and consistent
- Add structured runtime event logging for core orchestrator pipeline events
- Add unit/integration coverage proving error wrapping and event emission paths

## Scope (Out)
- New tool business features
- Confirmation model redesign
- Persistence implementation
- Alexa work
- Finance/automation domains
- Frontend redesign

---

## Files to Create or Modify

```text
src/orchestrator/pipeline.py
tests/unit/test_pipeline.py
tests/integration/test_orchestrator_pipeline.py
```

---

## Acceptance Criteria

- [ ] Tool and LLM execution failures are converted into safe `OutputMessage(status="error")` responses
- [ ] Error responses include contract-aligned error data (`error_code`, `message`, `recoverable`)
- [ ] Required runtime events are emitted for the main orchestrator flow (minimum: input received, intent resolved, confirmation requested/resolved, tool executed, error raised, session updated)
- [ ] New unit tests cover deterministic error and logging behaviors
- [ ] Integration tests validate at least one end-to-end error path through the pipeline
- [ ] Existing unit/integration/conversation/web smoke tests do not regress
- [ ] `python -m pytest` passes

---

## Test Instructions

```powershell
python -m pytest tests/unit
python -m pytest tests/integration
python -m pytest
```

---

## Commit Message

```text
task(T10): harden orchestrator error contract and observability events
```
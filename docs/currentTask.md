# Current Task - T12: Pipeline Validation and Functional Flow Hardening

## Status
[ ] Not started

## Goal
Validate and harden the complete MVP pipeline for the first fully reliable functional flow (recipes + shopping list + confirmation) without introducing new business domains.

---

## Scope (In)
- Validate end-to-end orchestrator behavior for MVP scripted flows
- Strengthen deterministic handling for parameter carry-over and confirmation continuity
- Expand/adjust tests where needed to prove stable behavior across CLI and web adapter paths
- Ensure no regressions in existing MVP behavior

## Scope (Out)
- New business features or tools
- Architecture refactor or import restructuring
- Persistent storage implementation
- Alexa integration
- Finance/automation domains
- UI redesign

---

## Files to Create or Modify

```text
src/orchestrator/pipeline.py
tests/unit/test_pipeline.py
tests/integration/test_orchestrator_pipeline.py
tests/conversation/test_mvp_conversation_scripts.py
tests/integration/test_cli_smoke.py
tests/integration/test_web_smoke.py
```

---

## Acceptance Criteria

- [ ] Recipe -> follow-up -> shopping executable flow remains deterministic and reproducible
- [ ] Confirmation pending state is preserved and resolved correctly across turns
- [ ] Multi-turn parameter accumulation remains correct for MVP tools
- [ ] CLI and web integration paths produce equivalent flow outcomes
- [ ] New or adjusted unit/integration coverage proves hardened behavior
- [ ] Existing test suites do not regress
- [ ] `python -m pytest` passes

---

## Test Instructions

```powershell
python -m pytest tests/unit
python -m pytest tests/integration
python -m pytest tests/conversation
python -m pytest
```

---

## Commit Message

```text
task(T12): harden end-to-end mvp pipeline validation flows
```

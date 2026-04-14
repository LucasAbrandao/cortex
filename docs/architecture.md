# Architecture — CORTEX

## System overview
CORTEX is a local-first conversational assistant running on a Windows PC. The MVP interface is CLI.
The system is layered to keep business logic deterministic and testable while using an LLM only for interpretation and natural language output.

## Layer definitions

### Interface layer
Adapters: CLI (MVP), Web (Phase 2), Alexa (Phase 3 optional).
Responsibility: normalize incoming input into `InputMessage`, and render `OutputMessage` back to the user.

### Orchestrator layer
Single entrypoint for user requests. Owns:
- the 8-step pipeline
- session routing and state
- intent/tool resolution
- confirmation flow state machine

The orchestrator is the only layer allowed to decide tool routing.

### Tools layer
Tools implement business capabilities (recipes, shopping list, etc.).
All tool discovery/execution goes through the ToolRegistry.
Tools must be testable without a running LLM.

### LLM layer
Model-agnostic interface and adapters.
LLM usage is strictly bounded: interpretation/extraction/formatting only.

### Memory layer
Session memory (in-memory for MVP) and optional persistent storage later.
Owns trimming and summarization behavior.

---

## Data contracts

### InputMessage
- text: str
- session_id: str
- interface: str ("cli" | "web" | "alexa" | "esp32")
- user_id: str (default "local")
- metadata: dict | None

### OutputMessage
- text: str
- session_id: str
- status: "success" | "needs_confirmation" | "error"
- end_session: bool
- data: dict | None
- confirmation_id: str | None

---

## Orchestrator pipeline contract
The orchestrator must implement the 8-step pipeline described in `prompt.md`, including:
- rule-based intent classification with LLM fallback
- deterministic yes/no confirmation resolution
- missing-parameter re-prompt
- deterministic validation/execution

---

## Tools contract
Every tool must define:
- `name` (unique string)
- `description` (one sentence)
- `action_class`: INFORMATIONAL | SUGGESTIVE | EXECUTABLE
- `required_params` (list of param names)
- `run(params, context)` → ToolResponse (structured)

---

## Tool registry contract
The registry is the single source of tool discovery and selection:
- `register(tool)`
- `get(name)` → BaseTool | None
- `list_all()` → list[BaseTool]
- `list_by_class(action_class)` → list[BaseTool]
- `get_descriptions()` → list[dict]

---

## LLM contract
Base interface (`src/llm/adapters/base.py`):
- `complete(prompt, system_prompt, max_tokens, temperature)` → str
- `chat(messages, system_prompt, max_tokens, temperature)` → str
- `complete_structured(prompt, system_prompt)` → dict
- `is_available()` → bool

`complete_structured()` raises `LLMParseFailure` on invalid JSON.
The orchestrator catches this and falls back to safe defaults.

---

## Memory contract
Session memory must contain:
- `conversation_history` (list, trimmed to MAX_TURNS)
- `pending_confirmation` (dict | None)
- `collected_params` (dict, accumulated across turns)
- `summary` (str | None — LLM summary of trimmed turns)

Trimming strategy: when history > MAX_TURNS, summarize oldest half via LLM and replace with a single system entry.

---

## Confirmation model
- EXECUTABLE actions always create a `pending_confirmation` record in the session.
- The orchestrator never executes an EXECUTABLE tool without a resolved explicit "yes".
- A "no" cancels and clears state.
- While a confirmation is pending, the system must not start a new executable flow.

YES_PATTERNS: ["yes", "sim", "confirm", "ok", "sure", "go ahead", "yep", "proceed"]
NO_PATTERNS: ["no", "não", "cancel", "stop", "nevermind", "nope", "forget it"]

---

## Error handling standard
All errors returned across layers follow this structure:
```json
{
  "status": "error",
  "error_code": "string",
  "message": "string",
  "recoverable": true
}
```
No raw tracebacks to the user. Log tracebacks locally.

---

## Confirmed technical decisions

| Decision | Choice | Reason | Date |
|---|---|---|---|
| Language | Python 3.11+ | ecosystem + simplicity | 2026-04-13 |
| MVP Interface | CLI | local-first, zero cloud dependency | 2026-04-13 |
| Web framework | FastAPI | later Web UI + API reuse | 2026-04-13 |
| LLM runtime | Ollama (local) | offline-first, model-agnostic | 2026-04-13 |
| Commit convention | Conventional Commits | clean history, automation-friendly | 2026-04-13 |
| Test runner | pytest | standard Python, simple config | 2026-04-13 |

---

## Open decisions

| Decision | Options | Blocking | Notes |
|---|---|---|---|
| Persistent storage (MVP) | none vs SQLite | Not blocking | defer to Phase 2 |
| Logging library | stdlib logging vs structlog | Not blocking | start with stdlib |
| Web UI stack | minimal HTML vs lightweight JS framework | Not blocking | Phase 2 decision |

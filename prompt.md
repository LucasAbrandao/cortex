# JARVIS — Intelligent Local Assistant
### Master Project Specification — v2.0
> **This file is the single source of truth for the entire project.**
> Every AI coding agent, every developer, every session starts by reading this file in full.
> It is a living document. Every architectural decision must be reflected here before code is written.

---

## 0. HOW TO USE THIS FILE

This document is the **initialization prompt** for any AI coding assistant (Codex, Copilot, Claude, etc.).

**Mandatory startup sequence — every session:**
1. Read this file completely
2. Read `docs/architecture.md`
3. Read `docs/checkpoint.md`
4. Read `docs/currentTask.md`
5. Only then write code — strictly limited to what `currentTask.md` defines

**Violations of this sequence produce incorrect, inconsistent, or unsafe output.**

---

## 1. PROJECT OVERVIEW

**Name:** JARVIS (Just A Rather Very Intelligent System)
**Type:** Local-first, offline-capable, conversational AI assistant
**Primary interface:** CLI (MVP) and Web UI (Phase 2)
**Secondary interface:** Amazon Alexa Custom Skill (optional adapter, Phase 3)
**Processing:** Local Windows PC
**AI Engine:** Local LLM via Ollama (model-agnostic, fully abstracted)
**Language:** Python 3.11+

### Vision

Build a conversational AI assistant that runs entirely on a local PC, understands multi-turn natural language, manages daily tasks (recipes, shopping lists, finances, automations), and always confirms before taking relevant actions. The system is designed to grow progressively from a CLI tool into a full voice-enabled home intelligence platform.

### Core Problem

Existing assistants (Alexa, Google Assistant) are cloud-dependent, command-based, and stateless. They cannot hold context across a conversation, reason about complex requests, or execute flexible personal automations privately. JARVIS replaces that intelligence with a fully local, privacy-preserving system that runs on commodity hardware.

---

## 2. ARCHITECTURAL CONTRADICTION RESOLVED — Interface Strategy

### The Problem (from v1.0)
The previous design claimed "local-first and fully offline" while making Alexa the primary interface. Alexa is inherently cloud-dependent — this is a fundamental contradiction that was corrected.

### The Decision

| Priority | Interface | Phase | Cloud Dependency |
|---|---|---|---|
| **Primary** | CLI (terminal) | MVP | None |
| **Secondary** | Web UI (FastAPI + HTML) | Phase 2 | None |
| **Tertiary** | Amazon Alexa Custom Skill | Phase 3 | Amazon cloud (optional) |
| **Future** | ESP32 / hardware I/O | Phase 4+ | Local network only |

### Rule
The system must be **100% functional without Alexa**. Alexa is an interface adapter — it translates Alexa JSON into the same `InputMessage` the CLI uses. Removing Alexa must require deleting one adapter file and nothing else.

---

## 3. NON-NEGOTIABLE ARCHITECTURAL RULES

These rules govern every task, every commit, every decision. They cannot be overridden without a formal spec update in `architecture.md`.

| ID | Rule |
|---|---|
| **R-01** | **Local First** — System must work 100% offline. No feature may depend on cloud for core functionality. |
| **R-02** | **LLM Abstraction** — No business logic calls Ollama directly. All LLM calls go through `llm/client.py`. Swapping models requires zero refactoring of business logic. |
| **R-03** | **Confirmation Before Action** — EXECUTABLE actions require explicit user confirmation. No exceptions. |
| **R-04** | **Layer Isolation** — Layers communicate only through defined interfaces. No layer imports from a non-adjacent layer. |
| **R-05** | **Spec Before Code** — No code is written without a corresponding `currentTask.md` entry with acceptance criteria. |
| **R-06** | **Orchestrator Decides** — The LLM may suggest an intent or tool. The Orchestrator makes the final routing decision. The LLM never directly triggers tool execution. |
| **R-07** | **Deterministic Paths First** — Validation, confirmation, and execution are always deterministic code. LLM is only used for interpretation, suggestion, and natural language output. |
| **R-08** | **Testability** — Every module is independently testable. Every tool works without a running LLM. Every flow is reproducible via a test script. |

---

## 4. SYSTEM ARCHITECTURE

### 4.1 Layer Map

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERFACE LAYER                         │
│   CLI Adapter │ Web UI Adapter │ Alexa Adapter (optional)    │
│   All adapters normalize input to: InputMessage schema       │
└──────────────────────────────┬──────────────────────────────┘
                               │ InputMessage
┌──────────────────────────────▼──────────────────────────────┐
│                    ORCHESTRATOR LAYER                        │
│  8-step processing pipeline (see Section 5)                  │
│  Owns: session routing, intent resolution, confirmation state│
└──────────┬───────────────────────────┬───────────────────────┘
           │                           │
┌──────────▼────────┐    ┌─────────────▼──────────────────────┐
│    LLM LAYER      │    │           TOOLS LAYER               │
│  client.py        │    │  Tool Registry                      │
│  Model-agnostic   │    │  BaseTool interface                 │
│  Ollama adapter   │    │  recipes │ shopping │ finance │ etc  │
└──────────┬────────┘    └─────────────┬──────────────────────┘
           │                           │
┌──────────▼───────────────────────────▼──────────────────────┐
│                      MEMORY LAYER                            │
│  SessionMemory (in-memory, per session)                      │
│  PersistentMemory (SQLite, optional in MVP)                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Unified Input Schema

All interface adapters normalize their input to this format before passing to the Orchestrator:

```python
@dataclass
class InputMessage:
    text: str               # raw user input text
    session_id: str         # unique session identifier
    interface: str          # "cli" | "web" | "alexa" | "esp32"
    user_id: str = "local"  # reserved for future multi-user support
    metadata: dict = None   # interface-specific extras (e.g., Alexa device_id)
```

### 4.3 Unified Output Schema

```python
@dataclass
class OutputMessage:
    text: str                       # response text (spoken or displayed)
    session_id: str
    status: str                     # "success" | "needs_confirmation" | "error"
    end_session: bool = False       # hint to interface to close session
    data: dict = None               # structured output (e.g., list items)
    confirmation_id: str = None     # present when status == "needs_confirmation"
```

---

## 5. ORCHESTRATOR PIPELINE (EXPLICIT — 8 STEPS)

Every user input passes through this exact pipeline. No shortcuts, no bypasses.

```
INPUT (InputMessage)
  │
  ▼
Step 1: INPUT NORMALIZATION
  │  Strip whitespace, normalize encoding
  │  Validate InputMessage schema
  │
  ▼
Step 2: CONTEXT INJECTION
  │  Load session from SessionMemory by session_id
  │  If no session → create new session
  │  Check for pending_confirmation state
  │  If pending → route to confirmation resolution (Step 6 shortcut)
  │
  ▼
Step 3: INTENT CLASSIFICATION
  │  Run rule-based classifier (fast, deterministic)
  │  If confidence >= 0.85 → use result
  │  Else → LLM fallback classifier (returns structured JSON)
  │  Output: IntentResult { intent, confidence, source, raw_input }
  │
  ▼
Step 4: ENTITY / PARAMETER EXTRACTION
  │  Rule-based extraction for known patterns (numbers, lists, names)
  │  If complex/ambiguous → LLM extraction (returns structured JSON)
  │  Merge with collected_params from session (multi-turn accumulation)
  │  Output: dict of extracted params
  │
  ▼
Step 5: DECISION LAYER (Orchestrator — not LLM)
  │  A) Tool found + all params present → Step 6 (confirm) or Step 7 (execute)
  │  B) Tool found + missing params → re-prompt user, update collected_params
  │  C) No tool matched → route to LLM general response (Step 7)
  │  D) New EXECUTABLE while confirmation pending → ask user to resolve first
  │
  ▼
Step 6: CONFIRMATION HANDLING
  │  If tool.action_class == EXECUTABLE and NOT yet confirmed:
  │    Generate confirmation prompt
  │    Save pending_confirmation to session memory
  │    Return OutputMessage(status="needs_confirmation") — STOP, wait for user
  │  If already confirmed (yes/no resolved in Step 2):
  │    If yes → proceed to Step 7
  │    If no  → clear confirmation state, return cancellation message — STOP
  │
  ▼
Step 7: EXECUTION
  │  Tool path:    tool.run(params, context) → ToolResponse
  │  LLM path:     llm.chat(messages, system_prompt) → str
  │  Catch all exceptions → wrap in ErrorResponse
  │
  ▼
Step 8: RESPONSE FORMATTING
  │  Format OutputMessage for target interface
  │  Update SessionMemory (append turn to history, clear confirmation state)
  │  Log session_updated event
  │  Return OutputMessage

OUTPUT (OutputMessage)
```

### Orchestrator Decision Rules (Step 5, detailed)

```
IF pending_confirmation EXISTS in session:
    IF input matches YES_PATTERNS  → execute pending action (Step 7)
    IF input matches NO_PATTERNS   → cancel, clear state, respond with cancellation
    ELSE                           → re-prompt once: "I need a yes or no"
                                   → if still unresolved on next turn → cancel silently

YES_PATTERNS = ["yes", "sim", "confirm", "ok", "sure", "go ahead", "yep", "proceed"]
NO_PATTERNS  = ["no", "não", "cancel", "stop", "nevermind", "nope", "forget it"]
```

---

## 6. TOOL REGISTRY SYSTEM

The Tool Registry is the **single mechanism** for tool discovery, registration, and selection. No tool is ever instantiated or called outside the registry.

### 6.1 Registry Interface

```python
# src/tools/registry.py

class ToolRegistry:

    def register(self, tool: BaseTool) -> None:
        """Register a tool instance. Called at startup."""

    def get(self, name: str) -> BaseTool | None:
        """Retrieve a tool by its name. Returns None if not found."""

    def list_all(self) -> list[BaseTool]:
        """Return all registered tools."""

    def list_by_class(self, action_class: str) -> list[BaseTool]:
        """Filter tools by 'INFORMATIONAL' | 'SUGGESTIVE' | 'EXECUTABLE'."""

    def get_descriptions(self) -> list[dict]:
        """Return [{name, description, action_class}] for LLM prompt context."""
```

### 6.2 Tool Registration (Startup)

```python
# src/main.py — runs once at startup

registry = ToolRegistry()
registry.register(RecipeTool())
registry.register(ShoppingListTool())
# Phase 2+:
# registry.register(FinanceTool())
# registry.register(AutomationTool())
```

### 6.3 How to Add a New Tool (Extension Contract — 5 steps)

1. Create `src/tools/<tool_name>.py` inheriting `BaseTool`
2. Implement: `name`, `description`, `action_class`, `required_params`, `run()`
3. Register in `src/main.py` at startup
4. Add unit tests in `tests/unit/test_<tool_name>.py`
5. Update `docs/architecture.md` if it introduces a new contract

---

## 7. LLM LAYER — BOUNDARIES AND CONTRACTS

### 7.1 What the LLM IS Used For

| Use Case | Trigger | Output Format |
|---|---|---|
| Intent classification (fallback) | Rule-based confidence < 0.85 | Structured JSON |
| Entity/param extraction (complex) | Ambiguous input | Structured JSON |
| General question answering | No tool matched | Free text |
| Natural language response formatting | Tool result needs humanizing | Free text |
| Context summarization | History exceeds MAX_TURNS | Free text |

### 7.2 What the LLM is NEVER Used For

| Forbidden Use | Reason |
|---|---|
| Final tool routing decision | Orchestrator owns this — safety boundary |
| Parameter validation | Must be deterministic and testable |
| Confirmation state management | Session-owned, deterministic |
| Memory reads or writes | Memory layer owns this |
| YES/NO resolution | Rule-based exact match only |
| Error handling decisions | Always deterministic |

### 7.3 Prompt Structure

Every LLM call uses a system prompt containing:
1. Role definition ("You are JARVIS, a helpful local assistant...")
2. Output format instruction (JSON schema when structured output needed)
3. Available tools summary (`registry.get_descriptions()`)
4. Current date/time
5. Session summary (if exists) + last N turns of conversation history

### 7.4 Structured LLM Output Contract

When LLM is used for classification or extraction, response must be valid JSON:

```json
{
  "intent": "recipe_suggestion",
  "confidence": 0.92,
  "tool_name": "recipe_tool",
  "extracted_params": {
    "ingredients": ["eggs", "cheese"]
  }
}
```

`complete_structured()` must validate this and raise `LLMParseFailure` on invalid JSON. The orchestrator catches this and falls back to safe defaults.

### 7.5 LLM Client Interface (Fixed Contract — never change without updating architecture.md)

```python
# src/llm/adapters/base.py

from abc import ABC, abstractmethod

class BaseLLMClient(ABC):

    @abstractmethod
    def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        """Single-turn completion. Returns response string."""

    @abstractmethod
    def chat(
        self,
        messages: list[dict],  # [{"role": "user"|"assistant", "content": str}]
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        """Multi-turn chat. Returns response string."""

    @abstractmethod
    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        """Structured output. Returns parsed dict. Raises LLMParseFailure on error."""

    @abstractmethod
    def is_available(self) -> bool:
        """Health check. Returns True if model is reachable and responding."""
```

---

## 8. MEMORY LAYER — STRATEGY AND BEHAVIOR

### 8.1 Session Memory Schema

```python
session = {
    "session_id": str,
    "interface": str,               # "cli" | "web" | "alexa"
    "created_at": str,              # ISO 8601
    "last_updated": str,
    "turn_count": int,

    "conversation_history": [       # trimmed to MAX_TURNS
        {
            "role": "user" | "assistant",
            "content": str,
            "timestamp": str,
            "intent": str | None,
        }
    ],

    "pending_confirmation": {       # None if nothing pending
        "confirmation_id": str,     # uuid4
        "action": str,              # human-readable description
        "tool_name": str,
        "params": dict,
        "prompt": str,              # what was asked to user
        "created_at": str,
    } | None,

    "collected_params": dict,       # params accumulated across turns
    "last_intent": str | None,
    "user_preferences": dict,
    "summary": str | None,          # LLM summary of trimmed turns
}
```

### 8.2 Context Trimming Strategy

```
MAX_TURNS = 20  (configurable via SESSION_MAX_TURNS in .env)

WHEN len(conversation_history) > MAX_TURNS:
  1. Take oldest (MAX_TURNS // 2) turns
  2. Call llm.complete() to summarize them into 2-3 sentences
  3. Replace those turns with one system entry:
       {"role": "system", "content": "Previous summary: ..."}
  4. Keep most recent (MAX_TURNS // 2) turns intact
```

---

## 9. CONFIRMATION MODEL

### 9.1 Action Classes

All user requests must be mapped into one of these:

| Class | Description | Confirmation Required |
|---|---|---|
| `INFORMATIONAL` | Facts, questions, explanations | None |
| `SUGGESTIVE` | Recommendations, options, plans | Light confirmation |
| `EXECUTABLE` | Save data, run automation, modify state | Mandatory explicit confirmation |

### 9.2 Confirmation Contract

- EXECUTABLE actions always create a `pending_confirmation` record in the session.
- The orchestrator never executes an EXECUTABLE tool without a resolved explicit "yes".
- A "no" cancels and clears state.
- While a confirmation is pending, the system must not start a new executable flow.

---

## 10. ERROR HANDLING STANDARD

All system errors must be represented as:

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

## 11. OBSERVABILITY AND LOGGING

Logging requirements:

- Structured logs (JSON) preferred
- Events to log:
  - user_input_received
  - intent_resolved
  - tool_selected
  - confirmation_requested
  - confirmation_resolved
  - tool_executed
  - error_raised
  - session_updated

---

## 12. MVP SCOPE (PHASE 1)

MVP includes:
- CLI multi-turn conversation
- recipes suggestion flow
- shopping list management flow
- confirmation system
- tool registry
- orchestrator pipeline
- session memory (in-memory)
- tests: unit + integration + conversation scripts

Out of scope for MVP:
- finance
- automation
- Alexa adapter
- persistent storage (SQLite optional later)

---

## 13. PHASE ROADMAP

Phase 0 — Foundation:
- repository scaffold
- docs + processes
- base orchestrator scaffolding

Phase 1 — MVP Core:
- CLI + orchestrator pipeline
- recipe + shopping list tools
- confirmation model and tests

Phase 2 — Web UI:
- local web UI for interaction

Phase 3 — Alexa adapter:
- optional voice interface adapter

Phase 4+ — Hardware and automations:
- ESP32 triggers and local network execution

---

## 14. REQUIRED PROJECT STRUCTURE

```
cortex/
├── AGENTS.md
├── prompt.md
├── docs/
│   ├── architecture.md
│   ├── checkpoint.md
│   └── currentTask.md
├── src/
│   ├── main.py
│   ├── schemas.py
│   ├── orchestrator/
│   ├── tools/
│   ├── llm/
│   ├── memory/
│   └── interface/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conversation/
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 15. TEST STRATEGY (MANDATORY)

### Unit Tests
- ToolRegistry behavior
- schema validation
- memory behaviors
- orchestrator decision rules (pure functions)

### Integration Tests
- orchestrator pipeline end-to-end (mock LLM and tools)
- confirmation flow: EXECUTABLE → pending → yes → executed
- confirmation flow: EXECUTABLE → pending → no → cancelled
- LLM unavailable: pipeline continues, graceful response returned

### Conversation Test Requirements (scripted multi-turn)

```
Recipe flow:
  Turn 1: "I have eggs and cheese" → suggestions returned
  Turn 2: "Option 1" → ingredient list returned
  Turn 3: "Add missing items to my list" → confirmation prompt
  Turn 4: "yes" → items added confirmation

Confirmation cancel flow:
  Turn 1: "Add milk to weekly list" → confirmation prompt
  Turn 2: "no" → cancellation returned
```

### Contract Test Requirements
- `OllamaAdapter` must pass all `BaseLLMClient` interface tests
- A new adapter must pass the same test suite without modification

---

## 16. SECURITY & PRIVACY

- Local-first by default
- No automatic cloud calls
- `.env` must be gitignored
- Keep logs local; avoid logging secrets

---

## 17. OPEN DECISIONS

- Persistent memory: SQLite in Phase 2 or Phase 1.5?
- Web UI stack: minimal HTML vs lightweight frontend framework
- Structured logging library choice

---

## 18. EXECUTION RULE: SPEC-DRIVEN WORKFLOW

Each task follows this strict loop:
1) Define task in `docs/currentTask.md` with acceptance criteria
2) Implement only within scope
3) Add unit + integration tests
4) Verify with tests
5) Update `docs/checkpoint.md`
6) Generate next `docs/currentTask.md`

No exceptions.

---

## 19. DOCUMENTATION CONTRACTS

### `docs/architecture.md`
Stable system design and contracts. No task lists.

### `docs/checkpoint.md`
Living snapshot of project status. Updated after every task.

### `docs/currentTask.md`
Exactly one active task. Replaced after each task completion.

---

## 20. GIT WORKFLOW AND COMMIT CONVENTIONS

### 20.1 Branch Strategy

```
main              ← stable only; merged from dev at Phase milestone
  └── dev         ← integration branch; receives PRs from task branches
        ├── task/T01-project-setup
        ├── task/T02-llm-abstraction
        ├── fix/confirmation-state
        └── docs/architecture-updates
```

### 20.2 Commit Message Format (Conventional Commits — enforced)

```
<type>(<scope>): <short imperative description, max 72 chars>

[optional body: what and why, not how]

[optional footer: BREAKING CHANGE: ... or Closes #issue]
```

Types: feat, fix, docs, refactor, test, chore, task
Scopes: orchestrator, tools, memory, llm, interface, schemas, arch, checkpoint, task, config

Examples:
- feat(tools): implement recipe tool with confirmation flow
- fix(orchestrator): clear confirmation state after no/cancel response
- docs(arch): document tool registry extensibility contract
- task(T01): initialize project structure and CLI interface

### 20.3 Pull Request Rules

- PR title matches the task title in `docs/currentTask.md`
- PR description lists each acceptance criteria + verification method
- `pytest` must pass before merge
- `docs/checkpoint.md` updated before merge

---

## 21. END OF SPEC
This is a living spec. Update it when the project evolves.
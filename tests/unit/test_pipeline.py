from __future__ import annotations

from dataclasses import dataclass

from src.llm.adapters import MockLLMClient
from src.memory.session import SessionMemoryStore
from src.orchestrator.pipeline import OrchestratorPipeline
from src.schemas import InputMessage, IntentResult, ToolResponse
from src.tools.registry import ToolRegistry


class FailingStructuredMockLLM(MockLLMClient):
    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        _ = (prompt, system_prompt)
        raise AssertionError("LLM structured fallback should not run on deterministic match")


@dataclass
class FakeTool:
    name: str
    description: str
    action_class: str
    required_params: list[str]
    response_text: str

    def run(self, params: dict[str, object], context: dict[str, object]) -> ToolResponse:
        _ = context
        return ToolResponse(text=self.response_text, data={"params": params})


def test_pipeline_process_calls_steps_in_order() -> None:
    registry = ToolRegistry()
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-1",
    )
    call_order: list[str] = []
    message = InputMessage(text=" hello ", session_id="session-1", interface="cli")

    normalized_message = InputMessage(text="hello", session_id="session-1", interface="cli")
    session = pipeline._session_store.get_or_create("session-1", "cli")
    intent = IntentResult(
        intent="general_response",
        confidence=0.0,
        source="fallback",
        raw_input="hello",
    )
    decision = object()
    execution = object()

    pipeline._step1_input_normalization = lambda incoming: call_order.append("step1") or normalized_message
    pipeline._step2_context_injection = lambda incoming: call_order.append("step2") or (
        session,
        object(),
    )
    pipeline._step3_intent_classification = lambda incoming, active_session, confirmation: call_order.append("step3") or intent
    pipeline._step4_entity_parameter_extraction = lambda incoming, active_session, resolved_intent: call_order.append("step4") or {}
    pipeline._step5_decision_layer = lambda active_session, confirmation, resolved_intent, params: call_order.append("step5") or decision
    pipeline._step6_confirmation_handling = lambda active_session, resolved_decision: call_order.append("step6") or None
    pipeline._step7_execution = lambda incoming, active_session, resolved_decision: call_order.append("step7") or execution
    pipeline._step8_response_formatting = lambda incoming, active_session, resolved_intent, resolved_execution: call_order.append("step8") or "formatted"

    result = pipeline.process(message)

    assert result == "formatted"
    assert call_order == [
        "step1",
        "step2",
        "step3",
        "step4",
        "step5",
        "step6",
        "step7",
        "step8",
    ]


def test_pipeline_requests_confirmation_for_executable_tools() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Add an item to a shopping list.",
            action_class="EXECUTABLE",
            required_params=["item"],
            response_text="Added item",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(
            structured_response={
                "intent": "add_to_list",
                "confidence": 0.9,
                "tool_name": "shopping_list_tool",
                "extracted_params": {"item": "milk"},
            }
        ),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-123",
    )

    response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-confirm",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-confirm")

    assert response.status == "needs_confirmation"
    assert response.confirmation_id == "confirm-123"
    assert response.text == "Please confirm: shopping_list_tool with {'item': 'milk'}"
    assert session is not None
    assert session.pending_confirmation is not None
    assert session.pending_confirmation.tool_name == "shopping_list_tool"
    assert session.collected_params == {"item": "milk"}


def test_pipeline_executes_non_executable_tools() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="recipe_tool",
            description="Suggest recipes.",
            action_class="SUGGESTIVE",
            required_params=[],
            response_text="Here are some recipe ideas.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(
            structured_response={
                "intent": "recipe_suggestion",
                "confidence": 0.95,
                "tool_name": "recipe_tool",
                "extracted_params": {},
            }
        ),
        session_store=SessionMemoryStore(),
    )

    response = pipeline.process(
        InputMessage(
            text="Suggest dinner ideas",
            session_id="session-recipes",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-recipes")

    assert response.status == "success"
    assert response.text == "Here are some recipe ideas."
    assert response.data == {"params": {}}
    assert session is not None
    assert session.last_intent == "recipe_suggestion"
    assert len(session.conversation_history) == 2


def test_pipeline_rule_based_tool_match_runs_before_llm_fallback() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="recipe_tool",
            description="Suggest recipes.",
            action_class="SUGGESTIVE",
            required_params=[],
            response_text="Rule matched recipe tool.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=FailingStructuredMockLLM(),
        session_store=SessionMemoryStore(),
    )

    response = pipeline.process(
        InputMessage(
            text="Can you suggest a recipe for dinner?",
            session_id="session-rule-match",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-rule-match")

    assert response.status == "success"
    assert response.text == "Rule matched recipe tool."
    assert session is not None
    assert session.last_intent == "recipe_tool"


def test_pipeline_missing_params_preserves_partial_state_across_turns() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Manage shopping list items.",
            action_class="SUGGESTIVE",
            required_params=["item", "quantity"],
            response_text="Item staged with quantity.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(
            structured_response={
                "intent": "shopping_add",
                "confidence": 0.92,
                "tool_name": "shopping_list_tool",
                "extracted_params": {},
            }
        ),
        session_store=SessionMemoryStore(),
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-missing-params",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="shopping list quantity 2",
            session_id="session-missing-params",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-missing-params")

    assert first_response.status == "success"
    assert (
        first_response.text
        == "I still need: quantity. Please provide the missing details."
    )
    assert second_response.status == "success"
    assert second_response.text == "Item staged with quantity."
    assert second_response.data == {"params": {"item": "milk", "quantity": 2}}
    assert session is not None
    assert session.collected_params == {"item": "milk", "quantity": 2}


def test_pipeline_pending_confirmation_yes_executes_and_clears_state() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Add item to shopping list.",
            action_class="EXECUTABLE",
            required_params=["item"],
            response_text="Added item after confirmation.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-yes",
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-confirm-yes",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="yes",
            session_id="session-confirm-yes",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-confirm-yes")

    assert first_response.status == "needs_confirmation"
    assert first_response.confirmation_id == "confirm-yes"
    assert second_response.status == "success"
    assert second_response.text == "Added item after confirmation."
    assert session is not None
    assert session.pending_confirmation is None


def test_pipeline_pending_confirmation_no_cancels_and_clears_state() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Add item to shopping list.",
            action_class="EXECUTABLE",
            required_params=["item"],
            response_text="This should not execute.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-no",
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-confirm-no",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="no",
            session_id="session-confirm-no",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-confirm-no")

    assert first_response.status == "needs_confirmation"
    assert second_response.status == "success"
    assert second_response.text == "Okay, I cancelled that request."
    assert session is not None
    assert session.pending_confirmation is None


def test_pipeline_pending_confirmation_unresolved_reply_reprompts() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Add item to shopping list.",
            action_class="EXECUTABLE",
            required_params=["item"],
            response_text="This should not execute.",
        )
    )
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-awaiting",
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-confirm-awaiting",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="maybe later",
            session_id="session-confirm-awaiting",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-confirm-awaiting")

    assert first_response.status == "needs_confirmation"
    assert second_response.status == "needs_confirmation"
    assert second_response.confirmation_id == "confirm-awaiting"
    assert (
        second_response.text
        == "I need a yes or no before continuing with the pending action."
    )
    assert session is not None
    assert session.pending_confirmation is not None
    assert session.pending_confirmation.confirmation_id == "confirm-awaiting"


def test_pipeline_pending_confirmation_blocks_new_executable_flow() -> None:
    registry = ToolRegistry()
    registry.register(
        FakeTool(
            name="shopping_list_tool",
            description="Add item to shopping list.",
            action_class="EXECUTABLE",
            required_params=["item"],
            response_text="Shopping tool executed.",
        )
    )
    registry.register(
        FakeTool(
            name="automation_tool",
            description="Run a local automation.",
            action_class="EXECUTABLE",
            required_params=[],
            response_text="Automation executed.",
        )
    )
    confirmation_ids = iter(["confirm-original", "confirm-new"])
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: next(confirmation_ids),
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="session-confirm-guardrail",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="Run automation now",
            session_id="session-confirm-guardrail",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("session-confirm-guardrail")

    assert first_response.status == "needs_confirmation"
    assert first_response.confirmation_id == "confirm-original"
    assert second_response.status == "needs_confirmation"
    assert second_response.confirmation_id == "confirm-original"
    assert session is not None
    assert session.pending_confirmation is not None
    assert session.pending_confirmation.tool_name == "shopping_list_tool"
    assert session.pending_confirmation.confirmation_id == "confirm-original"

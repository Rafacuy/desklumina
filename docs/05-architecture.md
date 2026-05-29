# 05 - Architecture

Understand the internal design, module organization, and prompt architecture of DeskLumina.

---

## Table of Contents

- [System Overview](#system-overview)
- [Module Map](#module-map)
- [Intelligence Layer (AI)](#intelligence-layer-ai)
  - [Multi-Provider Orchestration](#multi-provider-orchestration)
  - [Fallback & Resilience Strategy](#fallback--resilience-strategy)
  - [Token Management & Middleware](#token-management--middleware)
- [Agentic Workflow](#agentic-workflow)
  - [Agent (ReAct Loop)](#agent-react-loop)
  - [Bounded Reasoning Loop](#bounded-reasoning-loop)
- [Core Components](#core-components)
  - [Lumina (Orchestrator)](#lumina-orchestrator)
  - [Contract-Driven Prompts](#contract-driven-prompts)
  - [Live Context Injection](#live-context-injection)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [UI Layer](#ui-layer)

---

## System Overview

DeskLumina is designed with a modular architecture that separates concerns between the UI, Intelligence (AI), and System Execution (Tools).

```mermaid
flowchart TD
    subgraph Frontend [User Interface]
        UI[Rofi / Terminal / Daemon]
    end

    subgraph Logic [Core Orchestrator]
        Core[Lumina / ChatManager / i18n]
        Agent[Agent Loop / Context]
        Prompt[Prompt Engine / Contracts]
    end

    subgraph Backend [Execution & Intelligence]
        AI[AI Layer - Multi-Provider]
        Security[Security Layer]
        Tools[Tools Layer - Desktop]
    end

    UI --> Core
    Core --> Agent
    Agent --> Prompt
    Agent --> AI
    Agent --> Tools
    Core --> Security

    style Frontend fill:#f9f9f9,stroke:#333
    style Logic fill:#f9f9f9,stroke:#333
    style Backend fill:#f9f9f9,stroke:#333
```

---

## Module Map

The project is organized into several key directories under `src/`:

- **`agent/`**: The core of the agentic workflow. Implements the bounded ReAct reasoning loop, terminal signal parsing, turn-based context accumulation, and history trimming.
- **`ai/`**: Handles AI interactions through a multi-provider architecture. Includes provider adapters (Groq, OpenAI, Anthropic, Gemini, OpenRouter, Hugging Face), a shared streaming base, SSE parsing, model resolution with fallback chains, circuit-breaker health tracking, and the contract-driven prompt builder.
- **`config/`**: Environment variable loading and application aliases.
- **`constants/`**: Shared constants such as command timeouts, model defaults, and tool retries.
- **`core/`**: High-level orchestration, containing the Lumina coordinator, Chat/Settings managers (with provider preference storage), and the tool planner.
- **`tools/`**: Desktop automation implementations (apps, files, music, etc.) and their formal contracts.
- **`ui/`**: User interface components including Rofi logic, themes, and tool result rendering.
- **`security/`**: Confirmation dialogs and dangerous command analysis.
- **`logger/`**: File and console logging infrastructure.
- **`types/`**: TypeScript type definitions for tools, results, and AI messages.
- **`utils/`**: Shared helpers such as formatters, i18n, and path utilities.

---

## Intelligence Layer (AI)

DeskLumina features a robust, multi-provider intelligence layer designed for high availability and reliability.

### Multi-Provider Orchestration
**Path**: `src/ai/orchestrator.ts`
The orchestrator manages the lifecycle of an AI request across multiple providers. It uses a **provider-agnostic model resolution** system that allows fallback chains to span different platforms (e.g., failing over from Groq to OpenAI).

### Fallback & Resilience Strategy
1.  **Model Resolution**: The system expands configured models and aliases (like `fast` or `smart`) into a prioritized list of `{ providerId, modelId }`.
2.  **Circuit Breaking**: The `CircuitBreaker` (`src/ai/provider/circuit-breaker.ts`) tracks the health of each provider. If a provider consistently fails (e.g., returns 5xx or 429), it is temporarily marked as "unhealthy" and skipped in the fallback chain.
3.  **Automatic Failover**: When a primary model fails with a retriable error (Rate Limit, Server Error, or Model Not Found), the orchestrator immediately moves to the next model in the resolved list, regardless of whether it belongs to the same provider.
4.  **Health Recovery**: Providers are automatically re-tested after a cooldown period to restore them to the active pool once they become responsive.

### Token Management & Middleware
- **Global Token Counter**: Tracks usage across all providers to enforce safe limits and provide metrics.
- **Middleware Pipeline**: Requests pass through a pipeline for capability guarding (ensuring the model supports requested features), logging, and token counting before reaching the provider.

---

## Agentic Workflow

### Agent (ReAct Loop)
**Path**: `src/agent/agent.ts`
The Agent implements a **Bounded ReAct Loop**. Each iteration involves reasoning, tool selection, and execution. The loop is bounded by a turn budget (default: 10) to prevent infinite loops and manage token consumption.

### Bounded Reasoning Loop
DeskLumina uses a turn-based reasoning loop to solve complex tasks:
1.  **Reasoning**: The model analyzes the conversation history and decides the next step.
2.  **Action**: The model emits tool calls if needed.
3.  **Execution**: System executes tools and injects results back into history as `user` messages.
4.  **Signal Detection**: The system scans for terminal markers (`[[DONE]]`, `[[FAIL]]`).
5.  **History Trimming**: If history exceeds the token limit, early reasoning turns are discarded to preserve recent context.
6.  **Synthesis Fallback**: If the turn budget is exhausted, the system forces a final answer without further tool use.

---

## Core Components

### Lumina (Orchestrator)
**Path**: `src/core/lumina.ts`
The central hub coordinates activity between the UI and the Agent. It prepares the initial context, triggers the agent loop, and handles terminal signals. It also manages the final presentation, including i18n-aware failure messaging and TTS.

### Contract-Driven Prompts
**Path**: `src/ai/prompts.ts`
DeskLumina generates prompts dynamically from **Tool Contracts** (`src/tools/contracts.ts`). Each contract defines:
- **Schema & Types**: Formal syntax for tool calls.
- **Valid/Invalid Formats**: Examples that ground the model's output.
- **Failure Behavior**: Specific retry limits and retriable vs. non-retriable errors.
- **Path/Quoting Rules**: Precise constraints for argument formatting.

### Persona Injection

The prompt builder (`src/ai/prompts.ts`) supports runtime persona injection. When a non-default persona is selected in settings, the persona's compact prompt string is appended to the assistant identity section of the system prompt. The default persona uses the identity directly with no appended text. Invalid persona identifiers fall back safely to the default.

### Live Context Injection
DeskLumina injects real-time system state into every request:
- **Probing**: Uses `pactl`, `playerctl`, and `xdotool` to gather volume, media state, and active window info.
- **Caching**: Probes are cached for 30 seconds to minimize system overhead.
- **Selective Injection**: A relevance filter (`selectContext`) ensures only pertinent state (e.g., media state for music queries) is sent to the model, saving tokens.

---

## Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as User Interface
    participant Core as Lumina Orchestrator
    participant Agent as Agent Loop
    participant AI as AI Provider
    participant OS as System Tools

    User->>UI: Enter command
    UI->>Core: Forward request
    Core->>Agent: runAgent(history)
    
    loop Turn <= MAX_TURNS
        Agent->>AI: streamAI(history)
        AI-->>Agent: Assistant text + Tool calls
        
        alt Signal Detected ([[DONE]] / [[FAIL]])
            Agent-->>Core: Final Result
        else Tool Calls Present
            Agent->>OS: Execute tools
            OS-->>Agent: Tool Results
            Agent->>Agent: Append results to history
        end
    end

    alt Budget Exhausted
        Agent->>AI: Synthesis prompt
        AI-->>Agent: Final synthesis
    end

    Agent-->>Core: Final Result
    Core->>UI: Show clean result + TTS
```

---

## Security Model

DeskLumina implements a **Human-in-the-Loop** security model.

- **Passive Analysis**: All terminal commands are scanned for dangerous patterns (e.g., recursive deletion, nested command substitution).
- **Active Confirmation**: High-risk commands trigger a Rofi confirmation dialog.
- **Path Restrictions**: The `file` tool enforces specific rules for absolute paths and tilde expansion, preventing directory traversal.

---

## UI Layer

- **Rofi Integration**: Uses Rofi's `dmenu` mode for a lightweight, floating chat interface.
- **Theming**: Powered by `.rasi` files, allowing for deep customization.
- **Tool Display**: `src/ui/tool-display.ts` renders tool results into human-readable tables and lists within the chat. Terminal signals are hidden from the user-facing UI to maintain a clean experience.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)**: Learn about the available tools and their contracts.
- ⚙️ **[Configuration](04-configuration.md)**: Fine-tune the architecture.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to extend the system.

---

[← Configuration](04-configuration.md) | [Usage Guide →](06-usage-guide.md)

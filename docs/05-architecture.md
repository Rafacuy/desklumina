# 05 - Architecture

Understand the internal design, module organization, and prompt architecture of DeskLumina.

---

## Table of Contents

- [System Overview](#system-overview)
- [Module Map](#module-map)
- [Core Components](#core-components)
  - [Lumina (Orchestrator)](#lumina-orchestrator)
  - [Contract-Driven Prompts](#contract-driven-prompts)
  - [Tool Registry](#tool-registry)
- [Data Flow](#data-flow)
- [Failure Escalation Tree](#failure-escalation-tree)
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
        Prompt[Prompt Engine / Contracts]
    end

    subgraph Backend [Execution & Intelligence]
        AI[AI Layer - Multi-Provider]
        Security[Security Layer]
        Tools[Tools Layer - Desktop]
    end

    UI --> Core
    Core --> Prompt
    Prompt --> AI
    Core --> Security
    Core --> Tools

    style Frontend fill:#f9f9f9,stroke:#333
    style Logic fill:#f9f9f9,stroke:#333
    style Backend fill:#f9f9f9,stroke:#333
```

---

## Module Map

The project is organized into several key directories under `src/`:

- **`ai/`**: Handles AI interactions through a multi-provider architecture. Includes provider adapters (Groq, OpenAI, Anthropic, Gemini, OpenRouter, Hugging Face), a shared streaming base, SSE parsing, model resolution with fallback chains, circuit-breaker health tracking, and the contract-driven prompt builder.
- **`config/`**: Environment variable loading and application aliases.
- **`constants/`**: Shared constants such as command timeouts, model defaults, and tool retries.
- **`core/`**: The brain of the application, containing the Lumina orchestrator, Chat/Settings managers (with provider preference storage), and the tool planner.
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

### Lumina (Orchestrator)
**Path**: `src/core/lumina.ts`  
The central hub coordinates all activity. It takes user input, builds deterministic system prompts, manages the tool execution lifecycle (including retries), and synthesizes final responses.

### Contract-Driven Prompts
**Path**: `src/ai/prompts.ts`  
Instead of static text, DeskLumina generates prompts dynamically from **Tool Contracts** (`src/tools/contracts.ts`). Each contract defines:
- **Schema & Types**: Formal syntax for tool calls.
- **Valid/Invalid Formats**: Examples that ground the model's output.
- **Failure Behavior**: Specific retry limits and retriable vs. non-retriable errors.
- **Path/Quoting Rules**: Precise constraints for argument formatting.

### Live Context Injection
DeskLumina injects real-time system state into every request:
- **Probing**: Uses `pactl`, `playerctl`, and `xdotool` to gather volume, media state, and active window info.
- **Caching**: Probes are cached for 30 seconds to minimize system overhead.
- **Selective Injection**: A relevance filter (`selectContext`) ensures only pertinent state (e.g., media state for music queries) is sent to the model, saving tokens.

---

## Failure Escalation Tree

DeskLumina implements a 3-stage escalation logic for tool failures:

1.  **Failure 1 (Correction)**: Lumina identifies syntax or path errors from the tool's `stderr`. It feeds the error back to the model, which corrects the arguments and retries.
2.  **Failure 2 (Verification)**: If a corrected call still fails, the system verifies the tool contract and local file system state. The model is instructed to avoid repeating the same failing arguments.
3.  **Failure 3 (Escalation)**: After 2 unsuccessful retries, execution stops. The system synthesizes a structured failure report explaining the blockers to the user.

---

## Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as User Interface
    participant Core as Lumina Orchestrator
    participant Prompt as Prompt Engine
    participant AI as AI Provider
    participant Sec as Security Engine
    participant OS as System Tools

    User->>UI: Enter command
    UI->>Core: Forward request
    Core->>Prompt: Build system prompt (Contracts + Context)
    Prompt-->>Core: Final Prompt
    Core->>AI: Request tool calls
    AI-->>Core: Structured JSON tool calls
    
    rect rgba(255, 140, 0, 0.08)
        Note over Core,Sec: Security & Execution
        Core->>Sec: Validate command safety
        alt Risk detected
            Core->>UI: Request confirmation
            UI-->>Core: Decision
        end
        Core->>OS: Execute tool
        OS-->>Core: Tool Result (stdout/stderr/code)
    end

    alt Failure & Retries < 2
        Core->>Prompt: Build retry prompt (Error feedback)
        Prompt->>AI: Request corrected tool call
    else Success or Retries Exhausted
        Core->>Prompt: Build follow-up prompt
        Prompt->>AI: Request natural synthesis
        AI-->>Core: Text response
        Core->>UI: Show result + TTS
    end
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
- **Tool Display**: `src/ui/tool-display.ts` renders tool results (especially complex file search results) into human-readable tables and lists within the chat.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)**: Learn about the available tools and their contracts.
- ⚙️ **[Configuration](04-configuration.md)**: Fine-tune the architecture.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to extend the system.

---

[← Configuration](04-configuration.md) | [Usage Guide →](06-usage-guide.md)

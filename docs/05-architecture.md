# 05 - Architecture

Understand the internal design, module organization, and data flow of DeskLumina.

---

## Table of Contents

- [System Overview](#system-overview)
- [Module Map](#module-map)
- [Core Components](#core-components)
  - [Lumina (Orchestrator)](#lumina-orchestrator)
  - [ChatManager](#chatmanager)
  - [Tool Registry](#tool-registry)
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
    end

    subgraph Backend [Execution & Intelligence]
        AI[AI Layer - Groq]
        Security[Security Layer]
        Tools[Tools Layer - Desktop]
    end

    UI --> Core
    Core --> AI
    Core --> Security
    Core --> Tools

    style Frontend fill:#f9f9f9,stroke:#333
    style Logic fill:#f9f9f9,stroke:#333
    style Backend fill:#f9f9f9,stroke:#333
```

---

## Module Map

The project is organized into several key directories under `src/`:

- **`ai/`**: Handles AI interactions, including Groq streaming, TTS generation, and prompts.
- **`config/`**: Environment variable loading and application aliases.
- **`constants/`**: Shared constants such as command timeouts, model defaults, and the API endpoint.
- **`core/`**: The brain of the application, containing the Lumina orchestrator and Chat/Settings managers.
- **`tools/`**: Desktop automation implementations for apps, files, media, and the terminal.
- **`ui/`**: User interface components including Rofi logic, themes, and loading animations.
- **`daemon/`**: Background service implementation.
- **`security/`**: Confirmation dialogs and dangerous command analysis.
- **`logger/`**: File and console logging infrastructure.
- **`types/`**: TypeScript type definitions and default settings.
- **`utils/`**: Shared helpers such as formatters, i18n, and path utilities.
- **`locales/`**: JSON translation files for English and Indonesian.

---

## Core Components

### Lumina (Orchestrator)
**Path**: `src/core/lumina.ts`  
The central hub coordinates all activity. It takes user input, manages the AI conversation context, dispatches tool calls, and returns formatted responses to the UI.

### ChatManager
**Path**: `src/core/chat-manager.ts`  
This handles conversation persistence. It saves chat history to `~/.config/desklumina/chats/` and manages session state, including tool call results.

### Tool Registry
**Path**: `src/tools/registry.ts`  
A central mapping of tool names, like `app`, `file`, or `terminal`, to their TypeScript implementations. This allows for easy extensibility: adding a new tool simply requires registering it here.

---

## Data Flow

The following diagram illustrates the interaction between components during a typical command execution.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as User Interface
    participant Core as Lumina Orchestrator
    participant AI as Groq AI
    participant Sec as Security Engine
    participant OS as System Tools

    rect rgba(100, 149, 237, 0.08)
        Note over User,AI: Input & Intent Processing
        User->>UI: Enter command
        UI->>Core: Forward request
        Core->>AI: Request intent + tool calls
        AI-->>Core: Return intent + structured tools
    end

    rect rgba(255, 140, 0, 0.08)
        Note over Core,Sec: Security Validation
        Core->>Sec: Validate command safety

        alt Risk detected
            Core->>UI: Request confirmation
            UI->>User: Show confirmation dialog
            User-->>UI: Confirm or reject
            UI-->>Core: Forward decision
        end
    end

    rect rgba(60, 179, 113, 0.08)
        Note over Core,OS: Execution
        alt Safe or confirmed
            Core->>OS: Execute desktop action
            OS-->>Core: Return result
            Core->>UI: Show success + trigger voice
        else Rejected
            Core->>UI: Show cancellation notice
        end
    end
```

1.  **Input Capture**: The user types a command in Rofi or the Terminal.
2.  **Context Building**: `Lumina` builds the request from the system prompt, bounded prior context, and current user message.
3.  **AI Request**: The input and context are sent to the Groq API.
4.  **Streaming**: The AI starts streaming text and tool calls back to DeskLumina.
5.  **Tool Execution**:
    - `Planner` parses tool call JSON.
    - `Security` checks for dangerous commands.
    - `Registry` dispatches to the correct tool handler and records structured result data.
6.  **Retry Loop**: Failed tool calls are fed back into the model as structured tool-result context. Lumina retries corrected tool calls up to 2 times.
7.  **Persistence**: Assistant text and tool-result messages are saved into chat history. Older turns are compacted into summaries to bound context growth.
8.  **Final Output**: Tool results may be displayed in the UI; the assistant text is displayed and can be spoken via TTS.

## BREAKING CHANGES

- `app` no longer treats unknown aliases as shell commands. Use the `terminal` tool for arbitrary commands.
- `file` no longer falls back to arbitrary shell execution. Unsupported file actions now fail explicitly.
- Tool outcomes are now persisted as first-class chat messages and replayed into future model context.

---

## Recent Security Hardening

DeskLumina has recently undergone a comprehensive security audit and hardening process. Key improvements include:

1.  **Shell Injection Prevention**: All file operations use direct array-based spawning, eliminating the risk of command injection via malicious path names.
2.  **Command Substitution Detection**: The security analyzer now detects and blocks nested command substitution in terminal commands.
3.  **Secure TTS Lifecycle**: Text-to-Speech temporary files use `randomUUID` naming and are stored in a private directory with guaranteed cleanup.
4.  **Daemon Authentication**: Background services require a session token for communication, preventing unauthorized local access.
5.  **Atomic File Writes**: Configuration and chat persistence use atomic writes to prevent data corruption from interrupted saves.
6.  **Log Rotation**: Logs are automatically rotated at 10MB with 3 backup files, preventing unbounded disk growth.

---

## Security Model

DeskLumina implements a **Human-in-the-Loop** security model.

- **Passive Analysis**: All terminal commands are scanned for dangerous patterns.
- **Active Confirmation**: If a command is deemed high-risk, a Rofi confirmation dialog is shown.
- **Path Restrictions**: Tools like `file` prevent operations on sensitive system directories without elevated permissions or explicit confirmation.

---

## UI Layer

DeskLumina's UI is designed to be invisible until needed.

- **Rofi Integration**: Uses Rofi's `dmenu` and `script` modes to create a dynamic chat interface.
- **Theming**: Powered by `.rasi` files, allowing for deep customization of colors, fonts, and layouts.
- **Asynchronous Feedback**: A background loader animation is shown during AI inference to keep the UI responsive.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)**: Learn about the available tools.
- ⚙️ **[Configuration](04-configuration.md)**: Fine-tune the architecture.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to extend the system.

---

[← Configuration](04-configuration.md) | [Usage Guide →](06-usage-guide.md)

# Architecture

DeskLumina splits execution across three distinct layers: the frontend UI, the core orchestrator, and the background intelligence and tool engines.

## Contents

- [The ReAct Loop](#the-react-loop)
- [Multi-Provider Fallback Routing](#multi-provider-fallback-routing)
- [Prompt Contracts](#prompt-contracts)
- [Long-Term Memory (LTM)](#long-term-memory-ltm)

## The ReAct Loop

At its core, DeskLumina relies on a Bounded ReAct (Reason + Act) loop.[^1]

1. **Reason**: The model analyzes your request and the current context.
2. **Action**: The model outputs one or more tool calls.
3. **Execution**: The orchestrator validates, runs the tools, and appends the results to the chat history.
4. **Evaluate**: The loop repeats until the model determines the task is complete, or it hits the maximum turn budget (default 10).

If a tool is declared as non-blocking (like launching a GUI application), the executor fires the command into the background and immediately returns a synthetic "dispatched" result so the agent loop can continue without hanging on long-running processes.

[^1]: `src/agent/agent.ts`

## Multi-Provider Fallback Routing

DeskLumina abstracts the AI provider interface.[^2]

When a request is initiated, the prompt engine builds a payload and submits it to the primary provider. If the request fails due to a network timeout, rate limit (429), or server error (500), the orchestrator intercepts the failure before it breaks the loop.

The system uses a circuit breaker to track provider health. When a provider fails, the circuit breaker records the failure and marks the provider as unhealthy for a period of time using exponential backoff. The backoff starts at 30 seconds and doubles with each consecutive failure, capped at 10 minutes, with random jitter to prevent thundering herd problems. A single successful request resets the circuit breaker and removes the provider from the unhealthy state.

While a provider is marked unhealthy, the orchestrator walks your `fallbacks` list and transparently retries the exact same prompt against the next available provider. This ensures high availability even when one cloud provider is experiencing an outage or has temporarily rate-limited your account.

[^2]: `src/ai/registry/provider-registry.ts`

## Prompt Contracts

The AI is grounded using formal JSON schemas.[^3]

DeskLumina defines each tool through a strict `ToolContract`. The contract dictates valid formats, invalid formats, escaping rules, and failure retry logic. The system prompt is assembled dynamically from these contracts, ensuring the model always sees accurate syntax rules regardless of which backend is active.

[^3]: `src/tools/contracts/contracts.ts`

## Long-Term Memory (LTM)

DeskLumina features a persistent SQLite memory database that learns about you over time.

After a successful chat session concludes, an asynchronous process analyzes the conversation. It extracts three types of information into a persistent knowledge base stored at `~/.local/share/desklumina/ltm.db` by default.

### Memory Types

The system stores information in three distinct layers:

**Facts** are stable, long-term truths about you. Each fact has a unique key (like `preferred_language` or `editor`) and a value. The system updates facts when they change, so outdated information gets replaced automatically.

**Patterns** capture recurring behaviors or preferences. Examples include "frequently works on Linux server administration" or "writes concise commit messages." Like facts, patterns use keys to avoid duplicates.

**Episodic memories** store notable interactions as free-form text, such as "On 1 June, configured X for Y." These entries support semantic search through vector embeddings, letting the system find relevant past conversations even when you ask about them differently.

### Extraction

The extraction process runs after each chat completes. A dedicated AI model reviews the conversation and decides what, if anything, is worth keeping. It deliberately ignores:

- Temporary requests
- Coding assistance
- Debugging sessions
- One-off questions

The system only stores information that is genuinely about you and likely to remain true across sessions.

If you enable semantic retrieval, episodic memories get embedded as vectors. The chat model and embedding model are decoupled, so you can run expensive chat inferences on one provider while using a cheaper, faster endpoint for embeddings. The embedding provider resolution follows a priority chain:

1. First checks for an explicit dedicated embedding model
2. Falls back to the main chat model if that provider supports embeddings
3. Finally walks the configured provider chain to find any provider that exposes embedding capabilities

### Retrieval

When you send a new request, the system retrieves relevant memories before building the prompt. Facts and patterns are always included if they exist. Episodic memories work differently:

- **With semantic retrieval enabled**: The system embeds your query and performs a cosine similarity search against stored episodic vectors. It returns the top K matches that exceed a similarity threshold (default 0.65).

- **Without semantic retrieval**: It falls back to keyword search using SQLite's full-text search index.

The system tracks access counts and timestamps for all memories. When episodic storage hits the configured cap (default 50 entries), it evicts the least useful ones using a scoring formula that balances:

- Access frequency
- Recency (how recently the memory was used)

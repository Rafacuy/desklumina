# API Reference

This document outlines the internal TypeScript APIs used within DeskLumina.

## Contents

- [Core API](#core-api)
- [Agent API](#agent-api)
- [Result Store API](#result-store-api)
- [Tool Contracts](#tool-contracts)
- [Error Classification](#error-classification)

## Core API

`src/core/lumina.ts`

### `Lumina.chat(userMessage: string)`

The primary orchestrator. Kicks off the ReAct agent loop, manages context preparation, and returns the final synthesized response.

## Agent API

`src/agent/agent.ts`

### `runAgent(baseMessages: AIMessage[], options?: AgentRunOptions)`

Executes the ReAct loop up to a turn limit. Handles tool dispatch, signal detection (`[[DONE]]`, `[[FAIL]]`), and token boundary management. Returns an `AgentResult` object containing the final response, a flattened list of all tool results, and the exact terminal signal that ended the loop.

## Result Store API

`src/tools/result-store.ts`

Tracks non-blocking background operations.

| Function | Description |
| --- | --- |
| `registerPending(op)` | Logs a fire-and-forget task |
| `complete(id, result)` | Marks the task finished |
| `drainCompleted()` | Flushes completed tasks into the context window at the start of the next agent turn |

## Tool Contracts

`src/tools/contracts/contracts.ts`

DeskLumina generates system prompts deterministically from `ToolContract` interfaces. A contract defines the tool's schema, required arguments, escaping rules, and failure behaviors (e.g. `retriable` vs `nonRetriable` errors and a `retryLimit`).

All registered tool handlers must implement the `(arg: string) => Promise<ToolExecutionResult>` signature.

## Error Classification

`src/ui/error-classify.ts`

Maps arbitrary thrown errors into a seven-category taxonomy to populate the Rofi error panel with actionable suggestions and localized strings.

| Category | Meaning |
| --- | --- |
| `network` | Request could not reach the provider |
| `provider` | Provider returned an unexpected response |
| `model` | The specified model is unavailable or deprecated |
| `auth` | API key missing, invalid, or expired |
| `ratelimit` | Provider rate limit exceeded |
| `timeout` | Request exceeded the allowed response time |
| `unknown` | Unclassified error; see raw trace for details |

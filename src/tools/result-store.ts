import { logger } from "../logger";
import type { PendingOperation, CompletedOperation, ToolResult } from "../types";

class ResultStore {
  private pending = new Map<string, PendingOperation>();
  private completed = new Map<string, CompletedOperation>();

  registerPending(op: PendingOperation): void {
    this.pending.set(op.id, op);
    logger.info("result-store", `Registered pending: ${op.id} (${op.tool})`);
  }

  complete(operationId: string, result: ToolResult): void {
    const pending = this.pending.get(operationId);
    if (!pending) {
      logger.warn("result-store", `Unknown operation: ${operationId}`);
      return;
    }

    this.pending.delete(operationId);
    this.completed.set(operationId, {
      id: operationId,
      tool: pending.tool,
      arg: pending.arg,
      startedAt: pending.startedAt,
      completedAt: Date.now(),
      status: result.success === false ? "failure" : "success",
      result,
    });

    logger.info("result-store",
      `Completed: ${operationId} (${pending.tool}) — ${result.success === false ? "failure" : "success"}`
    );
  }

  drainCompleted(): CompletedOperation[] {
    const ops = Array.from(this.completed.values());
    this.completed.clear();
    return ops;
  }

  peekCompleted(): CompletedOperation[] {
    return Array.from(this.completed.values());
  }

  getPending(): PendingOperation[] {
    return Array.from(this.pending.values());
  }

  async shutdown(): Promise<void> {
    for (const [id, op] of this.pending) {
      logger.warn("result-store", `Pending operation abandoned on shutdown: ${id} (${op.tool})`);
    }
    this.pending.clear();
    this.completed.clear();
  }
}

export const resultStore = new ResultStore();

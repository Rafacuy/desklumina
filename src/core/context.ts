import type { AIMessage } from "../types";

export class Context {
  private history: AIMessage[] = [];

  add(role: AIMessage["role"], content: string) {
    this.history.push({ role, content });
  }

  getMessages(): AIMessage[] {
    return this.history;
  }

  clear() {
    this.history = [];
  }
}

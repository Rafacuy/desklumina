type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class Context {
  private history: Message[] = [];

  add(role: Message["role"], content: string) {
    this.history.push({ role, content });
  }

  getMessages(): Message[] {
    return this.history;
  }

  clear() {
    this.history = [];
  }
}

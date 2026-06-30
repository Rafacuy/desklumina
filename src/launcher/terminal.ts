import { t, cleanAssistantResponse } from "../utils";
import { startLoader, stopLoader } from "../ui/loader";
import type { ToolCallbackPayload } from "../types";
import readline from "readline";

function appendCallbackText(target: string, callback?: ToolCallbackPayload): string {
  if (!callback?.text) return target;
  return target + callback.text;
}

export async function terminalChatMode(): Promise<void> {
  const { Lumina, ChatManager } = await import("../core");

  console.log(t("app.terminal_chat_mode"));
  console.log(t("app.terminal_chat_help"));

  const chatManager = new ChatManager();
  const lumina = new Lumina(chatManager);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    const currentChat = chatManager.getCurrentChat();
    const chatInfo = currentChat ? ` [${currentChat.title}]` : "";
    rl.question(`${t("common.you")}${chatInfo}: `, async (input: string) => {
      const trimmed = input.trim();

      if (trimmed === "exit") {
        console.log(t("app.goodbye"));
        rl.close();
        return;
      }

      if (trimmed === "new") {
        chatManager.createChat();
        console.log(t("app.new_chat_started"));
        prompt();
        return;
      }

      if (trimmed === "list") {
        const chats = chatManager.getAllChats();
        if (chats.length === 0) {
          console.log(t("app.no_chats"));
        } else {
          chats.forEach((chat, i) => {
            const active = chatManager.getCurrentChat()?.id === chat.id ? " *" : "";
            console.log(`${i + 1}. ${chat.title} (${chat.messageCount} msgs)${active}`);
          });
          console.log(t("app.load_chat_usage"));
        }
        prompt();
        return;
      }

      if (trimmed.startsWith("load ")) {
        const parts = trimmed.split(" ");
        const numStr = parts[1] || "0";
        const num = parseInt(numStr);
        const chats = chatManager.getAllChats();
        const targetChat = chats[num - 1];
        if (targetChat) {
          chatManager.loadChat(targetChat.id);
          console.log(`Loaded: ${targetChat.title}\n`);
        } else {
          console.log(t("app.invalid_chat_number"));
        }
        prompt();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      startLoader();
      let response = "";
      let toolOutput = "";
      await lumina.chat(trimmed, (chunk, callbackOutput) => {
        stopLoader();
        if (callbackOutput) {
          toolOutput = appendCallbackText(toolOutput, callbackOutput);
          return;
        }
        response += chunk;
        process.stdout.write(chunk);
      });

      const cleanToolOutput = cleanAssistantResponse(toolOutput);
      if (cleanToolOutput) {
        process.stdout.write(`\n${cleanToolOutput}`);
      }
      console.log("\n");
      prompt();
    });
  };

  prompt();
}

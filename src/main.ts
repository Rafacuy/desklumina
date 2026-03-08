#!/usr/bin/env bun
import { Lumina, ChatManager } from "./core";
import { rofiChatLoop } from "./ui";
import { startLoader, stopLoader } from "./ui/loader";
import { logger } from "./logger";
import { env } from "./config/env";

const args = process.argv.slice(2);
const mode = args[0];

async function main() {
  logger.info("main", "Lumina started");

  const chatManager = new ChatManager();
  const lumina = new Lumina(chatManager);

  if (mode === "--chat") {
    console.log("💫 Lumina Terminal Chat Mode");
    console.log("Type 'exit' to quit, 'new' for new chat, 'list' to see chats\n");

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      const currentChat = chatManager.getCurrentChat();
      const chatInfo = currentChat ? ` [${currentChat.title}]` : "";
      rl.question(`You${chatInfo}: `, async (input: string) => {
        const trimmed = input.trim();

        if (trimmed === "exit") {
          console.log("Goodbye! 👋");
          rl.close();
          return;
        }

        if (trimmed === "new") {
          chatManager.createChat();
          console.log("Started new chat.\n");
          prompt();
          return;
        }

        if (trimmed === "list") {
          const chats = chatManager.getAllChats();
          if (chats.length === 0) {
            console.log("No chats yet.\n");
          } else {
            chats.forEach((chat, i) => {
              const active = currentChat?.id === chat.id ? " *" : "";
              console.log(`${i + 1}. ${chat.title} (${chat.messages.length} msgs)${active}`);
            });
            console.log("\nUse 'load <number>' to switch chats.\n");
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
            console.log("Invalid chat number.\n");
          }
          prompt();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        chatManager.addMessage(trimmed, "user");

        startLoader();
        let response = "";
        await lumina.chat(trimmed, (chunk) => {
          stopLoader();
          response += chunk;
          process.stdout.write(chunk);
        });

        chatManager.addMessage(response, "assistant");
        console.log("\n");
        prompt();
      });
    };

    prompt();
  } else if (mode === "--exec") {
    const message = args.slice(1).join(" ");
    if (!message) {
      console.error("Usage: lumina --exec <message>");
      process.exit(1);
    }

    const response = await lumina.chat(message);
    console.log(response);
  } else if (mode === "--version") {
    console.log("Lumina v1.0.0");
    console.log(`Model: ${env.MODEL_NAME}`);
  } else {
    await rofiChatLoop(chatManager, async (message) => {
      let response = "";
      await lumina.chat(message, (chunk) => {
        response += chunk;
      });
      // Remove JSON tool call blocks and tool tags
      return response
        .replace(/```json\s*\n[\s\S]*?\n```/g, "")
        .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
        .trim() || "Done.";
    });
  }
}

main().catch((error) => {
  logger.fatal("main", error.message);
});

#!/usr/bin/env bun
import { t, tf, getAppVersion, cleanAssistantResponse } from "./utils";
import { Lumina, ChatManager } from "./core";
import { rofiChatLoop } from "./ui";
import { startLoader, stopLoader } from "./ui/loader";
import { logger } from "./logger";
import { env } from "./config/env";
import { DeskLuminaDaemon, DaemonClient } from "./daemon";
import type { ToolCallbackPayload } from "./types";

const args = process.argv.slice(2);
const mode = args[0];

function appendCallbackText(target: string, callback?: ToolCallbackPayload): string {
  if (!callback?.text) return target;
  return target + callback.text;
}

async function main() {
  logger.info("main", t("Lumina started"));

  const chatManager = new ChatManager();
  const lumina = new Lumina(chatManager);

  if (mode === "--daemon") {
    console.log(t("🔧 Starting DeskLumina daemon..."));
    const daemon = new DeskLuminaDaemon();
    await daemon.start();
    console.log(t("✓ Daemon started successfully"));
    console.log(t("Use 'lumina --send <command>' to send commands"));
    
    // Keep process alive
    process.stdin.resume();
  } else if (mode === "--send") {
    const command = args.slice(1).join(" ");
    if (!command) {
      console.error(t("Usage: lumina --send <command>"));
      process.exit(1);
    }

    const client = new DaemonClient();
    try {
      const response = await client.sendCommand(command);
      console.log(response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(t(`Error: ${err.message}`));
      process.exit(1);
    }
  } else if (mode === "--daemon-status") {
    const client = new DaemonClient();
    if (await client.isDaemonRunning()) {
      console.log(t("✓ Daemon is running"));
      console.log(t(`Socket: ${client.getSocketPath()}`));
    } else {
      console.log(t("✗ Daemon is not running"));
      console.log(t("Start with: lumina --daemon"));
    }
  } else if (mode === "--chat") {
    console.log(t("💫 Lumina Terminal Chat Mode"));
    console.log(t("Type 'exit' to quit, 'new' for new chat, 'list' to see chats\n"));

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
          console.log(t("Goodbye! 👋"));
          rl.close();
          return;
        }

        if (trimmed === "new") {
          chatManager.createChat();
          console.log(t("Started new chat.\n"));
          prompt();
          return;
        }

        if (trimmed === "list") {
          const chats = chatManager.getAllChats();
          if (chats.length === 0) {
            console.log(t("No chats yet.\n"));
          } else {
            chats.forEach((chat, i) => {
              const active = chatManager.getCurrentChat()?.id === chat.id ? " *" : "";
              console.log(`${i + 1}. ${chat.title} (${chat.messageCount} msgs)${active}`);
            });
            console.log(t("\nUse 'load <number>' to switch chats.\n"));
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
            console.log(t("Invalid chat number.\n"));
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

        if (toolOutput.trim()) {
          process.stdout.write(`\n${toolOutput.trim()}`);
        }
        console.log("\n");
        prompt();
      });
    };

    prompt();
  } else if (mode === "--exec") {
    const message = args.slice(1).join(" ");
    if (!message) {
      console.error(t("Usage: lumina --exec <message>"));
      process.exit(1);
    }

    chatManager.createChat(message);
    let response = "";
    let toolOutput = "";
    await lumina.chat(message, (chunk, callbackOutput) => {
      if (callbackOutput) {
        toolOutput = appendCallbackText(toolOutput, callbackOutput);
      } else {
        response += chunk;
      }
    });

    const cleanResponse = cleanAssistantResponse(response);

    const finalOutput = [cleanResponse, toolOutput.trim()].filter(Boolean).join("\n\n") || "Done.";
    console.log(finalOutput);
  } else if (mode === "--version") {
    const version = await getAppVersion();
    console.log(tf("Lumina v{version}", { version }));
    console.log(`Model: ${env.MODEL_NAME}`);
  } else {
    // Default: Rofi chat mode
    await rofiChatLoop(chatManager, async (message) => {
      let initialResponse = "";
      let callbackResponse = "";
      let toolDisplay = "";
      let sawToolCallback = false;
      
      await lumina.chat(message, (chunk, toolOutput) => {
        if (toolOutput) {
          sawToolCallback = true;
          toolDisplay = appendCallbackText(toolDisplay, toolOutput);
        } else {
          if (sawToolCallback) {
            callbackResponse += chunk;
          } else {
            initialResponse += chunk;
          }
        }
      });
      
      const cleanInitialResponse = cleanAssistantResponse(initialResponse);
      const cleanCallbackResponse = cleanAssistantResponse(callbackResponse);
      const cleanToolDisplay = toolDisplay.trim();

      const finalOutput = [cleanInitialResponse, cleanToolDisplay, cleanCallbackResponse]
        .filter(Boolean)
        .join("\n\n") || "Done.";
      
      return finalOutput;
    });
  }
}

main().catch((error) => {
  logger.fatal("main", error.message);
});

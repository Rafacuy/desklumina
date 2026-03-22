import { spawn } from "bun";
import type { ChatManager, Chat } from "../core/chat-manager";
import { t } from "../utils/i18n";

const THEME_PATH = `${process.env.HOME}/.config/bspwm/agent/src/ui/themes/lumina.rasi`;

export async function rofiChatInput(
  chatManager: ChatManager,
  prompt: string = "Lumina"
): Promise<{ action: "send" | "new" | "select" | "settings" | "exit"; input?: string }> {
  const currentChat = chatManager.getCurrentChat();
  const historyPreview = chatManager.getChatHistoryPreview(300);
  const toolContextPreview = chatManager.getToolContextPreview();
  
  const menuItems: string[] = [];
  
  // Show tool context first if available
  if (toolContextPreview) {
    menuItems.push(toolContextPreview);
    menuItems.push("──────────────────");
  }
  
  if (historyPreview) {
    menuItems.push(`── ${t("Recent Messages")} ──`);
    menuItems.push(historyPreview);
    menuItems.push("──────────────────");
  }
  
  menuItems.push(`💬 ${t("Send message")}`);
  menuItems.push(`📝 ${t("New Chat")}`);
  menuItems.push(`📂 ${t("Select Chat")}`);
  menuItems.push(`⚙️ ${t("Settings")}`);
  menuItems.push(`✕ ${t("Close")}`);

  const input = await rofiDmenu(menuItems.join("\n"), prompt);

  if (!input) {
    return { action: "exit" };
  }

  if (input === `💬 ${t("Send message")}`) {
    const message = await rofiSimpleInput(t("Message"), "");
    if (message) {
      return { action: "send", input: message };
    }
    return { action: "exit" };
  }

  if (input === `📝 ${t("New Chat")}`) {
    const message = await rofiSimpleInput(t("New Chat"), "");
    if (message) {
      chatManager.createChat(message);
      return { action: "send", input: message };
    }
    return { action: "new" };
  }

  if (input === `📂 ${t("Select Chat")}`) {
    return { action: "select" };
  }

  const settingsLabel = t("Settings");
  if (input === `⚙️ ${settingsLabel}` || input === "⚙️ Settings" || input === "⚙️ Pengaturan") {
    return { action: "settings" };
  }

  const closeLabel = t("Close");
  if (input === `✕ ${closeLabel}` || input === "✕ Close" || input === "✕ Tutup") {
    return { action: "exit" };
  }

  if (input.startsWith("You: ") || input.startsWith("Lumina: ") || input.startsWith("──") || input.startsWith("───") || input.startsWith("🔧") || input.startsWith("✓")) {
    const message = await rofiSimpleInput(t("Message"), "");
    if (message) {
      return { action: "send", input: message };
    }
    return { action: "exit" };
  }

  return { action: "send", input };
}

export async function rofiSelectChat(chatManager: ChatManager): Promise<string | null> {
  const chats = chatManager.getAllChats();
  
  if (chats.length === 0) {
    await rofiDisplay(t("No chats yet.\nStart a new conversation!"));
    return null;
  }

  const items = chats.map((chat: Chat) => {
    const date = new Date(chat.updatedAt).toLocaleDateString();
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg
      ? lastMsg.content.substring(0, 40)
      : t("Empty chat");
    return `${chat.title} | ${date} | ${chat.messages.length} msgs | "${preview}..."`;
  });

  items.push("─".repeat(30));
  items.push(`📝 ${t("New Chat")}`);
  items.push(`✕ ${t("Cancel")}`);

  const selected = await rofiDmenu(items.join("\n"), t("Select Chat"));

  if (!selected || selected === `✕ ${t("Cancel")}`) {
    return null;
  }

  if (selected === `📝 ${t("New Chat")}`) {
    return "__new__";
  }

  const chatTitle = selected.split(" | ")[0];
  const chat = chats.find((c: Chat) => c.title === chatTitle);
  
  if (!chat) return null;
  return chat.id;
}

export async function rofiSimpleInput(prompt: string, placeholder: string = ""): Promise<string> {
  const proc = spawn([
    "rofi", "-dmenu", "-p", prompt, 
    "-theme", THEME_PATH,
    "-theme-str", `entry { placeholder: "${placeholder}"; }`
  ], {
    stdin: "pipe",
    stdout: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;
  
  return output.trim();
}

async function rofiDmenu(items: string, prompt: string = "Lumina"): Promise<string> {
  const proc = spawn([
    "rofi", "-dmenu", "-p", prompt,
    "-theme", THEME_PATH,
    "-i"
  ], {
    stdin: "pipe",
    stdout: "pipe",
  });

  proc.stdin.write(items);
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;
  
  return output.trim();
}

export async function rofiDisplay(message: string): Promise<void> {
  const formattedMessage = `💫 Lumina\n${"─".repeat(60)}\n\n${message}`;
  
  const proc = spawn([
    "rofi", "-e", formattedMessage,
    "-theme", THEME_PATH,
    "-theme-str", `
      window {
        width: 700px;
        height: 500px;
        border-radius: 12px;
        border: 2px solid;
        border-color: #3b82f6;
        background-color: #ffffff;
      }
      mainbox {
        children: [textbox];
        padding: 24px 28px;
        background-color: transparent;
      }
      textbox {
        background-color: transparent;
        text-color: #1f2937;
        font: "JetBrainsMono Nerd Font 10";
        expand: true;
        vertical-align: 0.0;
      }
    `
  ], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  
  await proc.exited;
}

export async function rofiChatLoop(
  chatManager: ChatManager,
  onMessage: (message: string) => Promise<string>
): Promise<void> {
  while (true) {
    const result = await rofiChatInput(chatManager);

    switch (result.action) {
      case "exit":
        return;

      case "send":
        if (result.input) {
          chatManager.addMessage(result.input, "user");
          const response = await onMessage(result.input);
          
          // Show response in Rofi window
          if (response && response !== "Done.") {
            await rofiDisplay(response);
          }
        }
        break;

      case "select":
        const chatId = await rofiSelectChat(chatManager);
        if (chatId === "__new__") {
          chatManager.createChat();
        } else if (chatId) {
          chatManager.loadChat(chatId);
        }
        break;

      case "settings":
        const { rofiSettings } = await import("./settings");
        await rofiSettings();
        break;

      case "new":
        chatManager.createChat();
        break;
    }
  }
}

export async function rofiInput(prompt: string = "Lumina"): Promise<string> {
  return rofiSimpleInput(prompt, "");
}

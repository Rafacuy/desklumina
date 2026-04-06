import { spawn } from "bun";
import type { ChatManager, Chat } from "../core/chat-manager";
import { t } from "../utils/i18n";
import { CancellationError } from "../types";
import { logger } from "../logger";

const THEME_PATH = `${process.env.HOME}/.config/desklumina/src/ui/themes/lumina.rasi`;

export async function rofiChatInput(
  chatManager: ChatManager,
  prompt: string = "Lumina",
  isExpanded: boolean = false
): Promise<{ action: "send" | "new" | "select" | "settings" | "expand_toggle" | "exit"; input?: string }> {
  const currentChat = chatManager.getCurrentChat();
  const historyPreview = chatManager.getChatHistoryPreview(400);

  const menuItems: string[] = [];

  if (isExpanded) {
    // Show management options in expanded mode
    if (historyPreview) {
      menuItems.push(`── ${t("Recent Messages")} ──`);
      menuItems.push(historyPreview);
      menuItems.push("──────────────────");
    }

    menuItems.push(`📂 ${t("Select Chat")}`);
    menuItems.push(`⚙️ ${t("Settings")}`);
    menuItems.push(`✕ ${t("Close")}`);
  }

  const themeOverride = isExpanded 
    ? "" 
    : "listview { enabled: false; } mainbox { children: [inputbar, message]; }";
    
    const hints = isExpanded
    ? `󰌑 ${t("Send")} │ 󱊷 [ESC] ${t("Exit")} │ 󰌓 [TAB] ${t("Hide")}`
    : `󰌑 ${t("Send")} │ 󱊷 [ESC] ${t("Exit")} │ 󰌓 [TAB] ${t("Expand")}`;

  const result = await rofiMenu(
    menuItems.join("\n"), 
    prompt,
    themeOverride,
    t("Type your message..."),
    hints
  );

  if (result.code === 10) { // TAB pressed
    return { action: "expand_toggle" };
  }

  const input = result.output;

  if (!input || result.code !== 0) {
    return { action: "exit" };
  }

  if (isExpanded) {
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

    if (input.startsWith("󱜙 You:") || input.startsWith("󱜙 Lumina:") || input.startsWith("──")) {
      // If user clicks a history item, treat it as wanting to send a new message
      const message = await rofiSimpleInput(t("Message"), "");
      if (message) {
        return { action: "send", input: message };
      }
      return { action: "exit" };
    }
  }

  return { action: "send", input };
}

export async function rofiSelectChat(chatManager: ChatManager): Promise<string | null> {
  const chats = chatManager.getAllChats();
  
  if (chats.length === 0) {
    await rofiDisplay(t("No chats yet.\nStart a new conversation!"));
    return null;
  }

  const items: string[] = [];
  
  // Clean Header
  items.push(`󰗋 ${t("Select Chat")}`);
  items.push("──────────────────");
  
  const chatItems = chats.map((chat: Chat) => {
    const date = new Date(chat.updatedAt).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg
      ? lastMsg.content.substring(0, 30).replace(/\n/g, " ")
      : t("Empty chat");
      
    // Format: 󰭹 Title [Date] (Count) - Preview...
    return `󰭹 ${chat.title.padEnd(20)} │ 󰃭 ${date} │ 󰅒 ${chat.messages.length} │ ${preview}...`;
  });
  
  items.push(...chatItems);
  items.push("──────────────────");
  items.push(`📝 ${t("New Chat")}`);
  items.push(`✕ ${t("Cancel")}`);

  const result = await rofiMenu(
    items.join("\n"), 
    t("Select Chat"), 
    "listview { lines: 12; }",
    t("Search chat..."),
    `󰌑 ${t("Select")} │ 󱊷 ${t("Cancel")} │ 󰍉 ${t("Search")}`
  );

  if (!result.output || result.code !== 0 || result.output === `✕ ${t("Cancel")}` || result.output.includes(t("Select Chat"))) {
    return null;
  }

  const selected = result.output;

  if (selected.includes("──────────────────")) {
    return rofiSelectChat(chatManager);
  }

  if (selected === `📝 ${t("New Chat")}`) {
    return "__new__";
  }

  // Extract title by getting everything before the first │
  const chatTitle = selected.split(" │ ")[0]?.replace("󰭹 ", "").trim();
  const chat = chats.find((c: Chat) => c.title === chatTitle);
  
  if (!chat) return null;
  return chat.id;
}

/**
 * Generic Rofi menu helper for consistent styling
 */
export async function rofiMenu(
  items: string, 
  prompt: string = "Lumina", 
  themeOverride: string = "",
  placeholder: string = "",
  hints: string = ""
): Promise<{ output: string | null; code: number }> {
  const args = [
    "rofi", 
    "-dmenu", 
    "-i", 
    "-p", prompt, 
    "-theme", THEME_PATH,
    "-kb-mode-next", "",
    "-kb-row-tab", "",
    "-kb-element-next", "",
    "-kb-custom-1", "Tab"
  ];
  
  if (hints) {
    args.push("-mesg", hints);
  }
  
  let finalTheme = themeOverride;
  if (placeholder) {
    finalTheme += ` entry { placeholder: "${placeholder}"; }`;
  }

  if (finalTheme) {
    args.push("-theme-str", finalTheme);
  }

  const proc = spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
  });

  proc.stdin.write(items);
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  const code = await proc.exited;
  
  return { 
    output: output.trim() || null, 
    code 
  };
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
  const args = [
    "rofi", "-dmenu", "-i", "-p", prompt, 
    "-theme", THEME_PATH, 
    "-mesg", `󰌑 ${t("Send")} │ 󱊷 ${t("Exit")} │ 󰍉 ${t("Search")}`
  ];

  const proc = spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
  });

  proc.stdin.write(items);
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;
  
  return output.trim();
}

// Rofi dmenu without prompt bar - only shows listview
async function rofiDmenuNoPrompt(items: string): Promise<string> {
  const themeStr = 'mainbox { children: [listview]; }';
  
  const proc = spawn([
    "rofi", "-dmenu", "-i",
    "-theme", THEME_PATH,
    "-theme-str", themeStr
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
  // Clean up the message - remove any existing separators for consistent formatting
  const cleanMessage = message
    .replace(/^━+$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();

  const formattedMessage = `󱜙 ${t("Lumina")}\n${"─".repeat(40)}\n\n${cleanMessage}`;

  const proc = spawn([
    "rofi", "-e", formattedMessage,
    "-theme", THEME_PATH,
    "-theme-str", `
      window {
        width: 500px;
        height: 400px;
        border-radius: 12px;
        border: 1px solid;
        border-color: @border-subtle;
        background-color: @bg;
      }
      mainbox {
        children: [textbox];
        padding: 24px;
        background-color: transparent;
      }
      textbox {
        background-color: transparent;
        text-color: @text-primary;
        font: "JetBrainsMono Nerd Font 10";
        expand: true;
        vertical-align: 0.5;
        horizontal-align: 0.5;
        padding: 0;
        margin: 0;
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
  let isExpanded = false;
  
  while (true) {
    const result = await rofiChatInput(chatManager, "Lumina", isExpanded);

    switch (result.action) {
      case "exit":
        return;

      case "expand_toggle":
        isExpanded = !isExpanded;
        break;

      case "send":
        if (result.input) {
          const userMessageIndex = chatManager.getCurrentChat()?.messages.length || 0;
          chatManager.addMessage(result.input, "user");
          try {
            const response = await onMessage(result.input);
            
            // Show response in Rofi window
            if (response && response !== "Done.") {
              await rofiDisplay(response);
            }
          } catch (error) {
            const isCancellation = 
              error instanceof CancellationError || 
              (error && typeof error === 'object' && 'name' in error && error.name === "CancellationError") ||
              (error instanceof Error && error.message.includes("cancelled by user"));

            if (isCancellation) {
              logger.info("ui", "Cancellation detected, intercepting and hiding response panel");
              
              // Interceptor: Hide AI response and remove cancelled interaction from history
              // Remove everything from the user message onwards
              const currentChat = chatManager.getCurrentChat();
              if (currentChat) {
                const messagesToRemove = currentChat.messages.length - userMessageIndex;
                logger.debug("ui", `Removing ${messagesToRemove} messages from history (undo)`);
                for (let i = 0; i < messagesToRemove; i++) {
                  chatManager.removeLastMessage();
                }
              }
              break;
            }
            logger.error("ui", `Error in onMessage: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
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

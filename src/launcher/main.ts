import { t, tf, getAppVersion, cleanAssistantResponse } from "../utils";
import { logger } from "../logger";
import type { ToolCallbackPayload } from "../types";
import { CancellationError, ChatRequestError } from "../types";

const FALLBACK_DELAY_MS = Number(Bun.env.DESKLUMINA_FALLBACK_DELAY_MS) || 250;

function appendCallbackText(target: string, callback?: ToolCallbackPayload): string {
  if (!callback?.text) return target;
  return target + callback.text;
}

async function execMode(args: string[]): Promise<void> {
  const message = args.slice(1).join(" ");
  if (!message) {
    console.error(t("app.usage_exec"));
    process.exit(1);
  }

  const { Lumina, ChatManager } = await import("../core");
  const chatManager = new ChatManager();
  const lumina = new Lumina(chatManager);

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
  const cleanToolOutput = cleanAssistantResponse(toolOutput);

  const finalOutput = [cleanResponse, cleanToolOutput].filter(Boolean).join("\n\n") || "Done.";
  console.log(finalOutput);
}

async function providerMode(args: string[]): Promise<void> {
  const { validateOrExit, modelConfig } = await import("../config/env");
  validateOrExit();

  const subCommand = args[1];

  if (subCommand === "current") {
    const primaryModel = modelConfig.primaryModel;

    if (!primaryModel || !primaryModel.includes(":")) {
      console.log("  Model: not configured");
      console.log("  Set DESKLUMINA_MODEL or create models.json (format: provider:model)");
      return;
    }

    const colonIdx = primaryModel.indexOf(":");
    const providerSegment = primaryModel.slice(0, colonIdx);
    const modelSegment = primaryModel.slice(colonIdx + 1);

    try {
      const { providerRegistry, modelRegistry } = await import("../ai/registry");
      providerRegistry.initialize();

      const resolved = modelRegistry.resolveModels(primaryModel, []);
      if (resolved.length > 0) {
        console.log(`  Provider: ${resolved[0]!.providerId}`);
        console.log(`  Model:    ${resolved[0]!.modelId}`);
        if (modelConfig.fallbackModels.length > 0) {
          console.log(`  Fallbacks:`);
          for (const fb of modelConfig.fallbackModels) {
            const fbColon = fb.indexOf(":");
            if (fbColon > 0) {
              console.log(`    ${fb.slice(0, fbColon)}: ${fb.slice(fbColon + 1)}`);
            }
          }
        }
      } else {
        console.log(`  Provider: ${providerSegment}`);
        console.log(`  Model:    ${modelSegment}`);
        console.log(`  Status:   provider not available (missing API key or not registered)`);
      }
    } catch (e) {
      console.log(`  Provider: ${providerSegment}`);
      console.log(`  Model:    ${modelSegment}`);
      console.log(`  Error:    ${(e as Error).message}`);
    }
  } else if (subCommand === "list") {
    const { providerRegistry } = await import("../ai/registry");
    providerRegistry.initialize();

    const providers = providerRegistry.list();
    if (providers.length === 0) {
      console.log("  No providers registered.");
      console.log("  Set at least one API key: GROQ_API_KEY, OPENAI_API_KEY,");
      console.log("  ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, or HF_API_KEY");
    } else {
      console.log("  Registered providers:");
      for (const p of providers) {
        console.log(`    ${p.id} (${p.name})`);
      }
    }
  } else {
    console.error("Usage:");
    console.error("  bun start provider current");
    console.error("  bun start provider list");
    process.exit(1);
  }
}

async function versionMode(): Promise<void> {
  const { modelConfig } = await import("../config/env");
  const version = await getAppVersion();
  console.log(tf("app.version", { version }));
  console.log(`Model: ${modelConfig.primaryModel || "not configured"}`);
}

async function rofiMode(): Promise<void> {
  const { settingsManager } = await import("../core/services/settings-manager");

  const { setThemeMode } = await import("../ui/theme-cache");
  setThemeMode(settingsManager.getDarkMode() ? "dark" : "light");
  await Bun.sleep(FALLBACK_DELAY_MS);

  const { Lumina, ChatManager } = await import("../core");
  const { rofiChatLoop } = await import("../ui");

  const chatManager = new ChatManager();
  const lumina = new Lumina(chatManager);

  await rofiChatLoop(chatManager, async (message) => {
    let initialResponse = "";
    let callbackResponse = "";
    let toolDisplay = "";
    let sawToolCallback = false;

    try {
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
      }, () => {});

      const cleanInitialResponse = cleanAssistantResponse(initialResponse);
      const cleanCallbackResponse = cleanAssistantResponse(callbackResponse);
      const cleanToolDisplay = cleanAssistantResponse(toolDisplay);

      const finalOutput = [cleanInitialResponse, cleanToolDisplay, cleanCallbackResponse]
        .filter(Boolean)
        .join("\n\n") || "Done.";

      return finalOutput;
    } catch (error) {
      if (error instanceof CancellationError) throw error;
      throw new ChatRequestError(error);
    }
  });
}

export async function launcherMain(args: string[]): Promise<void> {
  const mode = args[0];

  switch (mode) {
    case "--chat":
      const { terminalChatMode } = await import("./terminal");
      return terminalChatMode();
    case "--exec":
      return execMode(args);
    case "provider":
      return providerMode(args);
    case "--version":
      return versionMode();
    default:
      return rofiMode();
  }
}

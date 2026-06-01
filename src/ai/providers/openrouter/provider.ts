import { OPENROUTER_API_ENDPOINT } from "../../../constants";
import { OpenAICompatibleAdapter } from "../../transport/openai-compatible";

export const OPENROUTER_PROVIDER_ID = "openrouter" as const;

export class OpenRouterProvider extends OpenAICompatibleAdapter {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      provider: OPENROUTER_PROVIDER_ID,
      name: "OpenRouter",
      baseUrl: OPENROUTER_API_ENDPOINT,
      apiKey,
      fetchImpl,
      extraHeaders: {
        "HTTP-Referer": "https://desklumina.local",
        "X-Title": "DeskLumina",
      },
    });
  }
}

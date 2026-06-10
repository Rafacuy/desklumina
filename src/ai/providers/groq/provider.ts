import { GROQ_API_ENDPOINT } from "../../../constants";
import { OpenAICompatibleAdapter } from "../../transport/openai-compatible";

export const GROQ_PROVIDER_ID = "groq" as const;

export class GroqProvider extends OpenAICompatibleAdapter {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      provider: GROQ_PROVIDER_ID,
      name: "Groq",
      baseUrl: GROQ_API_ENDPOINT,
      apiKey,
      fetchImpl,
    });
  }

  protected override supportsEmbeddings(): boolean {
    return false;
  }
}

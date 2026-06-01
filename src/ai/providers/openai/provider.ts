import { OPENAI_API_ENDPOINT } from "../../../constants";
import { OpenAICompatibleAdapter } from "../../transport/openai-compatible";

export const OPENAI_PROVIDER_ID = "openai" as const;

export class OpenAIProvider extends OpenAICompatibleAdapter {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      provider: OPENAI_PROVIDER_ID,
      name: "OpenAI",
      baseUrl: OPENAI_API_ENDPOINT,
      apiKey,
      fetchImpl,
    });
  }
}

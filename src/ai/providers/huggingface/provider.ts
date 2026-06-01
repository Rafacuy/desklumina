import { HF_API_ENDPOINT } from "../../../constants";
import { OpenAICompatibleAdapter } from "../../transport/openai-compatible";

export const HF_PROVIDER_ID = "huggingface" as const;

export class HuggingFaceProvider extends OpenAICompatibleAdapter {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      provider: HF_PROVIDER_ID,
      name: "Hugging Face",
      baseUrl: HF_API_ENDPOINT,
      apiKey,
      fetchImpl,
    });
  }
}

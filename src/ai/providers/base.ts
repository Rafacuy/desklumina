import type { AIProvider, ProviderCapability, ProviderId, ProviderRequest, ProviderStreamChunk, ProviderValidationResult } from "../types";

export abstract class BaseProvider implements AIProvider {
  constructor(
    public readonly id: ProviderId,
    public readonly name: string
  ) {}

  abstract streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk>;
  abstract validateConfig(): ProviderValidationResult;
  abstract capabilities(): ProviderCapability;
}

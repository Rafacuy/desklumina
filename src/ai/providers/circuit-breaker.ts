import type { ProviderId } from "../types";

export class CircuitBreaker {
  private state = new Map<ProviderId, { failures: number; until: number }>();

  recordFailure(providerId: ProviderId): void {
    const current = this.state.get(providerId) ?? { failures: 0, until: 0 };
    current.failures += 1;

    const baseBackoff = Math.min(30 * Math.pow(2, current.failures), 600);
    const jitter = Math.random() * 5;
    const backoffSeconds = baseBackoff + jitter;

    current.until = Date.now() + backoffSeconds * 1000;
    this.state.set(providerId, current);
  }

  recordSuccess(providerId: ProviderId): void {
    this.state.delete(providerId);
  }

  isHealthy(providerId: ProviderId): boolean {
    const current = this.state.get(providerId);
    if (!current) return true;
    return Date.now() > current.until;
  }

  reset(): void {
    this.state.clear();
  }
}

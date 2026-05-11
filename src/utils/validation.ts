import { logger } from "../logger";

/**
 * Validation utility for environment and API configurations.
 */
export class Validation {
  /**
   * Validate a Groq API key format.
   * Groq keys typically start with 'gsk_'.
   */
  static isValidGroqKey(key: string | undefined): boolean {
    if (!key) return false;
    // Basic check for Groq API key format
    return key.startsWith("gsk_") && key.length > 40;
  }

  /**
   * Ensure environment variables are present and valid.
   * Throws informative errors instead of exiting process.
   */
  static validateEnv(env: Record<string, string | undefined>): void {
    const missing: string[] = [];

    if (!env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
    if (!env.MODEL_NAME) missing.push("MODEL_NAME");

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
        `Please check your .env file or environment configuration.`
      );
    }

    if (env.GROQ_API_KEY && !this.isValidGroqKey(env.GROQ_API_KEY)) {
      logger.warn("validation", "GROQ_API_KEY does not match expected format (gsk_...). It might be invalid.");
    }
  }
}

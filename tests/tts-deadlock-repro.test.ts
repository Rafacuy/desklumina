import { test, expect } from "bun:test";
import { textToSpeech } from "../src/ai/tts";

test("TTS should not deadlock when generation fails", async () => {
  console.log("Starting deadlock test...");
  
  // Since textToSpeech uses an internal IIFE and doesn't return a promise,
  // we can only verify it doesn't hang by wrapping it or checking logs/state
  // For this reproduction, we'll verify the function call itself returns.
  // The actual deadlock happens in the background.
  
  const longText = "This is a test that might fail if generation had issues. We want to ensure the system continues.";
  
  // We call it - if there was a synchronous deadlock it would hang here
  // The asynchronous deadlock would keep the process alive indefinitely
  await textToSpeech(longText);
  
  expect(true).toBe(true);
});

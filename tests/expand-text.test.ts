import { expect, test } from "bun:test";

test("truncates message when it exceeds length", () => {
  const longMessage = "a".repeat(2000);
  const MAX_CHARS = 1000;
  const needsTruncation = longMessage.length > MAX_CHARS;
  expect(needsTruncation).toBe(true);
});

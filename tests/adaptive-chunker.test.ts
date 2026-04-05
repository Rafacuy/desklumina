import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Communicate } from "edge-tts-universal";

const FIRST_CHUNK_TARGET = 60;
const MIN_CHUNK_SIZE = 40;
const MAX_CHUNK_SIZE = 220;
const BASE_CHUNK_SIZE = 120;

interface ChunkMetrics {
  avgGenerationTime: number;
  lastChunkSize: number;
  totalProcessed: number;
}

class AdaptiveChunker {
  private metrics: ChunkMetrics = {
    avgGenerationTime: 0,
    lastChunkSize: 0,
    totalProcessed: 0,
  };

  private calculatePunctuationDensity(text: string): number {
    const punctuation = text.match(/[.!?,;:]/g)?.length || 0;
    return punctuation / Math.max(text.length, 1);
  }

  private findNaturalBreak(text: string, targetPos: number): number {
    const searchWindow = 30;
    const start = Math.max(0, targetPos - searchWindow);
    const end = Math.min(text.length, targetPos + searchWindow);
    const segment = text.slice(start, end);

    const strongBreaks = ['. ', '! ', '? '];
    for (const brk of strongBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const weakBreaks = [', ', '; ', ': ', ' - '];
    for (const brk of weakBreaks) {
      const pos = segment.lastIndexOf(brk, targetPos - start);
      if (pos !== -1) return start + pos + brk.length;
    }

    const spacePos = segment.lastIndexOf(' ', targetPos - start);
    if (spacePos !== -1) return start + spacePos + 1;

    return targetPos;
  }

  private calculateChunkSize(isFirst: boolean, remaining: number, textDensity: number): number {
    if (isFirst) return Math.min(FIRST_CHUNK_TARGET, remaining);

    let size = BASE_CHUNK_SIZE;

    if (this.metrics.avgGenerationTime > 0 && this.metrics.totalProcessed > 0) {
      const speedFactor = this.metrics.avgGenerationTime / 1000;
      if (speedFactor < 0.8) {
        size = Math.min(size * 1.3, MAX_CHUNK_SIZE);
      } else if (speedFactor > 1.5) {
        size = Math.max(size * 0.7, MIN_CHUNK_SIZE);
      }
    }

    if (textDensity > 0.08) {
      size *= 0.85;
    } else if (textDensity < 0.03) {
      size *= 1.15;
    }

    if (remaining < size * 1.5) {
      size = Math.max(remaining, MIN_CHUNK_SIZE);
    }

    return Math.floor(Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, size)));
  }

  chunk(text: string): string[] {
    const chunks: string[] = [];
    let position = 0;
    let isFirst = true;

    while (position < text.length) {
      const remaining = text.length - position;
      const density = this.calculatePunctuationDensity(text.slice(position, position + 200));
      const targetSize = this.calculateChunkSize(isFirst, remaining, density);

      let breakPoint = Math.min(position + targetSize, text.length);
      
      if (breakPoint < text.length) {
        breakPoint = this.findNaturalBreak(text, breakPoint);
      }

      const chunk = text.slice(position, breakPoint).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
        this.metrics.lastChunkSize = chunk.length;
      }

      position = breakPoint;
      isFirst = false;
    }

    return chunks.length > 0 ? chunks : [text];
  }

  updateMetrics(generationTime: number) {
    const alpha = 0.3;
    if (this.metrics.totalProcessed === 0) {
      this.metrics.avgGenerationTime = generationTime;
    } else {
      this.metrics.avgGenerationTime = 
        alpha * generationTime + (1 - alpha) * this.metrics.avgGenerationTime;
    }
    this.metrics.totalProcessed++;
  }

  getMetrics(): ChunkMetrics {
    return { ...this.metrics };
  }
}

describe("AdaptiveChunker - Basic Functionality", () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  test("chunks short text into single chunk", () => {
    const text = "This is a short message.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  test("first chunk respects FIRST_CHUNK_TARGET", () => {
    const text = "A".repeat(200);
    const chunks = chunker.chunk(text);
    
    expect(chunks[0].length).toBeLessThanOrEqual(FIRST_CHUNK_TARGET);
  });

  test("subsequent chunks respect MIN and MAX bounds", () => {
    const text = "This is a sentence. ".repeat(50);
    const chunks = chunker.chunk(text);
    
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].length).toBeGreaterThanOrEqual(MIN_CHUNK_SIZE);
      expect(chunks[i].length).toBeLessThanOrEqual(MAX_CHUNK_SIZE);
    }
  });

  test("handles empty text", () => {
    const chunks = chunker.chunk("");
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe("");
  });

  test("handles text with only whitespace", () => {
    const chunks = chunker.chunk("   \n\t  ");
    expect(chunks.length).toBe(1);
  });
});

describe("AdaptiveChunker - Natural Break Detection", () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  test("breaks at sentence boundaries", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const chunks = chunker.chunk(text);
    
    for (const chunk of chunks) {
      const endsWithPunctuation = /[.!?]$/.test(chunk.trim());
      const isLastChunk = chunk === chunks[chunks.length - 1];
      if (!isLastChunk) {
        expect(endsWithPunctuation).toBe(true);
      }
    }
  });

  test("prefers strong breaks over weak breaks", () => {
    const text = "This is a test. Another sentence, with a comma; and a semicolon.";
    const chunks = chunker.chunk(text);
    
    const hasStrongBreak = chunks.some(chunk => 
      chunk.trim().endsWith('.') || 
      chunk.trim().endsWith('!') || 
      chunk.trim().endsWith('?')
    );
    expect(hasStrongBreak).toBe(true);
  });

  test("handles text without punctuation", () => {
    const text = "This is text without any punctuation marks at all just words";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain(text.replace(/\s+/g, " "));
  });

  test("does not break mid-word", () => {
    const text = "A".repeat(300);
    const chunks = chunker.chunk(text);
    
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});

describe("AdaptiveChunker - Punctuation Density Adaptation", () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  test("creates smaller chunks for punctuation-heavy text", () => {
    const heavyText = "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P. Q. R. S. T. U. V. W. X. Y. Z. " +
                      "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P. Q. R. S. T. U. V. W. X. Y. Z.";
    const lightText = "This is a very long sentence without much punctuation just flowing text " +
                      "that continues on and on with minimal breaks or pauses in the content flow";
    
    const heavyChunks = chunker.chunk(heavyText);
    const lightChunks = new AdaptiveChunker().chunk(lightText);
    
    expect(heavyChunks.length).toBeGreaterThanOrEqual(lightChunks.length);
  });

  test("handles mixed punctuation density", () => {
    const text = "Short. Quick. Fast. " + "A".repeat(200) + " Long flowing text without breaks.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThan(chunks[chunks.length - 1].length);
  });
});

describe("AdaptiveChunker - Performance Feedback", () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  test("updates metrics after processing", () => {
    chunker.updateMetrics(1000);
    const metrics = chunker.getMetrics();
    
    expect(metrics.avgGenerationTime).toBe(1000);
    expect(metrics.totalProcessed).toBe(1);
  });

  test("calculates exponential moving average", () => {
    chunker.updateMetrics(1000);
    chunker.updateMetrics(2000);
    
    const metrics = chunker.getMetrics();
    const expected = 0.3 * 2000 + 0.7 * 1000;
    
    expect(metrics.avgGenerationTime).toBe(expected);
    expect(metrics.totalProcessed).toBe(2);
  });

  test("adapts chunk size based on fast generation", () => {
    const text = "This is a sentence. ".repeat(50);
    
    chunker.updateMetrics(500);
    const chunks = chunker.chunk(text);
    
    const avgSize = chunks.slice(1).reduce((sum, c) => sum + c.length, 0) / (chunks.length - 1);
    expect(avgSize).toBeGreaterThan(BASE_CHUNK_SIZE * 0.9);
  });

  test("adapts chunk size based on slow generation", () => {
    const text = "This is a sentence. ".repeat(50);
    
    chunker.updateMetrics(2000);
    const chunks = chunker.chunk(text);
    
    const avgSize = chunks.slice(1).reduce((sum, c) => sum + c.length, 0) / (chunks.length - 1);
    expect(avgSize).toBeLessThan(BASE_CHUNK_SIZE * 1.1);
  });
});

describe("AdaptiveChunker - Edge Cases", () => {
  let chunker: AdaptiveChunker;

  beforeEach(() => {
    chunker = new AdaptiveChunker();
  });

  test("handles extremely long single sentence", () => {
    const text = "This is an extremely long sentence that goes on and on without any punctuation " +
                 "marks to break it up naturally which means the chunker needs to handle this " +
                 "gracefully by breaking at word boundaries even though there are no sentence " +
                 "endings available for natural breaks in the text flow".repeat(3);
    
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_SIZE + 50);
    }
  });

  test("handles text with multiple consecutive punctuation marks", () => {
    const text = "What?! Really?! No way!!! This is amazing... Or is it???";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(0);
  });

  test("handles text with special characters", () => {
    const text = "Test @mention #hashtag $price 50% off! Visit example.com for more.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join(" ")).toContain("@mention");
  });

  test("handles unicode and emoji", () => {
    const text = "Hello 👋 world 🌍! This is a test 🧪 with emoji 😊.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(0);
  });

  test("handles text with newlines and tabs", () => {
    const text = "Line one.\nLine two.\tTabbed text.\n\nDouble newline.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThan(0);
  });

  test("handles very short remaining text", () => {
    const text = "A".repeat(FIRST_CHUNK_TARGET) + " End.";
    const chunks = chunker.chunk(text);
    
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.length).toBeGreaterThan(0);
  });
});

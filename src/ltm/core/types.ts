export type LayerType = "fact" | "pattern" | "episodic";

export interface LtmEntry {
  id: string;
  layer: LayerType;
  key: string | null;
  value: string;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

export interface ExtractionResult {
  facts: Array<{ key: string; value: string }>;
  patterns: Array<{ key: string; value: string }>;
  episodic: Array<{ value: string }>;
}

export interface EpisodicVectorEntry extends LtmEntry {
  embedding: string | null;
}

export interface LtmPromptPayload {
  facts: LtmEntry[];
  patterns: LtmEntry[];
  episodic: LtmEntry[];
  isEmpty: boolean;
}

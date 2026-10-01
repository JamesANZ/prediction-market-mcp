import { RetrievedItem } from "./types.js";

export interface EvidenceFilter {
  filter(items: RetrievedItem[]): RetrievedItem[];
}

export class PassthroughEvidenceFilter implements EvidenceFilter {
  filter(items: RetrievedItem[]): RetrievedItem[] {
    return items;
  }
}

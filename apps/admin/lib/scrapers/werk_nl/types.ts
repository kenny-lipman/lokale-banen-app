/**
 * Zod-schema's voor de werk.nl zoek-API respons.
 * Lijst-velden zijn bewust tolerant (nullable) - werk.nl laat velden weg of zet null.
 */

import { z } from "zod";

export const SearchItemSchema = z.object({
  key: z.string(),
  referenceNumber: z.number(),
  profession: z.string().nullable().optional(),
  vacatureTitle: z.string().nullable().optional(),
  modified: z.string().nullable().optional(),
  organisation: z.string().nullable().optional(),
  workLocationCity: z.string().nullable().optional(),
  workLocationType: z.string().nullable().optional(),
  minHours: z.number().nullable().optional(),
  maxHours: z.number().nullable().optional(),
  contractType: z.string().nullable().optional(),
  studyLevel: z.string().nullable().optional(),
  leerbaan: z.boolean().nullable().optional(),
  stageplaats: z.boolean().nullable().optional(),
});
export type SearchItem = z.infer<typeof SearchItemSchema>;

export const SearchResponseSchema = z.object({
  items: z.array(SearchItemSchema).default([]),
  totalResults: z.number().nullable().optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** Body voor de zoek-API. sort.by=1 = nieuwste, direction=1 = descending. */
export interface SearchRequest {
  facets: never[];
  keywords: string;
  location: string;
  currentPage: number;
  sort: { by: number; direction: number };
  includeFirstExpansion: boolean;
  includeSecondExpansion: boolean;
}

export function buildSearchBody(page: number, keywords = "", location = ""): string {
  const body: SearchRequest = {
    facets: [],
    keywords,
    location,
    currentPage: page,
    sort: { by: 1, direction: 1 },
    includeFirstExpansion: false,
    includeSecondExpansion: false,
  };
  return JSON.stringify(body);
}

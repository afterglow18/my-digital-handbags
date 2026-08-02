/**
 * Search logic for the Lookbook / Saved page.
 *
 * Searches all locally-stored text fields on each ClothingItem plus
 * vision-extracted labels, and also outfit name/notes.
 *
 * Scoring weights:
 *   name, brand           → 10
 *   color, category       → 6
 *   notes, size, season,
 *   occasion, price, date → 4
 *   visionLabels          → 2
 *   visionText            → 1
 *
 * A group (outfit) matches if its name, notes, OR any contained item matches.
 */

import type { ClothingItem, SavedOutfit } from "@/types/local";

interface ItemScore { item: ClothingItem; score: number }

function matchField(value: string | null | undefined, q: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(q);
}

function scoreItem(item: ClothingItem, q: string): number {
  let score = 0;
  if (matchField(item.name,          q)) score += 10;
  if (matchField(item.brand,         q)) score += 10;
  if (matchField(item.color,         q)) score += 6;
  if (matchField(item.category,      q)) score += 6;
  if (matchField(item.notes,         q)) score += 4;
  if (matchField(item.size,          q)) score += 4;
  if (matchField(item.season,        q)) score += 4;
  if (matchField(item.occasion,      q)) score += 4;
  if (matchField(item.purchasePrice, q)) score += 4;
  if (matchField(item.purchaseDate,  q)) score += 4;
  // Vision fields (lower weight)
  if ((item.visionLabels ?? []).some((l) => l.toLowerCase().includes(q))) score += 2;
  if ((item.visionText   ?? []).some((t) => t.toLowerCase().includes(q))) score += 1;
  return score;
}

export interface SearchResults {
  items:  ClothingItem[];
  groups: SavedOutfit[];
}

export function search(
  rawQuery: string,
  allItems: ClothingItem[],
  outfits:  SavedOutfit[],
): SearchResults {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { items: [], groups: [] };

  // ── Items ────────────────────────────────────────────────────────────────────
  const scoredItems: ItemScore[] = allItems
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // ── Outfits / groups ─────────────────────────────────────────────────────────
  // A group matches if outfit name/notes match OR any item inside it matches
  const matchedItemIds = new Set(scoredItems.map((s) => s.item.id));

  const matchedGroups = outfits.filter((outfit) => {
    if (matchField(outfit.name,  q)) return true;
    if (matchField(outfit.notes, q)) return true;
    return (outfit.items ?? []).some(
      (item) => matchedItemIds.has(item.id) || scoreItem(item, q) > 0,
    );
  });

  return {
    items:  scoredItems.map((s) => s.item),
    groups: matchedGroups,
  };
}

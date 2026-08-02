/**
 * useVisionIndexer — background photo-search indexer.
 *
 * On app start, finds all ClothingItems that haven't been analysed yet
 * (visionVersion < 4, excluding version 5 "no labels found — don't retry")
 * and runs the web canvas colour extraction on each one with a 350ms delay
 * between items so the UI stays responsive.
 *
 * Shows a non-blocking "Preparing photo search…" toast while running.
 *
 * Version scheme:
 *   0 = unanalysed
 *   1 = iOS Vision (will be re-run on web; version < 4)
 *   4 = web canvas correct
 *   5 = web analysed, no labels found (skip — don't retry)
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dbListClothing, dbUpdateClothing } from "@/lib/db";
import { analyzeItemImage } from "@/lib/visionAnalysis";
import { toast } from "@/hooks/use-toast";

const WEB_VERSION = 4;
const WEB_NO_LABELS_VERSION = 5;

let _running = false;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runIndexer(invalidate: () => void): Promise<void> {
  if (_running) return;
  _running = true;

  try {
    const items = await dbListClothing();

    const queue = items.filter((item) => {
      const v = item.visionVersion ?? 0;
      // Skip: already at current web version or "no labels" sentinel
      if (v >= WEB_VERSION) return false;
      // Need an image to analyse
      if (!item.imageObjectPath) return false;
      return true;
    });

    if (queue.length === 0) return;

    const { dismiss } = toast({
      title: "Preparing photo search…",
      description: `Analysing ${queue.length} photo${queue.length !== 1 ? "s" : ""}`,
    });

    for (const item of queue) {
      try {
        const { labels, text } = await analyzeItemImage(item.imageObjectPath!);
        await dbUpdateClothing(item.id, {
          visionLabels:  labels,
          visionText:    text,
          visionVersion: labels.length > 0 ? WEB_VERSION : WEB_NO_LABELS_VERSION,
        });
        invalidate();
      } catch (err) {
        console.warn("[VisionIndexer] Failed to analyse item", item.id, err);
        // Don't mark as failed — will retry next launch
      }
      await delay(350);
    }

    dismiss();
    invalidate();
  } finally {
    _running = false;
  }
}

/** Drop into any component (App.tsx) to start the indexer once per session. */
export function useVisionIndexer(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["clothing"] });
    runIndexer(invalidate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Queue a single newly-added or just-updated item for immediate analysis.
 * Call after saving a photo — does not wait for the next launch.
 */
export async function queueItemForIndexing(
  itemId: string,
  imageDataUrl: string,
  invalidate: () => void,
): Promise<void> {
  try {
    const { labels, text } = await analyzeItemImage(imageDataUrl);
    await dbUpdateClothing(itemId, {
      visionLabels:  labels,
      visionText:    text,
      visionVersion: labels.length > 0 ? WEB_VERSION : WEB_NO_LABELS_VERSION,
    });
    invalidate();
  } catch (err) {
    console.warn("[VisionIndexer] Immediate index failed for", itemId, err);
  }
}

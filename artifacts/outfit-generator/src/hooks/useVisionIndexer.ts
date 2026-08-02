/**
 * useVisionIndexer — background photo-search indexer.
 *
 * Version scheme:
 *   0 = unanalysed
 *   1 = iOS Vision labels only (old — no colours; re-indexed on next launch)
 *   2 = iOS Vision labels + canvas colours merged  ← current iOS version
 *   4 = web canvas colours only                   ← current web version
 *   5 = web canvas analysed, no labels found (skip — don't retry)
 *
 * needsIndexing returns true for versions 0, 1, and any other value that
 * doesn't match a "done" sentinel (2, 4, 5).
 */

import { useEffect }    from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { dbListClothing, dbUpdateClothing } from "@/lib/db";
import { analyzeItemImage }              from "@/lib/visionAnalysis";

// ── Version constants ─────────────────────────────────────────────────────────

const IOS_VERSION         = 2;  // iOS Vision + canvas, merged
const WEB_VERSION         = 4;  // canvas only
const WEB_NO_LABELS       = 5;  // canvas ran, nothing found — don't retry

const DONE_VERSIONS = new Set([IOS_VERSION, WEB_VERSION, WEB_NO_LABELS]);

function needsIndexing(v: number | undefined): boolean {
  return !DONE_VERSIONS.has(v ?? 0);
}

// ── Native Vision plugin ──────────────────────────────────────────────────────

interface VisionPluginInterface {
  analyzeImage(opts: { imageBase64: string }): Promise<{ labels: string[]; text: string[] }>;
}

// registerPlugin is safe to call at module load time; it's a no-op on web.
const NativeVision = registerPlugin<VisionPluginInterface>("VisionPlugin");

async function callNativeVision(
  imageDataUrl: string,
): Promise<{ labels: string[]; text: string[] }> {
  // Strip the data-URL prefix to get raw base64
  const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, "");
  try {
    return await NativeVision.analyzeImage({ imageBase64: base64 });
  } catch (err) {
    console.warn("[VisionIndexer] Native Vision call failed:", err);
    return { labels: [], text: [] };
  }
}

// ── Analysis dispatcher ───────────────────────────────────────────────────────

async function analyzeItem(
  imageDataUrl: string,
  isNative: boolean,
): Promise<{ labels: string[]; text: string[]; version: number }> {
  if (isNative) {
    // Run Apple Vision + canvas colour extraction in parallel, then merge.
    const [native, canvas] = await Promise.all([
      callNativeVision(imageDataUrl),
      analyzeItemImage(imageDataUrl),
    ]);

    // Deduplicate: object labels from Vision first, colour names from canvas after.
    const merged = [...new Set([...native.labels, ...canvas.labels])];
    return {
      labels:  merged,
      text:    native.text,
      version: IOS_VERSION,
    };
  }

  // Web path — canvas only.
  const { labels, text } = await analyzeItemImage(imageDataUrl);
  return {
    labels,
    text,
    version: labels.length > 0 ? WEB_VERSION : WEB_NO_LABELS,
  };
}

// ── Indexer loop ──────────────────────────────────────────────────────────────

let _running = false;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runIndexer(invalidate: () => void): Promise<void> {
  if (_running) return;
  _running = true;

  const isNative = Capacitor.isNativePlatform();

  try {
    const items = await dbListClothing();
    const queue = items.filter(
      (item) => needsIndexing(item.visionVersion) && !!item.imageObjectPath,
    );

    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const { labels, text, version } = await analyzeItem(item.imageObjectPath!, isNative);
        await dbUpdateClothing(item.id, { visionLabels: labels, visionText: text, visionVersion: version });
        invalidate();
      } catch (err) {
        console.warn("[VisionIndexer] Failed to analyse item", item.id, err);
      }
      await delay(350);
    }

    invalidate();
  } finally {
    _running = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Drop into App.tsx — starts the indexer once per session. */
export function useVisionIndexer(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["clothing"] });
    runIndexer(invalidate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Immediately index a single item after its photo is saved.
 * Runs the same native/web dispatch as the background loop.
 */
export async function queueItemForIndexing(
  itemId:       string,
  imageDataUrl: string,
  invalidate:   () => void,
): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  try {
    const { labels, text, version } = await analyzeItem(imageDataUrl, isNative);
    await dbUpdateClothing(itemId, { visionLabels: labels, visionText: text, visionVersion: version });
    invalidate();
  } catch (err) {
    console.warn("[VisionIndexer] Immediate index failed for", itemId, err);
  }
}

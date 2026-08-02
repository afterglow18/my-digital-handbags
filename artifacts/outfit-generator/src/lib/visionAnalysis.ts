/**
 * Web canvas colour extraction.
 * Draws the image into a 48×48 canvas, samples corner patches to detect the
 * studio background, then maps surviving foreground pixels to colour names.
 * A colour must cover ≥10% of foreground pixels to be returned.
 *
 * visionVersion assigned here: 4 = labels found, 5 = analysed but no labels.
 */

// ── Colour name mapping ───────────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  const v = max;
  const s = max === 0 ? 0 : delta / max;

  let h = 0;
  if (delta !== 0) {
    if (max === rn)      h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else                 h = (rn - gn) / delta + 4;
    h = ((h * 60) + 360) % 360;
  }

  return { h, s, v };
}

function pixelToColorName(r: number, g: number, b: number): string | null {
  const brightness = (r + g + b) / 3;
  const { h, s, v } = rgbToHsv(r, g, b);

  // Achromatic path (low saturation)
  if (s < 0.18) {
    if (brightness < 80)  return "black";
    if (brightness < 110) return "dark grey";
    if (brightness < 175) return "grey";
    if (brightness < 225) return "light grey";
    return "white";
  }

  // Warm browns / tans / beige before generic hue sweep
  if (h >= 15 && h <= 50) {
    if (v < 0.55 && s > 0.3)          return "brown";
    if (v >= 0.55 && v < 0.80 && s < 0.55) return "tan";
    if (v >= 0.80 && s < 0.40)        return "beige";
  }

  if (h < 15 || h >= 345) return "red";
  if (h < 45)              return "orange";
  if (h < 65)              return "yellow";
  if (h < 170)             return "green";
  if (h < 200)             return "teal";
  if (h < 260)             return "blue";
  if (h < 290)             return "purple";
  return "pink";
}

// ── Main analysis entry-point ─────────────────────────────────────────────────

export function analyzeItemImage(
  imageDataUrl: string,
): Promise<{ labels: string[]; text: string[] }> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const SIZE = 48;
        const canvas = document.createElement("canvas");
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve({ labels: [], text: [] }); return; }

        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // ── Corner-patch background sampling ─────────────────────────────────
        const PATCH = 4;
        const corners: [number, number][] = [
          [0, 0], [SIZE - PATCH, 0],
          [0, SIZE - PATCH], [SIZE - PATCH, SIZE - PATCH],
        ];
        let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
        for (const [cx, cy] of corners) {
          for (let dy = 0; dy < PATCH; dy++) {
            for (let dx = 0; dx < PATCH; dx++) {
              const i = ((cy + dy) * SIZE + (cx + dx)) * 4;
              bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2];
              bgCount++;
            }
          }
        }
        bgR /= bgCount; bgG /= bgCount; bgB /= bgCount;

        // ── Foreground pixel analysis ─────────────────────────────────────────
        const BG_THRESHOLD = 35; // Manhattan distance in RGB to be "background"
        const colorCounts: Record<string, number> = {};
        let fgPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 15) continue; // transparent

          // Exclude background
          if (Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) < BG_THRESHOLD) continue;

          fgPixels++;
          const name = pixelToColorName(r, g, b);
          if (name) colorCounts[name] = (colorCounts[name] ?? 0) + 1;
        }

        if (fgPixels === 0) { resolve({ labels: [], text: [] }); return; }

        // Only include colours that cover ≥10% of foreground pixels
        const labels = Object.entries(colorCounts)
          .filter(([, count]) => count / fgPixels >= 0.10)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        resolve({ labels, text: [] });
      } catch {
        resolve({ labels: [], text: [] });
      }
    };

    img.onerror = () => resolve({ labels: [], text: [] });
    img.src = imageDataUrl;
  });
}

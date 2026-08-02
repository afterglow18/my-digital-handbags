---
name: Vision search feature
description: visionLabels/visionText/visionVersion fields, web canvas color indexer, search scoring, showAddToLookbook prop pattern
---

## Schema additions to ClothingItem
`visionLabels: string[]`, `visionText: string[]`, `visionVersion: number` added to `src/types/local.ts`.
Defaults (`[]`, `[]`, `0`) added in `dbCreateClothing` in `src/lib/db.ts`.

## visionVersion scheme
- 0 = unanalysed
- 1 = iOS Vision (will be re-run on web — version < 4)
- 4 = web canvas, labels found
- 5 = web canvas, no labels found — **don't retry**

## Web canvas indexer
`src/lib/visionAnalysis.ts` — 48×48 canvas, corner-patch background detection (4×4 per corner), foreground isolation, RGB→HSV colour name mapping (12 names incl. brown/tan/beige), ≥10% threshold.

`src/hooks/useVisionIndexer.ts` — background loop, 350ms inter-item delay, module-level `_running` flag prevents double-run, shows toast while running. `queueItemForIndexing()` for immediate post-save analysis.

Wired in `src/App.tsx` via `useVisionIndexer()` in `AppShell`.

## Search
`src/lib/search.ts` — weights: name/brand=10, color/category=6, notes/size/season/occasion/price/date=4, visionLabels=2, visionText=1. Groups match if name/notes match OR any item inside matches.

Search bar + results in `src/pages/saved.tsx` (searchQuery state, IIFE render, scroll-to-top on result tap resets query for groups).

## showAddToLookbook prop
`ItemDetailsSheet` accepts `showAddToLookbook?: boolean`. When true, Row 1 of photo actions shows "Add to Lookbook" (opens `AddToLookbookSheet`) instead of "Clean Up Photo". "Wearing Today" always shows regardless.

Pass `showAddToLookbook` as true from: search results in `saved.tsx` (via `detailsFromSearch` state), `favorites.tsx`.

## AddToLookbookSheet
`src/components/clothing/AddToLookbookSheet.tsx` — lists all outfits with 3-thumbnail previews, filled checkmark for outfits already containing the item, tap to add/remove via `useAddItemToOutfit` / `useRemoveItemFromOutfit`.

## iOS Vision plugin
`ios/App/App/VisionPlugin.swift` — `VNClassifyImageRequest` (confidence ≥ 0.3) + `VNRecognizeTextRequest` (accurate), background queue, returns `{ labels, text }`.
`ios/App/App/VisionPluginObjC.m` — ObjC bridge file.

**Why:** Web canvas gives free colour extraction without any API; iOS Vision adds richer semantic labels on device. versionVersion 5 sentinel prevents infinite retry loops for plain-background items.

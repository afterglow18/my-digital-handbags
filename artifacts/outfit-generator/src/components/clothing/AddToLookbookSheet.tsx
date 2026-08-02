/**
 * AddToLookbookSheet — slide-up sheet listing all saved lookbook groups.
 * Shows a 3-thumbnail preview per group, a filled checkmark if the item is
 * already in that group, and lets the user add or remove it with a tap.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import type { ClothingItem, SavedOutfit } from "@/types/local";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
} from "@/hooks/useLocalOutfits";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

interface Props {
  item:    ClothingItem;
  onClose: () => void;
}

function ThreeThumbs({ outfit }: { outfit: SavedOutfit }) {
  const first3 = (outfit.items ?? []).slice(0, 3);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 3 }).map((_, i) => {
        const it = first3[i];
        return (
          <div
            key={i}
            className="w-10 h-10 border border-black/15 rounded overflow-hidden flex-shrink-0"
            style={{ background: "#F5EDE3" }}
          >
            {it?.imageObjectPath ? (
              <img
                src={getImageUrl(it.imageObjectPath)!}
                alt={it.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[8px] text-black/20">—</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AddToLookbookSheet({ item, onClose }: Props) {
  const { data: outfits } = useListOutfits();
  const addItem    = useAddItemToOutfit();
  const removeItem = useRemoveItemFromOutfit();
  const qc         = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });

  const handleToggle = (outfit: SavedOutfit) => {
    const alreadyIn = (outfit.items ?? []).some((i) => i.id === item.id);
    if (alreadyIn) {
      removeItem.mutate({ id: outfit.id, itemId: item.id }, { onSuccess: invalidate });
    } else {
      addItem.mutate({ id: outfit.id, data: { itemId: item.id } }, { onSuccess: invalidate });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3
                   bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add to Lookbook
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Item being added */}
      <div className="px-4 py-3 border-b border-black/10 bg-white flex items-center gap-3">
        <div
          className="w-12 h-12 border-2 border-black rounded overflow-hidden flex-shrink-0"
          style={{ background: "#F5EDE3" }}
        >
          {item.imageObjectPath ? (
            <img
              src={getImageUrl(item.imageObjectPath)!}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-black/20">—</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{item.name}</p>
          <p className="text-xs text-black/40 capitalize">{item.category?.replace(/-/g, " ")}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {!outfits || outfits.length === 0 ? (
          <div className="text-center py-12 text-black/35 text-sm font-medium">
            No lookbooks saved yet.
          </div>
        ) : (
          outfits.map((outfit) => {
            const alreadyIn = (outfit.items ?? []).some((i) => i.id === item.id);
            return (
              <button
                key={outfit.id}
                onClick={() => handleToggle(outfit)}
                className="w-full flex items-center gap-3 bg-white border-2 border-black
                           rounded-xl px-3 py-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           transition-all text-left"
              >
                <ThreeThumbs outfit={outfit} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm uppercase tracking-tight truncate">
                    {outfit.name}
                  </p>
                  <p className="text-[10px] text-black/40 mt-0.5">
                    {outfit.items?.length ?? 0} item{(outfit.items?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
                {/* Checkmark */}
                <div
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={alreadyIn
                    ? { background: "#7D1528", borderColor: "#7D1528" }
                    : { background: "transparent", borderColor: "rgba(0,0,0,0.2)" }}
                >
                  {alreadyIn && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

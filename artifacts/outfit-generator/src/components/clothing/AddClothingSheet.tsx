import React from "react";
import { Sheet } from "@/components/ui/sheet";
import { ClothingForm, ClothingFormData } from "./ClothingForm";
import { useCreateClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import { useQueryClient } from "@tanstack/react-query";
import { queueItemForIndexing } from "@/hooks/useVisionIndexer";

interface AddClothingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
}

export function AddClothingSheet({ open, onOpenChange, defaultCategory }: AddClothingSheetProps) {
  const createItem = useCreateClothingItem();
  const queryClient = useQueryClient();

  const handleSubmit = (data: ClothingFormData) => {
    createItem.mutate(
      { data: { ...data, imageObjectPath: data.imageObjectPath || undefined } },
      {
        onSuccess: (newItem) => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          // Queue for immediate vision indexing so the new item is searchable
          // by colour in the same session without an app restart.
          if (newItem.imageObjectPath) {
            const invalidate = () =>
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
            queueItemForIndexing(newItem.id, newItem.imageObjectPath, invalidate);
          }
          onOpenChange(false);
        }
      }
    );
  };

  const title = defaultCategory
    ? `Add ${defaultCategory.charAt(0).toUpperCase() + defaultCategory.slice(1)}`
    : "New Item";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <ClothingForm
        key={defaultCategory ?? "any"}
        onSubmit={handleSubmit}
        isSubmitting={createItem.isPending}
        submitLabel="Add to Collection"
        initialData={defaultCategory ? { category: defaultCategory as ClothingFormData["category"] } : undefined}
      />
    </Sheet>
  );
}

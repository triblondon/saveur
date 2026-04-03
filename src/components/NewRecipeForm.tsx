"use client";

import { EditRecipeForm } from "@/components/EditRecipeForm";
import type { CollectionSummary } from "@/lib/types";

interface NewRecipeFormProps {
  writableCollections: CollectionSummary[];
  initialCollectionId: string;
}

export function NewRecipeForm({ writableCollections, initialCollectionId }: NewRecipeFormProps) {
  return <EditRecipeForm writableCollections={writableCollections} initialCollectionId={initialCollectionId} />;
}

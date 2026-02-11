"use client";

import { toast } from "sonner";
import Image from "next/image";
import { CharacterImage } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { selectCharacterImageAction } from "@/app/admin/characters/actions";

type Props = {
  characterId: string;
  images: CharacterImage[];
};

export function CharacterGallery({ characterId, images }: Props) {
  async function handleSelect(imageId: string) {
    const result = await selectCharacterImageAction(characterId, imageId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Selected image updated");
  }

  if (images.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No generated images yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => (
        <div
          key={image.id}
          className="overflow-hidden rounded-lg border bg-muted/20"
        >
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={image.imageUrl}
              alt="Character variant"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex items-center justify-between p-3 text-xs text-muted-foreground">
            <span>{image.isSelected ? "Selected" : "Variant"}</span>
            <Button
              type="button"
              size="sm"
              variant={image.isSelected ? "secondary" : "default"}
              onClick={() => handleSelect(image.id)}
            >
              {image.isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

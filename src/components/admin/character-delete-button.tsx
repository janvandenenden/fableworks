"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteCharacterAction } from "@/app/admin/characters/actions";

type Props = {
  characterId: string;
};

export function CharacterDeleteButton({ characterId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete character</DialogTitle>
          <DialogDescription>
            This permanently deletes the character, profile, and generated
            images.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteCharacterAction}>
          <input type="hidden" name="id" value={characterId} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Delete character
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

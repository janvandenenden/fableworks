"use client";

import { useState } from "react";
import { deleteStoryAction } from "@/app/admin/stories/actions";
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

export function StoryDeleteButton({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          Delete Story
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete story</DialogTitle>
          <DialogDescription>
            This permanently deletes the story, scenes, storyboard assets, props, and prompt
            history.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteStoryAction}>
          <input type="hidden" name="storyId" value={storyId} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Delete story
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


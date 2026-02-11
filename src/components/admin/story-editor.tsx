"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateManuscriptAction, updateStoryMetaAction } from "@/app/admin/stories/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StoryEditor({
  story,
  canRegenerateManuscript,
}: {
  story: {
    id: string;
    title: string | null;
    storyArc: string | null;
  };
  canRegenerateManuscript: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(story.title ?? "");
  const [storyArc, setStoryArc] = useState(story.storyArc ?? "");

  function handleMetaSave() {
    const formData = new FormData();
    formData.set("title", title);
    formData.set("storyArc", storyArc);

    startTransition(async () => {
      const result = await updateStoryMetaAction(story.id, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Title and arc saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Manuscript Metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Story title"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="storyArc">Arc summary</Label>
          <Textarea
            id="storyArc"
            value={storyArc}
            onChange={(event) => setStoryArc(event.target.value)}
            rows={3}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleMetaSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Title & Arc"}
          </Button>
          {canRegenerateManuscript ? (
            <form action={generateManuscriptAction}>
              <input type="hidden" name="storyId" value={story.id} />
              <Button type="submit" variant="outline">
                Regenerate Manuscript Metadata
              </Button>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

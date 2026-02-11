"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateManuscriptAction, updateStoryMetaAction } from "@/app/admin/stories/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function StoryEditor({
  story,
  characters,
  selectedCharacterImageUrl,
  canGenerateManuscript,
  canRegenerateManuscript,
}: {
  story: {
    id: string;
    title: string | null;
    storyArc: string | null;
    characterId: string | null;
  };
  characters: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  selectedCharacterImageUrl: string | null;
  canGenerateManuscript: boolean;
  canRegenerateManuscript: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(story.title ?? "");
  const [storyArc, setStoryArc] = useState(story.storyArc ?? "");
  const [characterId, setCharacterId] = useState(story.characterId ?? "__none");

  function handleMetaSave() {
    const formData = new FormData();
    formData.set("title", title);
    formData.set("storyArc", storyArc);
    formData.set("characterId", characterId);

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
        <div className="grid gap-2">
          <Label htmlFor="characterId">Linked character</Label>
          <input type="hidden" name="characterId" value={characterId} />
          <Select value={characterId} onValueChange={setCharacterId}>
            <SelectTrigger id="characterId" className="w-full">
              <SelectValue placeholder="Select character" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No character linked</SelectItem>
              {characters.map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name} ({character.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Final page generation uses the selected variant from this character.
          </p>
          {characterId !== "__none" && selectedCharacterImageUrl ? (
            <p className="text-xs text-muted-foreground">
              A selected character variant is available for final pages.
            </p>
          ) : characterId !== "__none" ? (
            <p className="text-xs text-amber-600">
              This character has no selected variant yet. Open the character and click Select on a
              generated image.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleMetaSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Title & Arc"}
          </Button>
          <form action={generateManuscriptAction}>
            <input type="hidden" name="storyId" value={story.id} />
            <Button type="submit" variant="outline" disabled={!canGenerateManuscript}>
              {canRegenerateManuscript
                ? "Regenerate Manuscript Metadata"
                : "Generate Manuscript Metadata"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

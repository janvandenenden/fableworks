"use client";

import { useState } from "react";
import { generateFinalPagesAction } from "@/app/admin/stories/[id]/pages/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CharacterOption = {
  id: string;
  name: string;
  status: string;
  hasSelectedVariant: boolean;
};

export function FinalPagesBulkControls({
  storyId,
  characters,
  defaultCharacterId,
}: {
  storyId: string;
  characters: CharacterOption[];
  defaultCharacterId: string | null;
}) {
  const [characterId, setCharacterId] = useState(defaultCharacterId ?? "__none");
  const selectedCharacter = characters.find((character) => character.id === characterId);
  const canRunBulk = characterId === "__none" ? true : Boolean(selectedCharacter?.hasSelectedVariant);

  return (
    <form action={generateFinalPagesAction} className="space-y-3">
      <input type="hidden" name="storyId" value={storyId} />
      {characterId !== "__none" ? (
        <input type="hidden" name="characterId" value={characterId} />
      ) : null}
      <div className="grid gap-1">
        <Label htmlFor="bulk-character-id">Character for bulk generation</Label>
        <Select value={characterId} onValueChange={setCharacterId}>
          <SelectTrigger id="bulk-character-id" className="w-full">
            <SelectValue placeholder="Select character" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Use story linked character</SelectItem>
            {characters.map((character) => (
              <SelectItem
                key={character.id}
                value={character.id}
                disabled={!character.hasSelectedVariant}
              >
                {character.name} ({character.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose a character to generate all missing pages for that one character.
        </p>
      </div>
      <Button type="submit" disabled={!canRunBulk}>
        Generate Final Pages
      </Button>
    </form>
  );
}

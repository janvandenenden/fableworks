"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  regenerateCharacterAction,
  regenerateImagesFromProfileAction,
} from "@/app/admin/characters/actions";
import { getStylePresets } from "@/lib/prompts/character";

type Props = {
  characterId: string;
};

export function CharacterRegenerateControls({ characterId }: Props) {
  const [stylePreset, setStylePreset] = useState("default");
  const presets = getStylePresets();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        name="stylePreset"
        value={stylePreset}
        onChange={(event) => setStylePreset(event.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="default">Use current style</option>
        {presets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>

      <form
        action={async () => {
          "use server";
          const formData = new FormData();
          formData.set("id", characterId);
          formData.set("stylePreset", stylePreset);
          await regenerateCharacterAction(formData);
        }}
      >
        <Button type="submit" variant="secondary">
          Regenerate (with vision)
        </Button>
      </form>

      <form
        action={async () => {
          "use server";
          const formData = new FormData();
          formData.set("id", characterId);
          formData.set("stylePreset", stylePreset);
          await regenerateImagesFromProfileAction(formData);
        }}
      >
        <Button type="submit" variant="outline">
          Regenerate images only
        </Button>
      </form>
    </div>
  );
}

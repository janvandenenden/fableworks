import { Button } from "@/components/ui/button";
import { regenerateCharacterFromModeAction } from "@/app/admin/characters/actions";
import { getStylePresets } from "@/lib/prompts/character";

type Props = {
  characterId: string;
};

export function CharacterRegenerateControls({ characterId }: Props) {
  const presets = getStylePresets();

  return (
    <form
      action={regenerateCharacterFromModeAction}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={characterId} />
      <select
        name="stylePreset"
        defaultValue="default"
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="default">Use current style</option>
        {presets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>

      <Button type="submit" name="mode" value="vision" variant="secondary">
        Regenerate (with vision)
      </Button>
      <Button type="submit" name="mode" value="profile" variant="outline">
        Regenerate images only
      </Button>
    </form>
  );
}

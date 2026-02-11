import { Button } from "@/components/ui/button";
import { regenerateCharacterFromModeAction } from "@/app/admin/characters/actions";
import { getStylePresets } from "@/lib/prompts/character";

type Props = {
  characterId: string;
  currentStylePreset: string | null;
  promptPreview: string;
};

export function CharacterRegenerateControls({
  characterId,
  currentStylePreset,
  promptPreview,
}: Props) {
  const presets = getStylePresets();
  const defaultStyle =
    currentStylePreset && presets.some((preset) => preset.value === currentStylePreset)
      ? currentStylePreset
      : "default";

  return (
    <form
      action={regenerateCharacterFromModeAction}
      className="flex w-full max-w-3xl flex-col gap-3"
    >
      <input type="hidden" name="id" value={characterId} />
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="stylePreset"
          defaultValue={defaultStyle}
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
      </div>

      <div className="grid gap-1">
        <label
          htmlFor="characterPromptOverride"
          className="text-xs font-medium text-muted-foreground"
        >
          Exact prompt sent to NanoBanana
        </label>
        <textarea
          id="characterPromptOverride"
          name="promptOverride"
          defaultValue={promptPreview}
          rows={6}
          className="w-full rounded-md border bg-background px-3 py-2 text-xs"
        />
      </div>
    </form>
  );
}

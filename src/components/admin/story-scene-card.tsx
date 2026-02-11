"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StorySceneCard({
  sceneNumber,
  spreadText,
  sceneDescription,
  propTitles,
  onSpreadTextChange,
  onSceneDescriptionChange,
  onSave,
  onRegenerate,
  isSaving,
  isRegenerating,
}: {
  sceneNumber: number;
  spreadText: string;
  sceneDescription: string;
  propTitles: string[];
  onSpreadTextChange: (value: string) => void;
  onSceneDescriptionChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  isSaving: boolean;
  isRegenerating: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Scene {sceneNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Spread text</Label>
          <Textarea
            value={spreadText}
            onChange={(event) => onSpreadTextChange(event.target.value)}
            rows={4}
          />
        </div>

        <div className="grid gap-2">
          <Label>Scene description</Label>
          <Textarea
            value={sceneDescription}
            onChange={(event) => onSceneDescriptionChange(event.target.value)}
            rows={4}
          />
        </div>

        <div className="grid gap-1">
          <Label>Props linked to this scene</Label>
          {propTitles.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {propTitles.join(", ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No props linked yet. Manage in Props Bible.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Regenerate uses full story context to keep continuity with all scenes.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={isSaving || isRegenerating}>
            {isSaving ? "Saving..." : "Save This Scene"}
          </Button>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={isSaving || isRegenerating}
          >
            {isRegenerating ? "Regenerating..." : "Regenerate Scene"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

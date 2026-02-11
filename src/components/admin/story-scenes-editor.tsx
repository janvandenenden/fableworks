"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generateScenesAction,
  regenerateSceneAction,
  updateSceneAction,
} from "@/app/admin/stories/actions";
import { StorySceneCard } from "@/components/admin/story-scene-card";
import { Button } from "@/components/ui/button";

type Scene = {
  id: string;
  sceneNumber: number;
  spreadText: string | null;
  sceneDescription: string | null;
};

type SceneDraft = {
  spreadText: string;
  sceneDescription: string;
};

export function StoryScenesEditor({
  storyId,
  scenes,
  propsByScene,
}: {
  storyId: string;
  scenes: Scene[];
  propsByScene: Record<number, string[]>;
}) {
  const router = useRouter();
  const [isSaveAllPending, startSaveAllTransition] = useTransition();
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"save" | "regenerate" | null>(
    null
  );
  const [sceneDrafts, setSceneDrafts] = useState<Record<string, SceneDraft>>(
    Object.fromEntries(
      scenes.map((scene) => [
        scene.id,
        {
          spreadText: scene.spreadText ?? "",
          sceneDescription: scene.sceneDescription ?? "",
        },
      ])
    )
  );

  const dirtySceneCount = useMemo(() => {
    return scenes.filter((scene) => {
      const draft = sceneDrafts[scene.id];
      if (!draft) return false;
      return (
        draft.spreadText !== (scene.spreadText ?? "") ||
        draft.sceneDescription !== (scene.sceneDescription ?? "")
      );
    }).length;
  }, [sceneDrafts, scenes]);

  function setSceneDraft(
    sceneId: string,
    patch: Partial<{
      spreadText: string;
      sceneDescription: string;
    }>
  ) {
    setSceneDrafts((current) => ({
      ...current,
      [sceneId]: {
        ...current[sceneId],
        ...patch,
      },
    }));
  }

  async function saveSingleScene(sceneId: string) {
    const draft = sceneDrafts[sceneId];
    if (!draft) return;
    const formData = new FormData();
    formData.set("spreadText", draft.spreadText);
    formData.set("sceneDescription", draft.sceneDescription);

    setActiveSceneId(sceneId);
    setActiveMode("save");
    const result = await updateSceneAction(storyId, sceneId, formData);
    setActiveSceneId(null);
    setActiveMode(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Scene saved");
    router.refresh();
  }

  async function regenerateSingleScene(sceneId: string) {
    const formData = new FormData();
    formData.set("storyId", storyId);
    formData.set("sceneId", sceneId);

    setActiveSceneId(sceneId);
    setActiveMode("regenerate");
    const result = await regenerateSceneAction(formData);
    setActiveSceneId(null);
    setActiveMode(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Scene regenerated");
    router.refresh();
  }

  function handleSaveAllScenes() {
    startSaveAllTransition(async () => {
      const changed = scenes.filter((scene) => {
        const draft = sceneDrafts[scene.id];
        if (!draft) return false;
        return (
          draft.spreadText !== (scene.spreadText ?? "") ||
          draft.sceneDescription !== (scene.sceneDescription ?? "")
        );
      });

      for (const scene of changed) {
        const draft = sceneDrafts[scene.id];
        if (!draft) continue;
        const formData = new FormData();
        formData.set("spreadText", draft.spreadText);
        formData.set("sceneDescription", draft.sceneDescription);
        const result = await updateSceneAction(storyId, scene.id, formData);
        if (!result.success) {
          toast.error(`Failed saving scene ${scene.sceneNumber}: ${result.error}`);
          return;
        }
      }

      toast.success(
        changed.length ? "All changed scenes saved" : "No scene changes to save"
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dirtySceneCount > 0
            ? `${dirtySceneCount} scene(s) changed`
            : "No unsaved scene changes"}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleSaveAllScenes} disabled={isSaveAllPending}>
            {isSaveAllPending ? "Saving..." : "Save All Scenes"}
          </Button>
          <form action={generateScenesAction}>
            <input type="hidden" name="storyId" value={storyId} />
            <Button type="submit" variant="outline">
              Regenerate All Scenes
            </Button>
          </form>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Prop list per scene is based on scene links in the Props Bible.
      </p>

      <div className="space-y-4">
        {scenes.map((scene) => {
          const draft = sceneDrafts[scene.id];
          return (
            <StorySceneCard
              key={scene.id}
              sceneNumber={scene.sceneNumber}
              spreadText={draft?.spreadText ?? ""}
              sceneDescription={draft?.sceneDescription ?? ""}
              propTitles={propsByScene[scene.sceneNumber] ?? []}
              onSpreadTextChange={(value) =>
                setSceneDraft(scene.id, { spreadText: value })
              }
              onSceneDescriptionChange={(value) =>
                setSceneDraft(scene.id, { sceneDescription: value })
              }
              onSave={() => saveSingleScene(scene.id)}
              onRegenerate={() => regenerateSingleScene(scene.id)}
              isSaving={activeSceneId === scene.id && activeMode === "save"}
              isRegenerating={
                activeSceneId === scene.id && activeMode === "regenerate"
              }
            />
          );
        })}
      </div>
    </div>
  );
}

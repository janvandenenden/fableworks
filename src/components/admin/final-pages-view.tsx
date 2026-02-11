import { FinalPageCard } from "@/components/admin/final-page-card";

export type FinalPageSceneData = {
  storyId: string;
  sceneId: string;
  sceneNumber: number;
  spreadText: string | null;
  sceneDescription: string | null;
  storyboardImageUrl: string | null;
  latestImageUrl: string | null;
  latestVersion: number | null;
  latestApproved: boolean;
  promptPreview: string;
  runHistory: Array<{
    id: string;
    status: string | null;
    errorMessage: string | null;
    rawPrompt: string;
    characterName: string | null;
    parameters: string | null;
    resultUrl: string | null;
    createdAt: string | null;
  }>;
  availableCharacters: Array<{
    id: string;
    name: string;
    status: string;
    hasSelectedVariant: boolean;
    selectedVariantImageUrl: string | null;
  }>;
  defaultCharacterId: string | null;
  hasStoryLinkedCharacter: boolean;
  storyLinkedCharacterId: string | null;
  versions: Array<{
    id: string;
    version: number;
    imageUrl: string;
    isApproved: boolean;
  }>;
};

export function FinalPagesView({
  scenes,
}: {
  scenes: FinalPageSceneData[];
}) {
  if (scenes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scenes available yet. Generate story scenes first.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {scenes.map((scene) => (
        <FinalPageCard key={scene.sceneId} scene={scene} />
      ))}
    </div>
  );
}

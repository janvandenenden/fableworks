import { StoryboardPanel } from "@/components/admin/storyboard-panel";

type StoryboardPanelData = {
  id: string;
  sceneId: string;
  sceneNumber: number;
  spreadText: string | null;
  sceneDescription: string | null;
  background: string | null;
  foreground: string | null;
  environment: string | null;
  characterPose: string | null;
  composition: string | null;
  propsUsed: string | null;
  imageUrl: string | null;
  status: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  lastRunAt: string | null;
  promptPreview: string;
  linkedPropsText: string;
  storyId: string;
  outlineReferenceUrl: string | null;
  aspectRatio: string;
  runHistory: Array<{
    id: string;
    status: string | null;
    errorMessage: string | null;
    rawPrompt: string;
    parameters: string | null;
    resultUrl: string | null;
    createdAt: string | null;
  }>;
  versions: Array<{
    id: string;
    storageUrl: string;
    label: string;
    isActive: boolean;
    createdAt: string | null;
  }>;
};

export function StoryboardView({
  panels,
}: {
  panels: StoryboardPanelData[];
}) {
  if (panels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No storyboard panels yet. Generate compositions first.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {panels.map((panel) => (
        <StoryboardPanel
          key={`${panel.id}:${panel.imageUrl ?? "no-image"}:${panel.promptPreview}`}
          panel={panel}
        />
      ))}
    </div>
  );
}

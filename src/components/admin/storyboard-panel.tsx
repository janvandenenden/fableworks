"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  History,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import {
  generateStoryboardPanelImageAction,
  generateStoryboardPanelImageFromRunAction,
  saveStoryboardPanelPromptDraftAction,
  updateStoryboardCompositionAction,
} from "@/app/admin/stories/[id]/storyboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoryboardPromptEditor } from "@/components/admin/storyboard-prompt-editor";
import { Textarea } from "@/components/ui/textarea";

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
};

function parsePropsUsed(value: string | null): string {
  if (!value) return "";
  try {
    return (JSON.parse(value) as string[]).join(", ");
  } catch {
    return "";
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "never";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}

export function StoryboardPanel({ panel }: { panel: StoryboardPanelData }) {
  const router = useRouter();
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isSavingComposition, startSaveCompositionTransition] = useTransition();
  const [isSavingPrompt, startSavePromptTransition] = useTransition();
  const [isReusingRunId, setIsReusingRunId] = useState<string | null>(null);
  const [promptOverride, setPromptOverride] = useState(panel.promptPreview);
  const [savedPromptBase, setSavedPromptBase] = useState(panel.promptPreview);
  const [isCompositionDirty, setIsCompositionDirty] = useState(false);
  const defaultTab = panel.imageUrl ? "image" : "composition";

  const compositionInitial = useMemo(
    () => ({
      background: panel.background ?? "",
      foreground: panel.foreground ?? "",
      environment: panel.environment ?? "",
      characterPose: panel.characterPose ?? "",
      composition: panel.composition ?? "",
      propsUsed: parsePropsUsed(panel.propsUsed),
    }),
    [
      panel.background,
      panel.foreground,
      panel.environment,
      panel.characterPose,
      panel.composition,
      panel.propsUsed,
    ]
  );

  const hasUnsavedPromptChanges = useMemo(
    () => promptOverride !== savedPromptBase,
    [promptOverride, savedPromptBase]
  );

  const requestPreview = useMemo(
    () =>
      JSON.stringify(
        {
          prompt: promptOverride,
          aspect_ratio: panel.aspectRatio,
          output_format: "png",
          image: panel.outlineReferenceUrl,
        },
        null,
        2
      ),
    [panel.aspectRatio, panel.outlineReferenceUrl, promptOverride]
  );

  function handleSaveComposition(formData: FormData) {
    startSaveCompositionTransition(async () => {
      const result = await updateStoryboardCompositionAction(
        panel.storyId,
        panel.id,
        formData
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setIsCompositionDirty(false);
      toast.success("Composition saved");
      router.refresh();
    });
  }

  function handleGeneratePanel(formData: FormData) {
    startGeneratingTransition(async () => {
      formData.set("promptOverride", promptOverride);
      const result = await generateStoryboardPanelImageAction(formData);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(panel.imageUrl ? "Panel regenerated" : "Panel generated");
      router.refresh();
    });
  }

  function handleGenerateFromTop() {
    const formData = new FormData();
    formData.set("storyId", panel.storyId);
    formData.set("panelId", panel.id);
    formData.set("promptOverride", promptOverride);
    handleGeneratePanel(formData);
  }

  function handleSavePromptDraft() {
    startSavePromptTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", panel.storyId);
      formData.set("panelId", panel.id);
      formData.set("promptOverride", promptOverride);
      const result = await saveStoryboardPanelPromptDraftAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSavedPromptBase(promptOverride);
      toast.success("Prompt draft saved");
      router.refresh();
    });
  }

  function handleCompositionFormChange(form: HTMLFormElement) {
    const data = new FormData(form);
    const dirty =
      String(data.get("background") ?? "") !== compositionInitial.background ||
      String(data.get("foreground") ?? "") !== compositionInitial.foreground ||
      String(data.get("environment") ?? "") !== compositionInitial.environment ||
      String(data.get("characterPose") ?? "") !== compositionInitial.characterPose ||
      String(data.get("composition") ?? "") !== compositionInitial.composition ||
      String(data.get("propsUsed") ?? "") !== compositionInitial.propsUsed;
    setIsCompositionDirty(dirty);
  }

  function handleReuseRun(runArtifactId: string) {
    setIsReusingRunId(runArtifactId);
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", panel.storyId);
      formData.set("panelId", panel.id);
      formData.set("runArtifactId", runArtifactId);
      const result = await generateStoryboardPanelImageFromRunAction(formData);
      setIsReusingRunId(null);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Panel regenerated from selected run");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Panel {panel.sceneNumber}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" title="Full request preview">
                  <Code2 className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Full request preview</DialogTitle>
                  <DialogDescription>
                    Exact payload that will be sent to NanoBanana Pro.
                  </DialogDescription>
                </DialogHeader>
                <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {requestPreview}
                </pre>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" title="Run history">
                  <History className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Run history</DialogTitle>
                  <DialogDescription>
                    Recent storyboard generation attempts for this panel.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-auto">
                  {panel.runHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No previous runs yet.</p>
                  ) : (
                    panel.runHistory.map((run) => (
                      <div key={run.id} className="space-y-1 rounded-md border p-2 text-xs">
                        <p className="text-muted-foreground">
                          {run.status ?? "unknown"} · {formatTimestamp(run.createdAt)}
                        </p>
                        {run.errorMessage ? (
                          <p className="text-destructive">error: {run.errorMessage}</p>
                        ) : null}
                        {run.resultUrl ? (
                          <p className="text-muted-foreground">result: {run.resultUrl}</p>
                        ) : null}
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">
                            payload + prompt
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2">
                            {run.parameters ?? run.rawPrompt}
                          </pre>
                        </details>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPromptOverride(run.rawPrompt)}
                            disabled={isGenerating || isSavingPrompt}
                          >
                            Use Prompt
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReuseRun(run.id)}
                            disabled={isGenerating || isSavingPrompt}
                          >
                            {isReusingRunId === run.id ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Reusing...
                              </>
                            ) : (
                              "Reuse Run + Generate"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant={panel.imageUrl ? "outline" : "default"}
              size="sm"
              onClick={handleGenerateFromTop}
              disabled={isGenerating || isSavingPrompt}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {panel.imageUrl ? "Regenerating..." : "Generating..."}
                </>
              ) : panel.imageUrl ? (
                "Regenerate This Panel"
              ) : (
                "Generate This Panel"
              )}
            </Button>
          </div>
        </div>

      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="composition">Composition</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-3">
            <div className="grid gap-1">
              <Label>Scene context</Label>
              <p className="text-sm text-muted-foreground">
                {panel.sceneDescription || panel.spreadText || "No scene text"}
              </p>
            </div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-white">
              {panel.imageUrl ? (
                <Image
                  src={panel.imageUrl}
                  alt={`Storyboard panel ${panel.sceneNumber}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No image generated yet
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="composition">
            <form
              action={handleSaveComposition}
              onChange={(event) => {
                handleCompositionFormChange(event.currentTarget);
              }}
              className="grid gap-2"
            >
              <div className="grid gap-1">
                <Label htmlFor={`background-${panel.id}`}>Background</Label>
                <Textarea
                  id={`background-${panel.id}`}
                  name="background"
                  defaultValue={panel.background ?? ""}
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`foreground-${panel.id}`}>Foreground</Label>
                <Textarea
                  id={`foreground-${panel.id}`}
                  name="foreground"
                  defaultValue={panel.foreground ?? ""}
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`environment-${panel.id}`}>Environment</Label>
                <Textarea
                  id={`environment-${panel.id}`}
                  name="environment"
                  defaultValue={panel.environment ?? ""}
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`pose-${panel.id}`}>Character pose</Label>
                <Textarea
                  id={`pose-${panel.id}`}
                  name="characterPose"
                  defaultValue={panel.characterPose ?? ""}
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`composition-${panel.id}`}>Composition/camera</Label>
                <Textarea
                  id={`composition-${panel.id}`}
                  name="composition"
                  defaultValue={panel.composition ?? ""}
                  rows={3}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`propsUsed-${panel.id}`}>
                  Props used (comma separated)
                </Label>
                <Textarea
                  id={`propsUsed-${panel.id}`}
                  name="propsUsed"
                  defaultValue={parsePropsUsed(panel.propsUsed)}
                  placeholder={panel.linkedPropsText}
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Save composition to refresh the generated prompt preview.
              </p>
              {isCompositionDirty ? (
                <p className="text-xs text-amber-600">Unsaved composition changes</p>
              ) : null}
              <Button
                type="submit"
                variant={isCompositionDirty ? "default" : "secondary"}
                disabled={isSavingComposition || !isCompositionDirty}
              >
                {isSavingComposition ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Composition"
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="prompt">
            <div className="grid gap-2">
              <StoryboardPromptEditor
                inputId={`prompt-${panel.id}`}
                promptValue={promptOverride}
                onPromptChange={setPromptOverride}
              />
              {hasUnsavedPromptChanges ? (
                <p className="text-xs text-amber-600">Unsaved prompt changes</p>
              ) : null}
              <Button
                type="button"
                variant={hasUnsavedPromptChanges ? "default" : "secondary"}
                onClick={handleSavePromptDraft}
                disabled={isSavingPrompt || isGenerating || !hasUnsavedPromptChanges}
              >
                {isSavingPrompt ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving Prompt...
                  </>
                ) : (
                  "Save Prompt Draft"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Code2, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  generateStoryboardCoverAction,
  generateStoryboardCoverFromRunAction,
  saveStoryboardCoverPromptDraftAction,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type CoverRun = {
  id: string;
  status: string | null;
  errorMessage: string | null;
  rawPrompt: string;
  parameters: string | null;
  resultUrl: string | null;
  createdAt: string | null;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "never";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}

export function StoryboardCoverCard({
  storyId,
  imageUrl,
  promptPreview,
  outlineReferenceUrl,
  aspectRatio,
  runHistory,
}: {
  storyId: string;
  imageUrl: string | null;
  promptPreview: string;
  outlineReferenceUrl: string | null;
  aspectRatio: string;
  runHistory: CoverRun[];
}) {
  const router = useRouter();
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isSavingPrompt, startSavePromptTransition] = useTransition();
  const [isReusingRunId, setIsReusingRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(promptPreview);
  const [savedPromptBase, setSavedPromptBase] = useState(promptPreview);

  useEffect(() => {
    setPrompt(promptPreview);
    setSavedPromptBase(promptPreview);
  }, [promptPreview]);

  const hasUnsavedPrompt = prompt !== savedPromptBase;

  const requestPreview = useMemo(
    () =>
      JSON.stringify(
        {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "png",
          image: outlineReferenceUrl,
        },
        null,
        2
      ),
    [aspectRatio, outlineReferenceUrl, prompt]
  );

  function generateCover() {
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("coverPrompt", prompt);
      const result = await generateStoryboardCoverAction(formData);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(imageUrl ? "Cover regenerated" : "Cover generated");
      router.refresh();
    });
  }

  function savePromptDraft() {
    startSavePromptTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("coverPrompt", prompt);
      const result = await saveStoryboardCoverPromptDraftAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSavedPromptBase(prompt);
      toast.success("Cover prompt draft saved");
      router.refresh();
    });
  }

  function reuseRun(runArtifactId: string) {
    setIsReusingRunId(runArtifactId);
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("runArtifactId", runArtifactId);
      const result = await generateStoryboardCoverFromRunAction(formData);
      setIsReusingRunId(null);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Cover regenerated from selected run");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Storyboard Draft Cover</CardTitle>
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
                  <DialogTitle>Cover run history</DialogTitle>
                  <DialogDescription>
                    Recent storyboard cover generation attempts.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-auto">
                  {runHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No previous runs yet.</p>
                  ) : (
                    runHistory.map((run) => (
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
                            onClick={() => setPrompt(run.rawPrompt)}
                            disabled={isGenerating || isSavingPrompt}
                          >
                            Use Prompt
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => reuseRun(run.id)}
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
              variant={imageUrl ? "outline" : "default"}
              size="sm"
              onClick={generateCover}
              disabled={isGenerating || isSavingPrompt}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {imageUrl ? "Regenerating..." : "Generating..."}
                </>
              ) : imageUrl ? (
                "Regenerate Cover"
              ) : (
                "Generate Cover"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-md border bg-white">
          {imageUrl ? (
            <Image src={imageUrl} alt="Storyboard draft cover" fill className="object-contain" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No cover generated yet.
            </div>
          )}
        </div>

        <div className="grid gap-1">
          <Label htmlFor="storyboard-cover-prompt">Exact prompt sent to NanoBanana Pro</Label>
          <Textarea
            id="storyboard-cover-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            className="text-xs"
          />
        </div>
        {hasUnsavedPrompt ? (
          <p className="text-xs text-amber-600">Unsaved prompt changes</p>
        ) : null}
        <Button
          type="button"
          variant={hasUnsavedPrompt ? "default" : "secondary"}
          onClick={savePromptDraft}
          disabled={isSavingPrompt || isGenerating || !hasUnsavedPrompt}
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
      </CardContent>
    </Card>
  );
}


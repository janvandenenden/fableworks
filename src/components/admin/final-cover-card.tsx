"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Code2, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateFinalCoverAction,
  generateFinalCoverFromRunAction,
  saveFinalCoverPromptDraftAction,
} from "@/app/admin/stories/[id]/pages/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type CoverCharacter = {
  id: string;
  name: string;
  status: string;
  hasSelectedVariant: boolean;
  selectedVariantImageUrl: string | null;
};

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

export function FinalCoverCard({
  storyId,
  storyboardCoverImageUrl,
  finalCoverImageUrl,
  promptPreview,
  availableCharacters,
  defaultCharacterId,
  runHistory,
}: {
  storyId: string;
  storyboardCoverImageUrl: string | null;
  finalCoverImageUrl: string | null;
  promptPreview: string;
  availableCharacters: CoverCharacter[];
  defaultCharacterId: string | null;
  runHistory: CoverRun[];
}) {
  const router = useRouter();
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isSavingPrompt, startSavePromptTransition] = useTransition();
  const [isReusingRunId, setIsReusingRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(promptPreview);
  const [savedPromptBase, setSavedPromptBase] = useState(promptPreview);
  const [characterId, setCharacterId] = useState(defaultCharacterId ?? "__none");

  const selectedCharacter = availableCharacters.find((character) => character.id === characterId);
  const hasUnsavedPrompt = prompt !== savedPromptBase;
  const canGenerate = Boolean(storyboardCoverImageUrl && selectedCharacter?.hasSelectedVariant);

  const requestPreview = JSON.stringify(
    {
      prompt,
      character_id: characterId === "__none" ? null : characterId,
      image:
        storyboardCoverImageUrl && selectedCharacter?.selectedVariantImageUrl
          ? [storyboardCoverImageUrl, selectedCharacter.selectedVariantImageUrl]
          : [storyboardCoverImageUrl].filter(Boolean),
      aspect_ratio: "4:3",
      output_format: "png",
    },
    null,
    2
  );

  function generateCover() {
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("promptOverride", prompt);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      const result = await generateFinalCoverAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(finalCoverImageUrl ? "Cover regenerated" : "Cover generated");
      router.refresh();
    });
  }

  function savePromptDraft() {
    startSavePromptTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("promptOverride", prompt);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      const result = await saveFinalCoverPromptDraftAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSavedPromptBase(prompt);
      toast.success("Final cover prompt draft saved");
      router.refresh();
    });
  }

  function reuseRun(runArtifactId: string) {
    setIsReusingRunId(runArtifactId);
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", storyId);
      formData.set("runArtifactId", runArtifactId);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      const result = await generateFinalCoverFromRunAction(formData);
      setIsReusingRunId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Cover regenerated from selected run");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Final Cover (Personalized)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Start from storyboard cover sketch and apply selected character identity.
            </p>
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
                    Exact payload that will be sent to NanoBanana.
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
                  <DialogTitle>Final cover run history</DialogTitle>
                  <DialogDescription>
                    Recent final cover generation attempts.
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="prompt">Character + Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Storyboard Cover Sketch</p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-white">
                  {storyboardCoverImageUrl ? (
                    <Image
                      src={storyboardCoverImageUrl}
                      alt="Storyboard cover sketch"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Generate storyboard cover first.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Final Personalized Cover</p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-white">
                  {finalCoverImageUrl ? (
                    <Image
                      src={finalCoverImageUrl}
                      alt="Final personalized cover"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No final cover yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-3 pt-3">
            <div className="grid gap-1">
              <Label htmlFor={`cover-character-${storyId}`}>Character</Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger id={`cover-character-${storyId}`}>
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No character selected</SelectItem>
                  {availableCharacters.map((character) => (
                    <SelectItem key={character.id} value={character.id}>
                      {character.name} ({character.status})
                      {character.hasSelectedVariant ? "" : " - no selected variant"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`cover-prompt-${storyId}`}>Exact prompt sent to NanoBanana</Label>
              <Textarea
                id={`cover-prompt-${storyId}`}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={8}
                className="text-xs"
              />
            </div>

            {!canGenerate ? (
              <p className="text-xs text-amber-600">
                Requires storyboard cover sketch and selected character variant.
              </p>
            ) : null}
            {hasUnsavedPrompt ? (
              <p className="text-xs text-amber-600">Unsaved prompt changes</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={finalCoverImageUrl ? "outline" : "default"}
                size="sm"
                onClick={generateCover}
                disabled={isGenerating || isSavingPrompt || !canGenerate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {finalCoverImageUrl ? "Regenerating..." : "Generating..."}
                  </>
                ) : finalCoverImageUrl ? (
                  "Regenerate Cover"
                ) : (
                  "Generate Cover"
                )}
              </Button>

              <Button
                type="button"
                variant={hasUnsavedPrompt ? "default" : "secondary"}
                onClick={savePromptDraft}
                size="sm"
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
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Code2, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  approveFinalPageVersionAction,
  generateFinalPageAction,
  generateFinalPageFromRunAction,
  saveFinalPagePromptDraftAction,
} from "@/app/admin/stories/[id]/pages/actions";
import type { FinalPageSceneData } from "@/components/admin/final-pages-view";
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

function formatTimestamp(value: string | null): string {
  if (!value) return "never";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}

export function FinalPageCard({
  scene,
  defaultTab = "images",
}: {
  scene: FinalPageSceneData;
  defaultTab?: "images" | "prompt";
}) {
  const router = useRouter();
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isSavingPrompt, startSavePromptTransition] = useTransition();
  const [isApproving, startApproveTransition] = useTransition();
  const [isReusingRunId, setIsReusingRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(scene.promptPreview);
  const [savedPromptBase, setSavedPromptBase] = useState(scene.promptPreview);
  const [characterId, setCharacterId] = useState(scene.defaultCharacterId ?? "__none");

  const hasUnsavedPrompt = prompt !== savedPromptBase;
  const storyLinkedCharacter = scene.availableCharacters.find(
    (candidate) => candidate.id === scene.storyLinkedCharacterId
  );
  const selectedCharacter = scene.availableCharacters.find(
    (candidate) => candidate.id === characterId
  );
  const canGenerateWithSelectedCharacter =
    characterId === "__none"
      ? Boolean(storyLinkedCharacter?.hasSelectedVariant)
      : Boolean(selectedCharacter?.hasSelectedVariant);
  const effectiveCharacterReferenceUrl =
    characterId === "__none"
      ? storyLinkedCharacter?.selectedVariantImageUrl ?? null
      : selectedCharacter?.selectedVariantImageUrl ?? null;

  const requestPreview = useMemo(
    () =>
      JSON.stringify(
        {
          prompt,
          character_id: characterId === "__none" ? null : characterId,
          image_input: effectiveCharacterReferenceUrl
            ? [scene.storyboardImageUrl, effectiveCharacterReferenceUrl]
            : [scene.storyboardImageUrl],
          aspect_ratio: "4:3",
          output_format: "png",
        },
        null,
        2
      ),
    [characterId, effectiveCharacterReferenceUrl, prompt, scene.storyboardImageUrl]
  );

  function generatePage() {
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", scene.storyId);
      formData.set("sceneId", scene.sceneId);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      if (hasUnsavedPrompt) {
        formData.set("promptOverride", prompt);
      }
      const result = await generateFinalPageAction(formData);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(scene.latestImageUrl ? "Page regenerated" : "Page generated");
      router.refresh();
    });
  }

  function savePromptDraft() {
    startSavePromptTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", scene.storyId);
      formData.set("sceneId", scene.sceneId);
      formData.set("promptOverride", prompt);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      const result = await saveFinalPagePromptDraftAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSavedPromptBase(prompt);
      toast.success("Prompt draft saved");
      router.refresh();
    });
  }

  function reuseRun(runArtifactId: string) {
    setIsReusingRunId(runArtifactId);
    startGeneratingTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", scene.storyId);
      formData.set("sceneId", scene.sceneId);
      formData.set("runArtifactId", runArtifactId);
      if (characterId !== "__none") {
        formData.set("characterId", characterId);
      }
      const result = await generateFinalPageFromRunAction(formData);
      setIsReusingRunId(null);
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Page regenerated from selected run");
      router.refresh();
    });
  }

  function approveVersion(finalPageId: string, approved: boolean) {
    startApproveTransition(async () => {
      const formData = new FormData();
      formData.set("storyId", scene.storyId);
      formData.set("finalPageId", finalPageId);
      formData.set("approved", approved ? "true" : "false");
      const result = await approveFinalPageVersionAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(approved ? "Version approved" : "Approval removed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Scene {scene.sceneNumber}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Latest version: {scene.latestVersion ?? "none"}
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
                  <DialogTitle>Run history</DialogTitle>
                  <DialogDescription>
                    Recent final page generation attempts for this scene.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-auto">
              {scene.runHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No previous runs yet.</p>
                  ) : (
                    scene.runHistory.map((run) => (
                      <div key={run.id} className="space-y-1 rounded-md border p-2 text-xs">
                        <p className="text-muted-foreground">
                          {run.status ?? "unknown"} · {formatTimestamp(run.createdAt)}
                        </p>
                        {run.characterName ? (
                          <p className="text-muted-foreground">character: {run.characterName}</p>
                        ) : null}
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
              variant={scene.latestImageUrl ? "outline" : "default"}
              size="sm"
              onClick={generatePage}
              disabled={isGenerating || isSavingPrompt || !canGenerateWithSelectedCharacter}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {scene.latestImageUrl ? "Regenerating..." : "Generating..."}
                </>
              ) : scene.latestImageUrl ? (
                "Regenerate Page"
              ) : (
                "Generate Page"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="prompt">Character + Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Storyboard reference</p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-white">
                  {scene.storyboardImageUrl ? (
                    <Image
                      src={scene.storyboardImageUrl}
                      alt={`Storyboard scene ${scene.sceneNumber}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No storyboard image
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Latest final page</p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-white">
                  {scene.latestImageUrl ? (
                    <Image
                      src={scene.latestImageUrl}
                      alt={`Final page scene ${scene.sceneNumber}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No final page yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Versions</p>
              {scene.versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No versions yet.</p>
              ) : (
                <div className="space-y-1">
                  {scene.versions
                    .slice()
                    .sort((a, b) => b.version - a.version)
                    .map((versionRow) => (
                      <div
                        key={versionRow.id}
                        className="flex items-center justify-between rounded-md border px-2 py-1 text-xs"
                      >
                        <span>
                          v{versionRow.version}
                          {versionRow.isApproved ? " (approved)" : ""}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={versionRow.isApproved ? "secondary" : "outline"}
                          onClick={() => approveVersion(versionRow.id, !versionRow.isApproved)}
                          disabled={isApproving}
                        >
                          {versionRow.isApproved ? "Unapprove" : "Approve"}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-3 pt-3">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Spread: {scene.spreadText ?? "none"}</p>
              <p>Scene: {scene.sceneDescription ?? "none"}</p>
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`final-page-character-${scene.sceneId}`}>
                Character for this generation
              </Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger id={`final-page-character-${scene.sceneId}`} className="w-full">
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Use story linked character</SelectItem>
                  {scene.availableCharacters.map((character) => (
                    <SelectItem key={character.id} value={character.id}>
                      {character.name}
                      {character.hasSelectedVariant ? "" : " (no selected image)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {characterId !== "__none" && selectedCharacter?.hasSelectedVariant === false ? (
                <p className="text-xs text-amber-600">
                  Selected character has no selected variant. Choose a variant on the character page.
                </p>
              ) : characterId === "__none" && !scene.hasStoryLinkedCharacter ? (
                <p className="text-xs text-amber-600">
                  No character is linked to this story. Pick a character above to generate this page.
                </p>
              ) : characterId === "__none" && !storyLinkedCharacter?.hasSelectedVariant ? (
                <p className="text-xs text-amber-600">
                  Story-linked character has no selected variant. Choose one on the character page or
                  pick another character here.
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor={`final-page-prompt-${scene.sceneId}`}>
                Exact prompt sent to NanoBanana
              </Label>
              <Textarea
                id={`final-page-prompt-${scene.sceneId}`}
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
              disabled={
                isSavingPrompt ||
                isGenerating ||
                !hasUnsavedPrompt ||
                !canGenerateWithSelectedCharacter
              }
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

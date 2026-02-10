"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { runPlaygroundGeneration } from "./actions";

type Mode = "openai-text" | "openai-vision" | "replicate";

type Result =
  | { type: "text"; content: string }
  | { type: "image"; url: string }
  | null;

export default function PlaygroundPage() {
  const [mode, setMode] = useState<Mode>("openai-text");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!prompt.trim()) return;

    setResult(null);
    setError(null);

    startTransition(async () => {
      const response = await runPlaygroundGeneration(
        mode,
        prompt,
        imageUrl || undefined
      );
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
        <p className="text-muted-foreground">
          Test API connectivity with OpenAI and Replicate.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>
              Select a model and enter a prompt to generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mode">Model</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
              >
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-text">
                    OpenAI Text (GPT-4o)
                  </SelectItem>
                  <SelectItem value="openai-vision">
                    OpenAI Vision (GPT-4o)
                  </SelectItem>
                  <SelectItem value="replicate">
                    Replicate (NanoBanana)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "openai-vision" && (
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Enter your prompt..."
                rows={8}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isPending || !prompt.trim()}
              className="w-full"
            >
              {isPending ? "Generating..." : "Generate"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardDescription>
              {result?.type === "text" && (
                <Badge variant="secondary">Text</Badge>
              )}
              {result?.type === "image" && (
                <Badge variant="secondary">Image</Badge>
              )}
              {!result && !error && !isPending && "Results will appear here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPending && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-48 w-full" />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {result?.type === "text" && (
              <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                {result.content}
              </div>
            )}

            {result?.type === "image" && (
              <div className="overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.url}
                  alt="Generated output"
                  className="h-auto w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

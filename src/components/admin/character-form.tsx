"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCharacterAction } from "@/app/admin/characters/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStylePresets } from "@/lib/prompts/character";

const genders = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Neutral" },
];

export function CharacterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const stylePresets = getStylePresets();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState("anonymous");
  const [gender, setGender] = useState(genders[0]?.value ?? "female");
  const [stylePreset, setStylePreset] = useState(
    stylePresets[0]?.value ?? "watercolor"
  );
  const [characterId] = useState(() => crypto.randomUUID());

  const uploadKey = useMemo(() => {
    if (!sourceImageUrl) return null;
    return sourceImageUrl.split("/").pop() ?? null;
  }, [sourceImageUrl]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      if (!sourceImageUrl) {
        toast.error("Upload a child photo first");
        return;
      }
      const result = await createCharacterAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Character created");
      if (result.warning) {
        toast.warning(`Generation not started: ${result.warning}`);
      }
      router.push(`/admin/characters/${result.data.id}`);
      formRef.current?.reset();
      setGender(genders[0]?.value ?? "female");
      setStylePreset(stylePresets[0]?.value ?? "watercolor");
      setSourceImageUrl(null);
      setUploadError(null);
    });
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    const extension = file.name.split(".").pop() || "jpg";
    const key = `uploads/${userId}/${characterId}/original.${extension}`;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = (await response.json()) as {
        success: boolean;
        publicUrl?: string;
      };

      if (!data.success || !data.publicUrl) {
        throw new Error("Invalid upload response");
      }

      setSourceImageUrl(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create character</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={characterId} />
          <input
            type="hidden"
            name="sourceImageUrl"
            value={sourceImageUrl ?? ""}
          />
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Ava" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="userId">User ID (optional)</Label>
            <Input
              id="userId"
              name="userId"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gender">Gender</Label>
            <input type="hidden" name="gender" value={gender} />
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {genders.map((gender) => (
                  <SelectItem key={gender.value} value={gender.value}>
                    {gender.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stylePreset">Style</Label>
            <input type="hidden" name="stylePreset" value={stylePreset} />
            <Select value={stylePreset} onValueChange={setStylePreset}>
              <SelectTrigger id="stylePreset">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {stylePresets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="photo">Child photo</Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleUpload(event.currentTarget.files?.[0] ?? null)
              }
            />
            {uploadError ? (
              <p className="text-sm text-destructive">{uploadError}</p>
            ) : sourceImageUrl ? (
              <p className="text-sm text-muted-foreground">
                Uploaded: {uploadKey}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload a child photo to continue.
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending || isUploading}>
            {isPending
              ? "Creating..."
              : isUploading
              ? "Uploading..."
              : "Create"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCharacterProfileAction } from "@/app/admin/characters/actions";

type Profile = {
  approxAge: string | null;
  hairColor: string | null;
  hairLength: string | null;
  hairTexture: string | null;
  hairStyle: string | null;
  faceShape: string | null;
  eyeColor: string | null;
  eyeShape: string | null;
  skinTone: string | null;
  clothing: string | null;
  distinctiveFeatures: string | null;
  colorPalette: string | null;
  personalityTraits: string | null;
  doNotChange: string | null;
};

type Props = {
  characterId: string;
  profile: Profile | null;
};

export function CharacterProfileEditor({ characterId, profile }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateCharacterProfileAction(characterId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="approxAge">Approx age</Label>
            <Input
              id="approxAge"
              name="approxAge"
              defaultValue={profile?.approxAge ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hairColor">Hair color</Label>
            <Input
              id="hairColor"
              name="hairColor"
              defaultValue={profile?.hairColor ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hairLength">Hair length</Label>
            <Input
              id="hairLength"
              name="hairLength"
              defaultValue={profile?.hairLength ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hairTexture">Hair texture</Label>
            <Input
              id="hairTexture"
              name="hairTexture"
              defaultValue={profile?.hairTexture ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hairStyle">Hair style</Label>
            <Input
              id="hairStyle"
              name="hairStyle"
              defaultValue={profile?.hairStyle ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="faceShape">Face shape</Label>
            <Input
              id="faceShape"
              name="faceShape"
              defaultValue={profile?.faceShape ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eyeColor">Eye color</Label>
            <Input
              id="eyeColor"
              name="eyeColor"
              defaultValue={profile?.eyeColor ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eyeShape">Eye shape</Label>
            <Input
              id="eyeShape"
              name="eyeShape"
              defaultValue={profile?.eyeShape ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skinTone">Skin tone</Label>
            <Input
              id="skinTone"
              name="skinTone"
              defaultValue={profile?.skinTone ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clothing">Clothing</Label>
            <Input
              id="clothing"
              name="clothing"
              defaultValue={profile?.clothing ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="distinctiveFeatures">Distinctive features</Label>
            <Input
              id="distinctiveFeatures"
              name="distinctiveFeatures"
              defaultValue={profile?.distinctiveFeatures ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="colorPalette">Color palette (comma-separated)</Label>
            <Input
              id="colorPalette"
              name="colorPalette"
              defaultValue={profile?.colorPalette ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="personalityTraits">
              Personality traits (comma-separated)
            </Label>
            <Input
              id="personalityTraits"
              name="personalityTraits"
              defaultValue={profile?.personalityTraits ?? ""}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="doNotChange">Do not change (comma-separated)</Label>
            <Input
              id="doNotChange"
              name="doNotChange"
              defaultValue={profile?.doNotChange ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

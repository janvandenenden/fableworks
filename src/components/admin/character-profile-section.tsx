"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CharacterProfileEditor } from "@/components/admin/character-profile-editor";

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

export function CharacterProfileSection({ characterId, profile }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit profile
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!profile ? (
            <p className="text-muted-foreground">
              Profile not generated yet. Check Inngest logs.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>Approx age: {profile.approxAge || "—"}</div>
              <div>Hair color: {profile.hairColor || "—"}</div>
              <div>Hair length: {profile.hairLength || "—"}</div>
              <div>Hair texture: {profile.hairTexture || "—"}</div>
              <div>Hair style: {profile.hairStyle || "—"}</div>
              <div>Face shape: {profile.faceShape || "—"}</div>
              <div>Eye color: {profile.eyeColor || "—"}</div>
              <div>Eye shape: {profile.eyeShape || "—"}</div>
              <div>Skin tone: {profile.skinTone || "—"}</div>
              <div>Clothing: {profile.clothing || "—"}</div>
              <div>
                Distinctive features: {profile.distinctiveFeatures || "—"}
              </div>
              <div>Color palette: {profile.colorPalette || "—"}</div>
              <div>Personality traits: {profile.personalityTraits || "—"}</div>
              <div>Do not change: {profile.doNotChange || "—"}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <CharacterProfileEditor
        characterId={characterId}
        profile={profile}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
      />
    </div>
  );
}

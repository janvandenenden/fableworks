"use client";

import { useRef, useState, useTransition } from "react";
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const stylePresets = getStylePresets();
  const [gender, setGender] = useState(genders[0]?.value ?? "female");
  const [stylePreset, setStylePreset] = useState(
    stylePresets[0]?.value ?? "watercolor"
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createCharacterAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Character created");
      formRef.current?.reset();
      setGender(genders[0]?.value ?? "female");
      setStylePreset(stylePresets[0]?.value ?? "watercolor");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create character</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Ava" required />
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
            <Label htmlFor="sourceImageUrl">Image URL</Label>
            <Input
              id="sourceImageUrl"
              name="sourceImageUrl"
              placeholder="https://..."
              required
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

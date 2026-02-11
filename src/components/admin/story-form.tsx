"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStoryAction } from "@/app/admin/stories/actions";
import { storyAgeRanges } from "@/lib/prompts/story";
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

export function StoryForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ageRange, setAgeRange] = useState<string>(storyAgeRanges[0]);
  const [theme, setTheme] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("ageRange", ageRange);
    formData.set("theme", theme);

    startTransition(async () => {
      const result = await createStoryAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      toast.success("Concept generated");
      router.push(`/admin/stories/${result.data.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create story</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="ageRange">Age range</Label>
            <input type="hidden" name="ageRange" value={ageRange} />
            <Select value={ageRange} onValueChange={setAgeRange}>
              <SelectTrigger id="ageRange">
                <SelectValue placeholder="Select age range" />
              </SelectTrigger>
              <SelectContent>
                {storyAgeRanges.map((range) => (
                  <SelectItem key={range} value={range}>
                    {range}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme">Theme/Lesson (optional)</Label>
            <Input
              id="theme"
              name="theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="Friendship, confidence, curiosity..."
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Story"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

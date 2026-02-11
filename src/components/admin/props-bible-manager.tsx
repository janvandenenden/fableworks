"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPropAction,
  updatePropAction,
  generatePropsBibleAction,
} from "@/app/admin/stories/[id]/props/actions";
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
import { Textarea } from "@/components/ui/textarea";

type PropItem = {
  id: string;
  title: string;
  category: string | null;
  appearsInScenes: string | null;
  description: string;
  tags: string | null;
};

const categories = ["object", "environment", "element"] as const;

function tagsAsText(value: string | null): string {
  if (!value) return "";
  try {
    return (JSON.parse(value) as string[]).join(", ");
  } catch {
    return "";
  }
}

function scenesAsText(value: string | null): string {
  if (!value) return "";
  try {
    return (JSON.parse(value) as number[]).join(", ");
  } catch {
    return "";
  }
}

export function PropsBibleManager({
  storyId,
  props,
}: {
  storyId: string;
  props: PropItem[];
}) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isCreating, startCreating] = useTransition();
  const [newCategory, setNewCategory] = useState<(typeof categories)[number]>("object");

  function handleGenerate() {
    const formData = new FormData();
    formData.set("storyId", storyId);
    startGenerating(async () => {
      const result = await generatePropsBibleAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Props bible generated");
      router.refresh();
    });
  }

  function handleCreate(formData: FormData) {
    formData.set("category", newCategory);
    startCreating(async () => {
      const result = await createPropAction(storyId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Prop added");
      setNewCategory("object");
      router.refresh();
    });
  }

  function handleUpdate(propId: string, formData: FormData) {
    startCreating(async () => {
      const result = await updatePropAction(storyId, propId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Prop updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate props bible</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Props Bible"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add prop manually</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="new-title">Title</Label>
              <Input id="new-title" name="title" required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-category">Category</Label>
              <input type="hidden" name="category" value={newCategory} />
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as (typeof categories)[number])}>
                <SelectTrigger id="new-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-description">Description</Label>
              <Textarea id="new-description" name="description" rows={4} required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-tags">Tags (comma separated)</Label>
              <Input id="new-tags" name="tags" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="new-scenes">Appears in scenes (comma separated)</Label>
              <Input id="new-scenes" name="appearsInScenes" placeholder="1, 2, 5" />
            </div>
            <Button type="submit" disabled={isCreating}>
              Add Prop
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {props.map((prop) => (
          <Card key={prop.id}>
            <CardHeader>
              <CardTitle>{prop.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={(fd) => handleUpdate(prop.id, fd)} className="grid gap-3">
                <div className="grid gap-1">
                  <Label>Title</Label>
                  <Input name="title" defaultValue={prop.title} required />
                </div>
                <div className="grid gap-1">
                  <Label>Category</Label>
                  <Input
                    name="category"
                    defaultValue={prop.category ?? "object"}
                    placeholder="object | environment | element"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    defaultValue={prop.description}
                    rows={4}
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Tags (comma separated)</Label>
                  <Input name="tags" defaultValue={tagsAsText(prop.tags)} />
                </div>
                <div className="grid gap-1">
                  <Label>Appears in scenes (comma separated)</Label>
                  <Input
                    name="appearsInScenes"
                    defaultValue={scenesAsText(prop.appearsInScenes)}
                    placeholder="1, 2, 5"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Save Prop</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

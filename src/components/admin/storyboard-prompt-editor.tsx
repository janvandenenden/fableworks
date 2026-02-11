"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StoryboardPromptEditor({
  inputId,
  promptValue,
  onPromptChange,
}: {
  inputId: string;
  promptValue: string;
  onPromptChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={inputId}>Exact prompt sent to NanoBanana Pro</Label>
      <Textarea
        id={inputId}
        value={promptValue}
        onChange={(event) => {
          onPromptChange(event.target.value);
        }}
        rows={8}
        className="text-xs"
      />
    </div>
  );
}

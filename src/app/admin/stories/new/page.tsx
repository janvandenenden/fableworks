import Link from "next/link";
import { StoryForm } from "@/components/admin/story-form";

export default function NewStoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">New story</h1>
        <p className="text-sm text-muted-foreground">
          Choose age range and optional theme to start generation.
        </p>
      </div>

      <StoryForm />

      <Link
        href="/admin/stories"
        className="inline-block text-sm text-primary hover:underline"
      >
        Back to stories
      </Link>
    </div>
  );
}

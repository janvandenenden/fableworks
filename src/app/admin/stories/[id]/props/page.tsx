import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { deletePropAction } from "@/app/admin/stories/[id]/props/actions";
import { PropsBibleManager } from "@/components/admin/props-bible-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StoryPropsPage({ params }: Props) {
  const { id } = await params;

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, id))
    .limit(1);
  const story = storyRows[0];
  if (!story) notFound();

  const props = await db
    .select()
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, id))
    .orderBy(asc(schema.propsBibleEntries.title));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Props bible</h1>
          <p className="text-sm text-muted-foreground">
            Story: {story.title?.trim() || "Untitled story"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/stories/${id}`}>Back to story</Link>
        </Button>
      </div>

      <PropsBibleManager
        storyId={id}
        props={props.map((prop) => ({
          id: prop.id,
          title: prop.title,
          category: prop.category,
          appearsInScenes: prop.appearsInScenes,
          description: prop.description,
          tags: prop.tags,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Delete prop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {props.length === 0 ? (
            <p className="text-sm text-muted-foreground">No props to delete.</p>
          ) : (
            props.map((prop) => (
              <form key={prop.id} action={deletePropAction} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium">{prop.title}</p>
                  <p className="text-muted-foreground">{prop.category ?? "object"}</p>
                  {prop.appearsInScenes ? (
                    <p className="text-muted-foreground">
                      Scenes: {(() => {
                        try {
                          return (JSON.parse(prop.appearsInScenes) as number[]).join(", ");
                        } catch {
                          return "";
                        }
                      })()}
                    </p>
                  ) : null}
                </div>
                <input type="hidden" name="storyId" value={id} />
                <input type="hidden" name="propId" value={prop.id} />
                <Button type="submit" variant="destructive">
                  Delete
                </Button>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

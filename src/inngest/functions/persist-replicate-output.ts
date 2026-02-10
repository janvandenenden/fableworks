import { inngest } from "@/inngest/client";
import { copyFromTempUrl } from "@/lib/r2";
import { db, schema } from "@/db";

type PersistReplicateEvent = {
  name: "replicate/output.persist";
  data: {
    entityType: string;
    entityId?: string | null;
    sourceUrl: string;
    destKey: string;
    mimeType?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};

function newId(): string {
  return crypto.randomUUID();
}

export const persistReplicateOutput = inngest.createFunction(
  { id: "persist-replicate-output" },
  { event: "replicate/output.persist" },
  async ({ event }) => {
    const data = (event as PersistReplicateEvent).data;
    const storageUrl = await copyFromTempUrl(data.sourceUrl, data.destKey);

    await db.insert(schema.generatedAssets).values({
      id: newId(),
      type: data.entityType,
      entityId: data.entityId ?? null,
      storageUrl,
      mimeType: data.mimeType ?? null,
      metadata: data.metadata ?? null,
    });

    return { storageUrl };
  }
);

import { z } from "zod";
import { NextResponse } from "next/server";
import { getPublicBaseUrl, uploadToR2 } from "@/lib/r2";

const uploadRequestSchema = z.object({
  key: z.string().min(1),
});

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { key } = uploadRequestSchema.parse(body);
      const publicUrl = `${getPublicBaseUrl()}/${key}`;
      return NextResponse.json({ success: true, publicUrl });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const key = formData.get("key");

    if (!(file instanceof Blob)) {
      return errorResponse("Missing file payload");
    }
    if (typeof key !== "string" || key.length === 0) {
      return errorResponse("Missing upload key");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(
      buffer,
      key,
      file.type || "application/octet-stream"
    );

    return NextResponse.json({ success: true, publicUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid upload request";
    return errorResponse(message);
  }
}

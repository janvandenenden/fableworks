import { z } from "zod";
import { NextResponse } from "next/server";
import { getPublicBaseUrl, uploadToR2 } from "@/lib/r2";

const uploadRequestSchema = z.object({
  key: z.string().min(1),
});

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

    if (!(file instanceof File) || typeof key !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid upload payload" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(
      buffer,
      key,
      file.type || "application/octet-stream"
    );

    return NextResponse.json({ success: true, publicUrl });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid upload request" },
      { status: 400 }
    );
  }
}

import { z } from "zod";
import { NextResponse } from "next/server";
import { getPresignedUploadUrl, getPublicBaseUrl } from "@/lib/r2";

const uploadRequestSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, contentType } = uploadRequestSchema.parse(body);
    const url = await getPresignedUploadUrl(key, contentType);
    const publicUrl = `${getPublicBaseUrl()}/${key}`;
    return NextResponse.json({ success: true, url, publicUrl });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid upload request" },
      { status: 400 }
    );
  }
}

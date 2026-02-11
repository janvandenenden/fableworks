import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/upload/route";

const mockUploadToR2 = vi.fn(async () => "https://cdn.example.com/foo.png");
const mockGetPublicBaseUrl = vi.fn(() => "https://cdn.example.com");

vi.mock("@/lib/r2", () => ({
  uploadToR2: mockUploadToR2,
  getPublicBaseUrl: mockGetPublicBaseUrl,
}));

describe("upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns publicUrl for json request", async () => {
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "uploads/test.png" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.publicUrl).toBe("https://cdn.example.com/uploads/test.png");
  });

  it("uploads file via form-data", async () => {
    const formData = new FormData();
    const file = new File(["hello"], "test.png", { type: "image/png" });
    formData.append("file", file);
    formData.append("key", "uploads/test.png");

    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.publicUrl).toBe("https://cdn.example.com/foo.png");
    expect(mockUploadToR2).toHaveBeenCalled();
  });
});

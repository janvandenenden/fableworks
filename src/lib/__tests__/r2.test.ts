import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn().mockResolvedValue({});
const mockGetSignedUrl = vi
  .fn()
  .mockResolvedValue("https://signed-url.example.com/test");

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
      constructor(opts: unknown) {
        void opts;
      }
    },
    PutObjectCommand: class MockPutObjectCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetObjectCommand: class MockGetObjectCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

let uploadToR2: typeof import("@/lib/r2").uploadToR2;
let getPresignedUploadUrl: typeof import("@/lib/r2").getPresignedUploadUrl;
let getPresignedDownloadUrl: typeof import("@/lib/r2").getPresignedDownloadUrl;
let copyFromTempUrl: typeof import("@/lib/r2").copyFromTempUrl;
let deleteFromR2PublicUrl: typeof import("@/lib/r2").deleteFromR2PublicUrl;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  global.fetch = vi.fn() as unknown as typeof fetch;
  const mod = await import("@/lib/r2");
  uploadToR2 = mod.uploadToR2;
  getPresignedUploadUrl = mod.getPresignedUploadUrl;
  getPresignedDownloadUrl = mod.getPresignedDownloadUrl;
  copyFromTempUrl = mod.copyFromTempUrl;
  deleteFromR2PublicUrl = mod.deleteFromR2PublicUrl;
});

describe("r2", () => {
  describe("uploadToR2", () => {
    it("uploads a buffer and returns the public URL", async () => {
      const buffer = Buffer.from("test data");
      const url = await uploadToR2(buffer, "test/file.png", "image/png");

      expect(url).toBe("https://test-r2.example.com/test/file.png");
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe("getPresignedUploadUrl", () => {
    it("returns a presigned URL for upload", async () => {
      const url = await getPresignedUploadUrl("test/file.png", "image/png");
      expect(url).toBe("https://signed-url.example.com/test");
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });
  });

  describe("getPresignedDownloadUrl", () => {
    it("returns a presigned URL for download", async () => {
      const url = await getPresignedDownloadUrl("test/file.png");
      expect(url).toBe("https://signed-url.example.com/test");
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });
  });

  describe("copyFromTempUrl", () => {
    it("fetches from source URL and uploads to R2", async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
        headers: new Headers({ "content-type": "image/png" }),
      } as Response);

      const url = await copyFromTempUrl(
        "https://replicate-temp.example.com/output.png",
        "characters/123/img.png"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://replicate-temp.example.com/output.png"
      );
      expect(url).toBe("https://test-r2.example.com/characters/123/img.png");
    });

    it("throws when fetch fails", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(
        copyFromTempUrl("https://bad-url.example.com/missing.png", "test/key")
      ).rejects.toThrow("Failed to fetch from temp URL: 404 Not Found");
    });
  });

  describe("deleteFromR2PublicUrl", () => {
    it("deletes a public R2 object by URL", async () => {
      await deleteFromR2PublicUrl("https://test-r2.example.com/books/123/page.png");
      expect(mockSend).toHaveBeenCalled();
    });

    it("rejects deleting URL outside configured public base", async () => {
      await expect(
        deleteFromR2PublicUrl("https://other-host.example.com/books/123/page.png")
      ).rejects.toThrow("outside configured public base URL");
    });
  });
});

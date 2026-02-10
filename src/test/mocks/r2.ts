import { vi } from "vitest";

const memoryStore = new Map<string, { buffer: Buffer; contentType: string }>();

export function createMockR2() {
  return {
    uploadToR2: vi.fn(
      async (buffer: Buffer, key: string, contentType: string) => {
        memoryStore.set(key, { buffer, contentType });
        return `https://test-r2.example.com/${key}`;
      }
    ),
    getPresignedUploadUrl: vi.fn(async (key: string) => {
      return `https://test-r2.example.com/presigned-upload/${key}?signature=test`;
    }),
    getPresignedDownloadUrl: vi.fn(async (key: string) => {
      return `https://test-r2.example.com/presigned-download/${key}?signature=test`;
    }),
    copyFromTempUrl: vi.fn(async (_sourceUrl: string, destKey: string) => {
      const fakeBuffer = Buffer.from("fake-image-data");
      memoryStore.set(destKey, {
        buffer: fakeBuffer,
        contentType: "image/png",
      });
      return `https://test-r2.example.com/${destKey}`;
    }),
  };
}

export function mockR2Module() {
  const mock = createMockR2();
  vi.mock("@/lib/r2", () => mock);
  return mock;
}

export function getStoredFile(key: string) {
  return memoryStore.get(key) ?? null;
}

export function clearStore() {
  memoryStore.clear();
}

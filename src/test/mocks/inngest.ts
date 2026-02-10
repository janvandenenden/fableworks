import { vi } from "vitest";

export function createMockInngestClient() {
  const sentEvents: Array<{ name: string; data: unknown }> = [];

  return {
    client: {
      send: vi.fn(async (event: { name: string; data: unknown }) => {
        sentEvents.push(event);
        return { ids: ["mock-event-id"] };
      }),
    },
    sentEvents,
    clearEvents() {
      sentEvents.length = 0;
    },
  };
}

export function createMockInngestStep() {
  return {
    run: vi.fn(
      async <T>(name: string, fn: () => Promise<T>): Promise<T> => fn()
    ),
    sleep: vi.fn(async () => undefined),
    waitForEvent: vi.fn(async () => null),
    sendEvent: vi.fn(async () => ({ ids: ["mock-step-event-id"] })),
  };
}

import { describe, expect, it } from "vitest";
import {
  MANUAL_PRINT_STATUSES,
  getLuluConfigValidationErrors,
  mapLuluStatusToInternal,
  normalizeManualPrintStatus,
  toManualPrintStatusLabel,
} from "@/lib/lulu";

describe("lulu manual helpers", () => {
  it("keeps allowed statuses stable", () => {
    expect(MANUAL_PRINT_STATUSES).toEqual([
      "draft",
      "pdf_ready",
      "submitted_manual",
      "submitted_api",
      "in_production",
      "shipped",
      "delivered",
      "failed",
    ]);
  });

  it("normalizes unknown values to draft", () => {
    expect(normalizeManualPrintStatus(undefined)).toBe("draft");
    expect(normalizeManualPrintStatus(null)).toBe("draft");
    expect(normalizeManualPrintStatus("unknown")).toBe("draft");
  });

  it("formats labels for UI", () => {
    expect(toManualPrintStatusLabel("submitted_manual")).toBe("submitted manual");
    expect(toManualPrintStatusLabel("in_production")).toBe("in production");
  });

  it("maps Lulu statuses into internal statuses", () => {
    expect(mapLuluStatusToInternal("CREATED")).toBe("submitted_api");
    expect(mapLuluStatusToInternal("IN_PRODUCTION")).toBe("in_production");
    expect(mapLuluStatusToInternal("SHIPPED")).toBe("shipped");
    expect(mapLuluStatusToInternal("DELIVERED")).toBe("delivered");
    expect(mapLuluStatusToInternal("FAILED")).toBe("failed");
  });

  it("reports missing required config keys", () => {
    expect(getLuluConfigValidationErrors().length).toBeGreaterThan(0);
  });
});

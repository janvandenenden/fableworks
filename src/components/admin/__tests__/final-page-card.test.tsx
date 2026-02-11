import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FinalPageCard } from "@/components/admin/final-page-card";

const generateFinalPageAction = vi.fn(async () => ({ success: true, data: { id: "page-1" } }));
const generateFinalPageFromRunAction = vi.fn(async () => ({
  success: true,
  data: { id: "page-1" },
}));
const saveFinalPagePromptDraftAction = vi.fn(async () => ({
  success: true,
  data: { id: "scene-1" },
}));
const approveFinalPageVersionAction = vi.fn(async () => ({
  success: true,
  data: { id: "page-1" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const cleanProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => key !== "fill" && key !== "unoptimized")
    );
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...cleanProps} alt={typeof props.alt === "string" ? props.alt : ""} />
    );
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/admin/stories/[id]/pages/actions", () => ({
  generateFinalPageAction: (...args: unknown[]) => generateFinalPageAction(...args),
  generateFinalPageFromRunAction: (...args: unknown[]) =>
    generateFinalPageFromRunAction(...args),
  saveFinalPagePromptDraftAction: (...args: unknown[]) =>
    saveFinalPagePromptDraftAction(...args),
  approveFinalPageVersionAction: (...args: unknown[]) =>
    approveFinalPageVersionAction(...args),
}));

function createScene(overrides?: Partial<Parameters<typeof FinalPageCard>[0]["scene"]>) {
  return {
    storyId: "story-1",
    sceneId: "scene-1",
    sceneNumber: 1,
    spreadText: "Spread text",
    sceneDescription: "Scene description",
    storyboardImageUrl: "https://example.com/storyboard.png",
    latestImageUrl: "https://example.com/final.png",
    latestVersion: 2,
    latestApproved: false,
    promptPreview: "Original prompt",
    runHistory: [],
    availableCharacters: [
      {
        id: "char-1",
        name: "Ava",
        status: "ready",
        hasSelectedVariant: true,
        selectedVariantImageUrl: "https://example.com/char.png",
      },
      {
        id: "char-2",
        name: "NoVariant",
        status: "ready",
        hasSelectedVariant: false,
        selectedVariantImageUrl: null,
      },
    ],
    defaultCharacterId: "char-1",
    hasStoryLinkedCharacter: true,
    storyLinkedCharacterId: "char-1",
    versions: [
      { id: "page-2", version: 2, imageUrl: "https://example.com/final.png", isApproved: false },
      { id: "page-1", version: 1, imageUrl: "https://example.com/final-v1.png", isApproved: true },
    ],
    ...overrides,
  };
}

describe("FinalPageCard", () => {
  it("renders scene tabs and image comparison", () => {
    render(<FinalPageCard scene={createScene()} />);

    expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Character + Prompt" })).toBeInTheDocument();
    expect(screen.getByAltText("Storyboard scene 1")).toBeInTheDocument();
    expect(screen.getByAltText("Final page scene 1")).toBeInTheDocument();
  });

  it("disables generate when using story-linked character without selected variant", () => {
    render(
      <FinalPageCard
        scene={createScene({
          defaultCharacterId: null,
          hasStoryLinkedCharacter: true,
          storyLinkedCharacterId: "char-2",
        })}
        defaultTab="prompt"
      />
    );

    expect(
      screen.getByText(/Story-linked character has no selected variant/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate Page" })).toBeDisabled();
  });

  it("saves prompt draft with selected character id", async () => {
    render(<FinalPageCard scene={createScene()} defaultTab="prompt" />);

    fireEvent.change(screen.getByLabelText(/Exact prompt sent to NanoBanana/i), {
      target: { value: "Updated prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Prompt Draft" }));

    await waitFor(() => expect(saveFinalPagePromptDraftAction).toHaveBeenCalledTimes(1));

    const formData = saveFinalPagePromptDraftAction.mock.calls[0]?.[0] as FormData;
    expect(formData.get("storyId")).toBe("story-1");
    expect(formData.get("sceneId")).toBe("scene-1");
    expect(formData.get("characterId")).toBe("char-1");
    expect(formData.get("promptOverride")).toBe("Updated prompt");
  });
});

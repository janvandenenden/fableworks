import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoryboardPanel } from "@/components/admin/storyboard-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const cleanProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) => key !== "fill" && key !== "unoptimized"
      )
    );
    return (
      // Remove Next.js-only props to keep DOM clean in tests.
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

vi.mock("@/app/admin/stories/[id]/storyboard/actions", () => ({
  generateStoryboardPanelImageAction: vi.fn(async () => ({ success: true, data: { id: "p1" } })),
  generateStoryboardPanelImageFromRunAction: vi.fn(async () => ({
    success: true,
    data: { id: "p1" },
  })),
  saveStoryboardPanelPromptDraftAction: vi.fn(async () => ({
    success: true,
    data: { id: "p1" },
  })),
  updateStoryboardCompositionAction: vi.fn(async () => ({ success: true, data: { id: "p1" } })),
  setStoryboardPanelVersionAction: vi.fn(async () => ({ success: true, data: { id: "p1" } })),
  deleteStoryboardPanelVersionAction: vi.fn(async () => ({
    success: true,
    data: { id: "p1" },
  })),
}));

describe("StoryboardPanel", () => {
  it("renders generated image and storyboard tabs", () => {
    render(
      <StoryboardPanel
        panel={{
          id: "panel-1",
          sceneId: "scene-1",
          sceneNumber: 1,
          spreadText: "Text",
          sceneDescription: "Description",
          background: "bg",
          foreground: "fg",
          environment: "env",
          characterPose: "pose",
          composition: "comp",
          propsUsed: JSON.stringify(["Lantern"]),
          imageUrl: "https://example.com/panel.png",
          status: "generated",
          lastRunStatus: "success",
          lastRunError: null,
          lastRunAt: "2026-02-11T12:00:00.000Z",
          promptPreview: "Prompt text",
          linkedPropsText: "Lantern",
          storyId: "story-1",
          outlineReferenceUrl: "https://example.com/outline.png",
          aspectRatio: "4:3",
          runHistory: [],
          versions: [
            {
              id: "asset-1",
              storageUrl: "https://example.com/panel.png",
              label: "v1",
              isActive: true,
              createdAt: "2026-02-12T10:00:00.000Z",
            },
          ],
        }}
      />
    );

    expect(screen.getByAltText("Storyboard panel 1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Image" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Composition" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Prompt" })).toBeInTheDocument();
  });

  it("shows composition form by default when image is missing", () => {
    render(
      <StoryboardPanel
        panel={{
          id: "panel-2",
          sceneId: "scene-2",
          sceneNumber: 2,
          spreadText: null,
          sceneDescription: null,
          background: "",
          foreground: "",
          environment: "",
          characterPose: "",
          composition: "",
          propsUsed: null,
          imageUrl: null,
          status: "composed",
          lastRunStatus: null,
          lastRunError: null,
          lastRunAt: null,
          promptPreview: "Prompt",
          linkedPropsText: "",
          storyId: "story-1",
          outlineReferenceUrl: "https://example.com/outline.png",
          aspectRatio: "4:3",
          runHistory: [],
          versions: [],
        }}
      />
    );

    expect(screen.getByLabelText("Background")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Composition" })).toBeInTheDocument();
  });
});

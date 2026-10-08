import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiPanel } from "@/components/workspace/ai-panel";

const mocks = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("@/hooks/use-system-spec", () => ({ useSystemSpec: () => ({ spec: null, refresh: vi.fn() }) }));
vi.mock("@/components/workspace/ai-panel/chat-tab", () => ({ ChatTab: () => {
  useEffect(() => { mocks.mount(); return () => { mocks.unmount(); }; }, []);
  return <div>Conversation</div>;
} }));
vi.mock("@/components/workspace/ai-panel/spec-tab", () => ({ SpecTab: () => <div>Specification</div> }));
vi.mock("@/components/workspace/ai-panel/handoff-tab", () => ({ HandoffTab: () => <div>Handoff content</div> }));
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  return { useReducedMotion: () => true, motion: { aside: ({ children, className, inert, ...props }: { children: React.ReactNode; className: string; inert: boolean; "aria-hidden": boolean }) => createElement("aside", { className, inert, "aria-hidden": props["aria-hidden"] }, children) } };
});
afterEach(cleanup);
const props = { open: true, onClose: vi.fn(), projectId: "project", projectName: "My project" };

describe("panel continuity", () => {
  it("honors the requested initial tab", () => {
    render(<AiPanel {...props} initialTab="spec" />);
    expect(screen.getByText("Specification")).toBeTruthy();
  });
  it("keeps chat mounted when switching output tabs", () => {
    render(<AiPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Spec" }));
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    expect(mocks.unmount).not.toHaveBeenCalled();
    expect(screen.getByText("Conversation").parentElement?.className).toBe("hidden");
  });
  it("keeps chat mounted while closing and reopening the panel", () => {
    const { rerender } = render(<AiPanel {...props} />);
    rerender(<AiPanel {...props} open={false} />);
    expect(document.querySelector("aside")?.hasAttribute("inert")).toBe(true);
    rerender(<AiPanel {...props} />);
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    expect(mocks.unmount).not.toHaveBeenCalled();
  });
  it("remounts chat when switching projects", () => {
    const { rerender } = render(<AiPanel {...props} />);
    rerender(<AiPanel {...props} projectId="another" />);
    expect(mocks.mount).toHaveBeenCalledTimes(2);
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
  });
  it("routes a supplied prompt to Chat rather than the requested output tab", () => {
    render(<AiPanel {...props} initialTab="spec" initialPrompt="Review this" />);
    expect(screen.queryByText("Specification")).toBeNull();
    expect(screen.getByText("Conversation").parentElement?.className).not.toBe("hidden");
  });
});

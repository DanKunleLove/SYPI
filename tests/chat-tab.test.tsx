import { createRef, StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatTab } from "@/components/workspace/ai-panel/chat-tab";

const mocks = vi.hoisted(() => ({
  send: vi.fn(), stop: vi.fn(), findResumable: vi.fn(),
  chat: { messages: [], displayMessages: [], input: "Draft", isLoading: false, isSaving: false, historyLoading: false, historyError: null, saveError: null },
  generation: { status: "idle", steps: [] },
  flow: { getNodes: () => [], getEdges: () => [] },
}));
vi.mock("@xyflow/react", () => ({ useReactFlow: () => mocks.flow }));
vi.mock("@/hooks/use-ai-chat", () => ({ useAiChat: () => ({ ...mocks.chat, sendMessage: mocks.send, stop: mocks.stop, setInput: vi.fn() }) }));
vi.mock("@/hooks/use-generation", () => ({ useGeneration: () => ({ ...mocks.generation, findResumable: mocks.findResumable }) }));
vi.mock("@/components/workspace/ai-panel/open-decisions-tray", () => ({ OpenDecisionsTray: () => null }));
const props = { projectId: "project", inputRef: createRef<HTMLTextAreaElement>() };
beforeEach(() => {
  mocks.send.mockResolvedValue(undefined);
  mocks.findResumable.mockResolvedValue(null);
  Object.assign(mocks.chat, { isLoading: false, isSaving: false, historyLoading: false });
  mocks.generation.status = "idle";
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("chat controls", () => {
  it("sends supplied prompts once under Strict Mode effect replay", async () => {
    vi.useFakeTimers();
    render(<StrictMode><ChatTab {...props} initialPrompt="Automatic" /></StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("Automatic");
  });
  it("retries a pending automatic prompt after a busy render cancels its timer", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ChatTab {...props} initialPrompt="Automatic" />);
    mocks.chat.isLoading = true;
    rerender(<ChatTab {...props} initialPrompt="Automatic" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.chat.isLoading = false;
    rerender(<ChatTab {...props} initialPrompt="Automatic" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("Automatic");
  });
  it("disables duplicate submission while saving", async () => {
    mocks.chat.isSaving = true;
    render(<ChatTab {...props} />);
    await act(async () => {});
    expect((screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("textbox", { name: "Message your AI Twin" }) as HTMLTextAreaElement).disabled).toBe(true);
  });
  it("allows stopping a streaming reply", async () => {
    mocks.chat.isLoading = true;
    render(<ChatTab {...props} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Stop reply" }));
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
  it("does not submit Enter during IME composition", async () => {
    render(<ChatTab {...props} />);
    await act(async () => {});
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", isComposing: true });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("submits Enter and preserves Shift+Enter", async () => {
    render(<ChatTab {...props} />);
    await act(async () => {});
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("Draft");
  });
});

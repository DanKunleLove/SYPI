import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiChat } from "@/hooks/use-ai-chat";
import type { ChatMessage } from "@/lib/ai/chat-history";

const mocks = vi.hoisted(() => ({
  createFeed: vi.fn(), save: vi.fn(), send: vi.fn(), setMessages: vi.fn(), stop: vi.fn(),
  feed: { messages: [] as unknown[], isLoading: false, error: null as Error | null, hasFetchedAll: true, isFetchingMore: false, fetchMore: vi.fn() },
  chat: { messages: [] as ChatMessage[], status: "ready", error: undefined },
  finish: undefined as undefined | ((event: { message: ChatMessage; isAbort: boolean; isError: boolean }) => void),
}));
vi.mock("@liveblocks/react", () => ({
  useCreateFeed: () => mocks.createFeed,
  useCreateFeedMessage: () => mocks.save,
  useFeedMessages: () => mocks.feed,
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { onFinish: typeof mocks.finish }) => {
    mocks.finish = options.onFinish;
    return { ...mocks.chat, sendMessage: mocks.send, setMessages: mocks.setMessages, stop: mocks.stop };
  },
}));

const options = { projectId: "project", getNodes: () => [], getEdges: () => [] };
const message: ChatMessage = { id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved reply" }] };
beforeEach(() => {
  mocks.createFeed.mockResolvedValue({});
  mocks.save.mockResolvedValue({});
  mocks.send.mockResolvedValue(undefined);
  Object.assign(mocks.feed, { messages: [], isLoading: false, error: null, hasFetchedAll: true, isFetchingMore: false });
  Object.assign(mocks.chat, { messages: [], status: "ready" });
});
afterEach(cleanup);

describe("saved conversation lifecycle", () => {
  it("hydrates saved messages once without replayable tool parts", () => {
    mocks.feed.messages = [{ id: "feed", createdAt: 10, data: { role: "assistant", content: "Saved reply", messageId: "reply", partsJson: '[{"type":"tool-addNode"}]' } }];
    const { rerender, result } = renderHook(() => useAiChat(options));
    rerender();
    expect(mocks.setMessages).toHaveBeenCalledTimes(1);
    expect(result.current.displayMessages[0].parts).toEqual(message.parts);
    expect(result.current.displayMessages[0].metadata?.restored).toBe(true);
  });
  it("waits for history before allowing dispatch", async () => {
    mocks.feed.isLoading = true;
    const { result } = renderHook(() => useAiChat(options));
    await act(() => result.current.sendMessage("Idea"));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not overwrite context when history failed", () => {
    mocks.feed.error = new Error("Offline");
    renderHook(() => useAiChat(options));
    expect(mocks.setMessages).not.toHaveBeenCalled();
  });
  it("limits hydration to the most recent 40 messages while displaying all history", () => {
    mocks.feed.messages = Array.from({ length: 60 }, (_, index) => ({ id: `${index}`, createdAt: index, data: { role: "user", content: `Message ${index}` } }));
    const { result } = renderHook(() => useAiChat(options));
    expect(mocks.setMessages.mock.calls[0][0]).toHaveLength(40);
    expect(result.current.displayMessages).toHaveLength(60);
  });
  it("saves the user before dispatch with the same ID", async () => {
    const { result } = renderHook(() => useAiChat(options));
    await act(() => result.current.sendMessage("Idea"));
    const saved = mocks.save.mock.calls[0][1];
    expect(mocks.send.mock.calls[0][0].id).toBe(saved.messageId);
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
    expect(mocks.send.mock.calls[0][1].body.projectId).toBe("project");
  });
  it("blocks overlapping clicks while a save is pending", async () => {
    let resolve!: (value: object) => void;
    mocks.save.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useAiChat(options));
    let pending!: Promise<void>;
    act(() => { pending = result.current.sendMessage("First"); });
    expect(result.current.isSaving).toBe(true);
    await act(() => result.current.sendMessage("Duplicate"));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({}); await pending; });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });
  it("retains the draft and never calls the model after a failed save", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useAiChat(options));
    act(() => result.current.setInput("Draft"));
    await act(async () => { await expect(result.current.sendMessage("Draft")).rejects.toThrow("Message not saved"); });
    expect(result.current.input).toBe("Draft");
    expect(result.current.saveError).toContain("could not be saved");
    expect(result.current.isSaving).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    await act(() => result.current.sendMessage("Draft"));
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("finishes saving before streaming, keeping Stop Reply available", async () => {
    let resolve!: () => void;
    mocks.send.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const { result } = renderHook(() => useAiChat(options));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.sendMessage("Idea"); });
    expect(result.current.isSaving).toBe(false);
    await act(() => result.current.sendMessage("Duplicate"));
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); await pending; });
  });
  it.each(["submitted", "streaming"])("blocks new sends during %s", async (status) => {
    mocks.chat.status = status;
    const { result } = renderHook(() => useAiChat(options));
    await act(() => result.current.sendMessage("Idea"));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves interrupted assistant text and parts", () => {
    renderHook(() => useAiChat(options));
    mocks.finish?.({ message, isAbort: true, isError: false });
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ content: "Saved reply", messageId: "reply", interrupted: true, partsJson: JSON.stringify(message.parts) });
  });
  it("surfaces failed assistant saves", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useAiChat(options));
    await act(async () => { mocks.finish?.({ message, isAbort: false, isError: false }); });
    expect(result.current.saveError).toContain("reply could not be saved");
  });
  it("deduplicates feed acknowledgements against live replies", () => {
    mocks.feed.messages = [{ id: "feed", createdAt: 1, data: { role: "assistant", content: "Older", messageId: "reply" } }];
    mocks.chat.messages = [message];
    const { result } = renderHook(() => useAiChat(options));
    expect(result.current.displayMessages).toEqual([message]);
  });
});

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGeneration } from "@/hooks/use-generation";
import { initialSteps } from "@/lib/ai/pipeline";

const mocks = vi.hoisted(() => ({ flow: { addNodes: vi.fn(), addEdges: vi.fn(), fitView: vi.fn() }, error: vi.fn(), success: vi.fn() }));
vi.mock("@xyflow/react", () => ({ useReactFlow: () => mocks.flow }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
const options = { projectId: "project", getNodes: () => [], getEdges: () => [] };
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("pipeline recovery", () => {
  it("completes a successful pipeline", async () => {
    fetchMock.mockResolvedValue(response({ ok: true, runId: "run", nextStep: null }));
    const { result } = renderHook(() => useGeneration(options));
    await act(() => result.current.runPipeline("Brief"));
    expect(result.current.status).toBe("done");
    expect(result.current.steps[0].status).toBe("done");
  });
  it("prevents concurrent pipeline runs", async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useGeneration(options));
    let pending!: Promise<void>;
    act(() => { pending = result.current.runPipeline("First"); });
    await act(() => result.current.runPipeline("Duplicate"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(response({ ok: true, runId: "run", nextStep: null })); await pending; });
  });
  it("pauses only after the active stage commits and resumes the next stage", async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useGeneration(options));
    let pending!: Promise<void>;
    act(() => { pending = result.current.runPipeline("Brief"); });
    act(() => result.current.pauseRun());
    expect(result.current.status).toBe("generating");
    await act(async () => { resolve(response({ ok: true, runId: "run", nextStep: "intent" })); await pending; });
    expect(result.current.status).toBe("paused");
    expect(result.current.steps[0].status).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ ok: true, runId: "run", nextStep: null }));
    await act(() => result.current.retryStep());
    const resumed = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(resumed).toMatchObject({ runId: "run", step: "intent" });
    expect(result.current.steps[0].status).toBe("done");
    expect(result.current.status).toBe("done");
  });
  it("reports an HTTP error instead of staying running", async () => {
    fetchMock.mockResolvedValue(response({ error: "Provider unavailable" }, 503));
    const { result } = renderHook(() => useGeneration(options));
    await act(() => result.current.runPipeline("Brief"));
    expect(result.current.status).toBe("error");
    expect(result.current.step).toBe("Provider unavailable");
    expect(result.current.steps[0].status).toBe("failed");
  });
  it("reports a disconnected request", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network error"));
    const { result } = renderHook(() => useGeneration(options));
    await act(() => result.current.runPipeline("Brief"));
    expect(result.current.status).toBe("error");
    expect(result.current.step).toContain("Lost connection");
  });
  it("names a timed-out stage", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const { result } = renderHook(() => useGeneration(options));
    await act(() => result.current.runPipeline("Brief"));
    expect(result.current.step).toContain("55s");
    expect(result.current.status).toBe("error");
  });
  it("retries an application failure on its existing run", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: false, runId: "run", error: "Quota" }));
    const { result } = renderHook(() => useGeneration(options));
    await act(() => result.current.runPipeline("Brief", { runId: "run", fromStep: "intent", savedSteps: initialSteps().map((step) => step.id === "start" ? { ...step, status: "done" } : step) }));
    expect(result.current.failedStep).toEqual({ runId: "run", step: "intent" });
    fetchMock.mockResolvedValueOnce(response({ ok: true, nextStep: null }));
    await act(() => result.current.retryStep());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ runId: "run", step: "intent" });
    expect(result.current.steps[0].status).toBe("done");
  });
  it("restores completed stages from discovery", async () => {
    fetchMock.mockResolvedValue(response({ resumable: true, runId: "run", brief: "Brief", step: "intent", steps: { start: { status: "done", ms: 123 } } }));
    const { result } = renderHook(() => useGeneration(options));
    const run = await result.current.findResumable();
    expect(run?.steps[0]).toMatchObject({ id: "start", status: "done", ms: 123 });
    expect(run?.step).toBe("intent");
  });
  it("does not restart unfinished initial research and charge another run", async () => {
    fetchMock.mockResolvedValue(response({ resumable: true, runId: "run", brief: "Brief", step: "start" }));
    const { result } = renderHook(() => useGeneration(options));
    expect(await result.current.findResumable()).toBeNull();
  });
  it("handles failed discovery without claiming recovery is available", async () => {
    fetchMock.mockRejectedValue(new TypeError("Offline"));
    const { result } = renderHook(() => useGeneration(options));
    expect(await result.current.findResumable()).toBeNull();
  });
});

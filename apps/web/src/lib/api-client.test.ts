import { ApiRequestError, createApiClient } from "@cortex/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = createApiClient("http://cortex.test/api");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client errors", () => {
  it("preserves the HTTP status, public code and request ID without exposing the body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      requestId: "request-404",
      error: { code: "JOB_NOT_FOUND", message: "private/cache/path" }
    }), { status: 404 })));

    const error: unknown = await api.getJob("missing").catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      name: "ApiRequestError",
      message: "API_REQUEST_UNAVAILABLE",
      status: 404,
      code: "JOB_NOT_FOUND",
      requestId: "request-404"
    });
    expect(JSON.stringify(error)).not.toContain("private/cache/path");
  });

  it.each([
    null,
    { detail: "private/cache/path" },
    { requestId: 123, error: { code: "CACHE_ERROR", message: "private/cache/path" } },
    { requestId: "request-503", error: { code: 123, message: "private/cache/path" } },
    { requestId: "request-503", error: { code: "CACHE_ERROR", message: null } },
    { requestId: "request-503", error: { code: "CACHE_ERROR", message: "safe" }, raw: "private/cache/path" }
  ])("discards metadata from an invalid error envelope: %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 503 })));

    const error: unknown = await api.getJob("missing").catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      name: "ApiRequestError",
      message: "API_REQUEST_UNAVAILABLE",
      status: 503,
      code: null,
      requestId: null
    });
    expect(JSON.stringify(error)).not.toContain("private/cache/path");
  });

  it("keeps only the HTTP status when the response body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private/cache/path", { status: 502 })));

    await expect(api.health()).rejects.toMatchObject({
      message: "API_REQUEST_UNAVAILABLE", status: 502, code: null, requestId: null
    });
  });

  it("normalizes network failures without retaining the underlying message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("PRIVATE_SERVER_URL")));

    const error: unknown = await api.health().catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      name: "ApiRequestError",
      message: "API_REQUEST_UNAVAILABLE",
      status: null,
      code: null,
      requestId: null
    });
    expect(JSON.stringify(error)).not.toContain("PRIVATE_SERVER_URL");
  });

  it("normalizes an invalid successful JSON response without exposing the body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private/cache/path")));

    await expect(api.health()).rejects.toMatchObject({
      message: "API_REQUEST_UNAVAILABLE", status: 200, code: null, requestId: null
    });
  });

  it("preserves successful API responses", async () => {
    const health = { requestId: "healthy", status: "ok", version: "0.2.0", fastf1Available: true, cacheConfigured: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(health))));

    await expect(api.health()).resolves.toEqual(health);
  });
});

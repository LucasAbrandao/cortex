import type { components, paths } from "./generated/openapi";

export type ApiErrorResponse = components["schemas"]["ApiErrorResponse"];
export type HealthResponse = paths["/api/health"]["get"]["responses"]["200"]["content"]["application/json"];
export type JobRequest = components["schemas"]["JobRequest"];
export type LoadJob = components["schemas"]["LoadJob"];
export type SessionManifestResponse = paths["/api/f1/sessions/{session_id}/manifest"]["get"]["responses"]["200"]["content"]["application/json"];
export type ReplayResponse = paths["/api/f1/sessions/{session_id}/replay"]["get"]["responses"]["200"]["content"]["application/json"];
export type SeriesRequest = components["schemas"]["SeriesRequest"];
export type SeriesResponse = paths["/api/f1/sessions/{session_id}/series"]["post"]["responses"]["200"]["content"]["application/json"];
export type TrackRequest = components["schemas"]["TrackRequest"];
export type TrackResponse = paths["/api/f1/sessions/{session_id}/track"]["post"]["responses"]["200"]["content"]["application/json"];

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(status: number | null, details: ApiErrorResponse | null = null) {
    super("API_REQUEST_UNAVAILABLE");
    this.name = "ApiRequestError";
    this.status = status;
    this.code = details?.error.code ?? null;
    this.requestId = details?.requestId ?? null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseErrorResponse = (value: unknown): ApiErrorResponse | null => {
  if (!isRecord(value) || Object.keys(value).length !== 2 || typeof value.requestId !== "string") {
    return null;
  }
  const details = value.error;
  if (!isRecord(details) || Object.keys(details).length !== 2 ||
      typeof details.code !== "string" || typeof details.message !== "string") {
    return null;
  }
  return { requestId: value.requestId, error: { code: details.code, message: details.message } };
};

const request = async <Result>(url: string, init?: RequestInit): Promise<Result> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiRequestError(null);
  }
  if (!response.ok) {
    let details: ApiErrorResponse | null = null;
    try {
      details = parseErrorResponse(await response.json());
    } catch {
      // A proxy or failed upstream may return a non-JSON body.
    }
    throw new ApiRequestError(response.status, details);
  }
  try {
    return (await response.json()) as Result;
  } catch {
    throw new ApiRequestError(response.status);
  }
};

export const createApiClient = (baseUrl: string) => ({
  async health(): Promise<HealthResponse> {
    return request<HealthResponse>(`${baseUrl}/health`);
  },
  async createJob(payload: JobRequest): Promise<LoadJob> {
    return request<LoadJob>(`${baseUrl}/f1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  async getJob(jobId: string): Promise<LoadJob> {
    return request<LoadJob>(`${baseUrl}/jobs/${encodeURIComponent(jobId)}`);
  },
  async cancelJob(jobId: string): Promise<LoadJob> {
    return request<LoadJob>(`${baseUrl}/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  },
  async manifest(sessionId: string): Promise<SessionManifestResponse> {
    return request<SessionManifestResponse>(`${baseUrl}/f1/sessions/${encodeURIComponent(sessionId)}/manifest`);
  },
  async replay(sessionId: string): Promise<ReplayResponse> {
    return request<ReplayResponse>(`${baseUrl}/f1/sessions/${encodeURIComponent(sessionId)}/replay`);
  },
  async series(sessionId: string, payload: SeriesRequest): Promise<SeriesResponse> {
    return request<SeriesResponse>(`${baseUrl}/f1/sessions/${encodeURIComponent(sessionId)}/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  async track(sessionId: string, payload: TrackRequest): Promise<TrackResponse> {
    return request<TrackResponse>(`${baseUrl}/f1/sessions/${encodeURIComponent(sessionId)}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
});

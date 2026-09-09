import type { components, paths } from "./generated/openapi";

export type HealthResponse = paths["/api/health"]["get"]["responses"]["200"]["content"]["application/json"];
export type JobRequest = components["schemas"]["JobRequest"];
export type LoadJob = components["schemas"]["LoadJob"];
export type SessionManifestResponse = paths["/api/f1/sessions/{session_id}/manifest"]["get"]["responses"]["200"]["content"]["application/json"];
export type ReplayResponse = paths["/api/f1/sessions/{session_id}/replay"]["get"]["responses"]["200"]["content"]["application/json"];
export type SeriesRequest = components["schemas"]["SeriesRequest"];
export type SeriesResponse = paths["/api/f1/sessions/{session_id}/series"]["post"]["responses"]["200"]["content"]["application/json"];
export type TrackRequest = components["schemas"]["TrackRequest"];
export type TrackResponse = paths["/api/f1/sessions/{session_id}/track"]["post"]["responses"]["200"]["content"]["application/json"];

const request = async <Response>(url: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error("API_REQUEST_UNAVAILABLE");
  }
  return (await response.json()) as Response;
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

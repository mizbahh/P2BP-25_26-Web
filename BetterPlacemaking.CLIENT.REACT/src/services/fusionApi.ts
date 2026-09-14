import { api } from "../auth/apiClient";
import { API_BASE_URL } from "../lib/env";
import * as authStore from "../auth/authStore";
import type { FusionConfigDto, FusionRunDto, TriggerFusionDto, UpdateFusionConfigDto } from "../lib/fusionTypes";

/**
 * Client for the intended `/api/fusion/*` resource, ported endpoint-for-endpoint from the
 * Angular app's services/fusion-service.ts. IMPORTANT: none of these routes exist on
 * BetterPlacemaking.SERVER.EXPRESS yet - there is no fusion.routes.ts / fusionService.ts, because
 * the Fusion engine itself has not been ported to Express. This page is being built ahead of its
 * backend on purpose (per product direction) to prove out frontend navigation/UI, so every call
 * here is expected to 404 until that backend work lands. Callers (Fusion.tsx, FusionModal.tsx)
 * treat a failure as "Fusion isn't available yet" rather than crashing - see those files.
 *
 * Endpoints this client expects (all unimplemented on the server today):
 *   GET    /api/fusion/history?projectId=&limit=   -> FusionRunDto[]
 *   POST   /api/fusion/trigger?projectId=           -> FusionRunDto
 *   DELETE /api/fusion/:runId                       -> void
 *   GET    /api/fusion/:runId/download-url          -> { url: string }
 *   GET    /api/fusion/:runId/download               -> binary (fused_tracks.json)
 *   POST   /api/fusion/:runId/cancel                 -> { status: string }
 *   GET    /api/fusion/config?projectId=             -> FusionConfigDto
 *   PUT    /api/fusion/config?projectId=             -> FusionConfigDto
 */

export function getHistory(projectId: string, limit = 50): Promise<FusionRunDto[]> {
  const params = new URLSearchParams({ projectId, limit: String(limit) });
  return api.get<FusionRunDto[]>(`/api/fusion/history?${params.toString()}`);
}

export function triggerFusion(payload: TriggerFusionDto): Promise<FusionRunDto> {
  const params = new URLSearchParams();
  if (payload.ProjectId) params.set("projectId", payload.ProjectId);
  const qs = params.toString();
  return api.post<FusionRunDto>(`/api/fusion/trigger${qs ? `?${qs}` : ""}`, payload);
}

export function deleteRun(runId: string): Promise<void> {
  return api.delete<void>(`/api/fusion/${runId}`);
}

export function cancelRun(runId: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/api/fusion/${runId}/cancel`, {});
}

export function getDownloadUrl(runId: string): Promise<{ url: string }> {
  return api.get<{ url: string }>(`/api/fusion/${runId}/download-url`);
}

/**
 * Downloads a run's fused output as a Blob. Uses fetch directly (rather than the `api` JSON
 * helper) because a binary response can't go through apiFetch's JSON/text body parsing.
 */
export async function downloadRun(runId: string): Promise<Blob> {
  const headers = new Headers();
  const token = authStore.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}/api/fusion/${runId}/download`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to download fusion run (${res.status})`);
  return res.blob();
}

export function getConfig(projectId?: string): Promise<FusionConfigDto> {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  const qs = params.toString();
  return api.get<FusionConfigDto>(`/api/fusion/config${qs ? `?${qs}` : ""}`);
}

export function updateConfig(payload: UpdateFusionConfigDto): Promise<FusionConfigDto> {
  const params = new URLSearchParams();
  if (payload.ProjectId) params.set("projectId", payload.ProjectId);
  const qs = params.toString();
  return api.put<FusionConfigDto>(`/api/fusion/config${qs ? `?${qs}` : ""}`, payload);
}

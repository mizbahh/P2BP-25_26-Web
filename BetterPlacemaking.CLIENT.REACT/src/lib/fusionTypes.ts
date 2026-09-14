/**
 * Ported verbatim (field-for-field, PascalCase) from the Angular
 * app/models/FusionDtos.ts. These document the shape the intended
 * `/api/fusion/*` backend is expected to return/accept - see fusionApi.ts
 * for the exact endpoints - but that backend does not exist on
 * BetterPlacemaking.SERVER.EXPRESS yet (no fusion.routes.ts/fusionService.ts).
 * The Fusion engine itself has not been ported; this page is being built
 * ahead of its backend on purpose to prove out the frontend.
 */

export type FusionRunStatus = "running" | "cancelling" | "cancelled" | "success" | "failed" | "unknown";
export type FusionTriggeredBy = "manual" | "scheduled" | "unknown";

export interface FusionRunDto {
  Id: string;
  Status: FusionRunStatus;
  TriggeredBy: FusionTriggeredBy;
  FromDateUnix?: number;
  ToDateUnix?: number;
  StartedAtUnix?: number;
  CompletedAtUnix?: number;
  RecordsFused?: number;
  ErrorMessage?: string;
  OutputGcsPath?: string;
  ProjectId?: string;
}

export interface FusionConfigDto {
  ScheduledHourUtc: number;
  ScheduledMinuteUtc: number;
  Enabled: boolean;
  ProjectId?: string;
}

export interface TriggerFusionDto {
  FromDateUnix: number;
  ToDateUnix: number;
  ProjectId?: string;
}

export interface UpdateFusionConfigDto {
  ScheduledHourUtc: number;
  ScheduledMinuteUtc: number;
  Enabled: boolean;
  ProjectId?: string;
}

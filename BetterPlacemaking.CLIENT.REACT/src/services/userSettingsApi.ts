import { api } from "../auth/apiClient";

export interface UserSettingsDto {
  FirstName?: string;
  LastName?: string;
  EmailAlerts?: boolean;
}

export interface UserSettingsInput {
  FirstName?: string;
  LastName?: string;
  EmailAlerts?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ProjectNotificationPrefsInput {
  NotifyOnOwnScan: boolean;
  NotifyOnOthersScan: boolean;
  NotifyOnScheduledScan: boolean;
  NotifyOnSystemToggle: boolean;
  NotifyOnHealthAlert: boolean;
  EmailPdfOnSystemOff: boolean;
}

export interface ProjectRoleAssignmentDto {
  ProjectId?: string;
  ProjectName?: string;
  Roles: string[];
  NotifyOnOwnScan?: boolean;
  NotifyOnOthersScan?: boolean;
  NotifyOnScheduledScan?: boolean;
  NotifyOnSystemToggle?: boolean;
  NotifyOnHealthAlert?: boolean;
  EmailPdfOnSystemOff?: boolean;
}

export interface UserProjectRoleAssignmentsDto {
  UserId?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Assignments: ProjectRoleAssignmentDto[];
}

/** GET /api/user/me/settings - app-level settings (name shown in-app + notification defaults), not full profile/identity. */
export function getMySettings(): Promise<UserSettingsDto> {
  return api.get<UserSettingsDto>("/api/user/me/settings");
}

export function updateMySettings(settings: UserSettingsInput): Promise<void> {
  return api.patch<void>("/api/user/me/settings", settings);
}

export function changeMyPassword(input: ChangePasswordInput): Promise<void> {
  return api.post<void>("/api/password/me/change", input);
}

/**
 * GET /api/user/project-roles returns assignments for every user (matching the old
 * Angular UsersService.getProjectRoleAssignments) - there is no "mine only" variant on
 * the backend, so the caller must filter the result down to the current user's row.
 */
export function getAllProjectRoleAssignments(): Promise<UserProjectRoleAssignmentsDto[]> {
  return api.get<UserProjectRoleAssignmentsDto[]>("/api/user/project-roles");
}

export function updateProjectNotificationPrefs(
  projectId: string,
  prefs: ProjectNotificationPrefsInput,
): Promise<void> {
  return api.patch<void>(`/api/user/me/projects/${projectId}/notifications`, prefs);
}

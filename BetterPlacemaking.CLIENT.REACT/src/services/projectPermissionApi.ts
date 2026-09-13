import { api } from "../auth/apiClient";

/** Subset of the server's PublicUser DTO (GET /api/user) needed to pick a user to add. */
export interface PublicUserDto {
  Id: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
}

/** One user's role assignment within a project - mirrors ProjectMemberRoleDto. */
export interface ProjectMemberRoleDto {
  UserId?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Role?: string;
}

export interface ProjectMemberRoleUpdate {
  UserId: string;
  /** Empty/omitted role removes the user's access to the project. */
  Role?: string;
}

export function getUsers(): Promise<PublicUserDto[]> {
  return api.get<PublicUserDto[]>("/api/user");
}

export function getProjectRoleOptions(): Promise<string[]> {
  return api.get<string[]>("/api/user/project-roles/options");
}

export function getProjectMemberRoles(projectId: string): Promise<ProjectMemberRoleDto[]> {
  return api.get<ProjectMemberRoleDto[]>(`/api/user/project-roles/project/${projectId}`);
}

export function setProjectMemberRole(projectId: string, update: ProjectMemberRoleUpdate): Promise<void> {
  return api.put<void>(`/api/user/project-roles/project/${projectId}`, update);
}

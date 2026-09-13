import { api } from "../auth/apiClient";
import type { AuthUser } from "../lib/types";

export interface ProjectRoleAssignment {
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

export interface UserProjectRoleAssignments {
  UserId?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Assignments: ProjectRoleAssignment[];
}

/** All registered users. Mirrors the Angular UsersService.getUsers(). */
export function getUsers(): Promise<AuthUser[]> {
  return api.get<AuthUser[]>("/api/user");
}

/** Every user's role assignments across every project. Mirrors UsersService.getProjectRoleAssignments(). */
export function getProjectRoleAssignments(): Promise<UserProjectRoleAssignments[]> {
  return api.get<UserProjectRoleAssignments[]>("/api/user/project-roles");
}

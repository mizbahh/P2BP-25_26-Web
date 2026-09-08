import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import * as userService from "./userService.js";
import type {
  ProjectMemberRoleDto,
  ProjectMemberRoleUpdateDto,
  ProjectRoleAssignmentDto,
  UserProjectRoleAssignmentsDto,
  UserProjectRoleAssignmentsUpdateDto,
} from "../models/types.js";

function normalizeRoles(roles: string[] | undefined): string[] {
  if (!roles) return [];
  const seen = new Map<string, string>();
  for (const role of roles) {
    const trimmed = role?.trim();
    if (trimmed) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return Array.from(seen.values());
}

async function nextAuthzVersion(memberSnapshot: FirebaseFirestore.DocumentSnapshot): Promise<number> {
  const current = memberSnapshot.exists ? (memberSnapshot.data()?.authzVersion as number | undefined) : undefined;
  return (current ?? 0) + 1;
}

/** All users, each with their role assignments across every project. Mirrors UserService.GetProjectRoleAssignments. */
export async function getProjectRoleAssignments(): Promise<UserProjectRoleAssignmentsDto[]> {
  const db = getDb();
  const users = await userService.getUsers();
  const projectsSnapshot = await db.collection("projects").get();

  const assignmentsByUser = new Map<string, ProjectRoleAssignmentDto[]>();

  for (const projectDoc of projectsSnapshot.docs) {
    const project = projectDoc.data();
    const membersSnapshot = await db.collection("projects").doc(projectDoc.id).collection("members").get();

    for (const member of membersSnapshot.docs) {
      const roles = normalizeRoles(member.data().roles as string[] | undefined);
      if (roles.length === 0) continue;

      const list = assignmentsByUser.get(member.id) ?? [];
      list.push({
        ProjectId: projectDoc.id,
        ProjectName: project.Title,
        Roles: roles,
        NotifyOnOwnScan: !!member.data().notifyOnOwnScan,
        NotifyOnOthersScan: !!member.data().notifyOnOthersScan,
        NotifyOnScheduledScan: !!member.data().notifyOnScheduledScan,
        NotifyOnSystemToggle: !!member.data().notifyOnSystemToggle,
        NotifyOnHealthAlert: !!member.data().notifyOnHealthAlert,
        EmailPdfOnSystemOff: !!member.data().emailPdfOnSystemOff,
      });
      assignmentsByUser.set(member.id, list);
    }
  }

  return users.map((user) => ({
    UserId: user.Id,
    FirstName: user.FirstName ?? undefined,
    LastName: user.LastName ?? undefined,
    Email: user.Email ?? undefined,
    Assignments: assignmentsByUser.get(user.Id) ?? [],
  }));
}

/** Overwrites one user's role assignments across the projects listed in the request. */
export async function setUserProjectRoleAssignments(request: UserProjectRoleAssignmentsUpdateDto): Promise<boolean> {
  if (!request.UserId) return false;
  const db = getDb();

  const userSnap = await db.collection("users").doc(request.UserId).get();
  if (!userSnap.exists) return false;

  for (const assignment of request.Assignments) {
    if (!assignment.ProjectId) continue;

    const roles = normalizeRoles(assignment.Roles);
    const memberRef = db.collection("projects").doc(assignment.ProjectId).collection("members").doc(request.UserId);

    if (roles.length === 0) {
      const existing = await memberRef.get();
      if (existing.exists) await memberRef.delete();
      continue;
    }

    const memberSnapshot = await memberRef.get();
    const authzVersion = await nextAuthzVersion(memberSnapshot);

    await memberRef.set(
      { roles, authzVersion, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  return true;
}

/** Members of one project with their (single, display-only) role. Mirrors UserService.GetProjectMemberRoles. */
export async function getProjectMemberRoles(projectId: string): Promise<ProjectMemberRoleDto[]> {
  const db = getDb();
  const membersSnapshot = await db.collection("projects").doc(projectId).collection("members").get();

  const results: ProjectMemberRoleDto[] = [];
  for (const member of membersSnapshot.docs) {
    const roles = (member.data().roles as string[] | undefined) ?? [];
    const role = roles.find((r) => r?.trim())?.trim();
    if (!role) continue;

    const user = await userService.getUserById(member.id);
    if (!user) continue;

    results.push({
      UserId: member.id,
      FirstName: user.FirstName ?? undefined,
      LastName: user.LastName ?? undefined,
      Email: user.Email ?? undefined,
      Role: role,
    });
  }

  return results.sort((a, b) => {
    return (
      (a.FirstName ?? "").localeCompare(b.FirstName ?? "") ||
      (a.LastName ?? "").localeCompare(b.LastName ?? "") ||
      (a.Email ?? "").localeCompare(b.Email ?? "")
    );
  });
}

export async function setProjectMemberRole(projectId: string, request: ProjectMemberRoleUpdateDto): Promise<boolean> {
  if (!request.UserId) return false;
  const db = getDb();

  const userSnap = await db.collection("users").doc(request.UserId).get();
  if (!userSnap.exists) return false;

  const memberRef = db.collection("projects").doc(projectId).collection("members").doc(request.UserId);
  const normalizedRole = request.Role?.trim();

  if (!normalizedRole) {
    const existing = await memberRef.get();
    if (existing.exists) await memberRef.delete();
    return true;
  }

  const memberSnapshot = await memberRef.get();
  const authzVersion = await nextAuthzVersion(memberSnapshot);

  await memberRef.set(
    { roles: [normalizedRole], authzVersion, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return true;
}

export interface NotificationPrefsUpdate {
  NotifyOnOwnScan: boolean;
  NotifyOnOthersScan: boolean;
  NotifyOnScheduledScan: boolean;
  NotifyOnSystemToggle: boolean;
  NotifyOnHealthAlert: boolean;
  EmailPdfOnSystemOff: boolean;
}

export async function updateProjectNotificationPrefs(
  userId: string,
  projectId: string,
  prefs: NotificationPrefsUpdate,
): Promise<boolean> {
  const db = getDb();
  const memberRef = db.collection("projects").doc(projectId).collection("members").doc(userId);
  const snap = await memberRef.get();
  if (!snap.exists) return false;

  await memberRef.update({
    notifyOnOwnScan: prefs.NotifyOnOwnScan,
    notifyOnOthersScan: prefs.NotifyOnOthersScan,
    notifyOnScheduledScan: prefs.NotifyOnScheduledScan,
    notifyOnSystemToggle: prefs.NotifyOnSystemToggle,
    notifyOnHealthAlert: prefs.NotifyOnHealthAlert,
    emailPdfOnSystemOff: prefs.EmailPdfOnSystemOff,
  });
  return true;
}

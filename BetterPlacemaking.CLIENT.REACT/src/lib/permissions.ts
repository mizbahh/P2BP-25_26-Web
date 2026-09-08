/**
 * Mirrors BetterPlacemaking.SERVER.EXPRESS/src/authorization/permissions.ts verbatim -
 * these strings come from the API, not a client-side enum, so keep them in sync.
 */

const GlobalPermissions = {
  ProjectsCreate: "Global.Projects.Create",
  ProjectsReadAll: "Global.Projects.ReadAll",
  ProjectsManageGlobal: "Global.Projects.ManageGlobal",
  RolesManageDefinitions: "Global.Roles.ManageDefinitions",
  UsersRead: "Global.Users.Read",
  UsersManageGlobalRoles: "Global.Users.ManageGlobalRoles",
} as const;

const ProjectPermissions = {
  Read: "Project.Read",
  Update: "Project.Update",
  Delete: "Project.Delete",
  Export: "Project.Export",
  VisionRead: "Project.Vision.Read",
  DevicesRead: "Project.Devices.Read",
  DevicesManage: "Project.Devices.Manage",
  MembersRead: "Project.Members.Read",
  MembersAssignEditorViewer: "Project.Members.AssignEditorViewer",
  ScansRead: "Project.Scans.Read",
  ScansStart: "Project.Scans.Start",
  ScansDelete: "Project.Scans.Delete",
  ScanSchedulesRead: "Project.ScanSchedules.Read",
  ScanSchedulesManage: "Project.ScanSchedules.Manage",
} as const;

export const Permissions = {
  Global: GlobalPermissions,
  Project: ProjectPermissions,
};

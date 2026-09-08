/** Ported verbatim from BetterPlacemaking.SERVER/Authorization/Permissions.cs */

const GlobalPermissions = {
  ProjectsCreate: "Global.Projects.Create",
  ProjectsReadAll: "Global.Projects.ReadAll",
  ProjectsManageGlobal: "Global.Projects.ManageGlobal",
  RolesManageDefinitions: "Global.Roles.ManageDefinitions",
  UsersRead: "Global.Users.Read",
  UsersManageGlobalRoles: "Global.Users.ManageGlobalRoles",
} as const;

const GlobalAll: string[] = [
  GlobalPermissions.UsersRead,
  GlobalPermissions.UsersManageGlobalRoles,
  GlobalPermissions.ProjectsCreate,
  GlobalPermissions.ProjectsReadAll,
  GlobalPermissions.ProjectsManageGlobal,
  GlobalPermissions.RolesManageDefinitions,
];

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

const ProjectAll: string[] = Object.values(ProjectPermissions);

const ProjectViewer: string[] = [
  ProjectPermissions.Read,
  ProjectPermissions.Export,
  ProjectPermissions.DevicesRead,
  ProjectPermissions.MembersRead,
  ProjectPermissions.ScansRead,
  ProjectPermissions.ScansStart,
  ProjectPermissions.ScanSchedulesRead,
];

const ProjectEditor: string[] = [
  ...ProjectViewer,
  ProjectPermissions.VisionRead,
  ProjectPermissions.Update,
  ProjectPermissions.DevicesManage,
  ProjectPermissions.ScansDelete,
  ProjectPermissions.ScanSchedulesManage,
];

const ProjectAdmin: string[] = [
  ...ProjectEditor,
  ProjectPermissions.Delete,
  ProjectPermissions.MembersAssignEditorViewer,
];

export const Permissions = {
  Global: {
    ...GlobalPermissions,
    All: GlobalAll,
  },
  Project: {
    ...ProjectPermissions,
    All: ProjectAll,
    Viewer: ProjectViewer,
    Editor: ProjectEditor,
    Admin: ProjectAdmin,
  },
};

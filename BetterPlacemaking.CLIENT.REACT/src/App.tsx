import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { RequirePermission } from "./routes/RequirePermission";
import { Permissions } from "./lib/permissions";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { SelectProject } from "./pages/projects/SelectProject";
import { ProjectsList } from "./pages/projects/ProjectsList";
import { ProjectWorkspace } from "./pages/projects/ProjectWorkspace";
import { DevicesList } from "./pages/devices/DevicesList";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<AppLayout />}>
          <Route path="/projects" element={<SelectProject />} />
          <Route
            path="/admin/projects"
            element={
              <RequirePermission scope="global" permission={Permissions.Global.ProjectsReadAll}>
                <ProjectsList />
              </RequirePermission>
            }
          />
          <Route
            path="/:projectId"
            element={
              <RequirePermission permission={Permissions.Project.Read}>
                <ProjectWorkspace />
              </RequirePermission>
            }
          >
            <Route
              path="admin/projects"
              element={
                <RequirePermission scope="global" permission={Permissions.Global.ProjectsReadAll}>
                  <ProjectsList />
                </RequirePermission>
              }
            />
            <Route
              path="devices"
              element={
                <RequirePermission permission={Permissions.Project.DevicesRead}>
                  <DevicesList />
                </RequirePermission>
              }
            />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </AuthProvider>
  );
}

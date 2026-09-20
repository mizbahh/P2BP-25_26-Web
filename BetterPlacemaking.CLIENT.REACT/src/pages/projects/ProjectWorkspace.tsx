import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import * as projectApi from "../../services/projectApi";
import type { ProjectDto } from "../../lib/projectTypes";

/**
 * Renders no chrome of its own - the original app has none (title bar + sidebar live in the
 * layout). It only loads the current project and hands it to child pages via Outlet context.
 */
export function ProjectWorkspace() {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectDto | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projectApi.getProject(projectId).then(setProject);
  }, [projectId]);

  return <Outlet context={{ project }} />;
}

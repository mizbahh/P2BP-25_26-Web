import { Router } from "express";
import * as projectService from "../services/projectService.js";
import * as authorizationService from "../authorization/authorizationService.js";
import { Permissions } from "../authorization/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { toProjectDto } from "../models/project.js";

export const projectRouter = Router();

projectRouter.use(requireAuth);

// Not a simple requirePermission() middleware: any authenticated user can call this,
// and the response is filtered to only the projects they can read - mirrors
// ProjectController.GetProjects exactly (global ReadAll fresh check, else per-project
// Read check on every doc, in parallel).
projectRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const role = req.user!.role;
    const projects = await projectService.getAll();

    const hasReadAll = await authorizationService.hasGlobalPermission(userId, role, Permissions.Global.ProjectsReadAll);
    if (hasReadAll) {
      res.status(200).json(projects.map(toProjectDto));
      return;
    }

    const readableFlags = await Promise.all(
      projects.map((p) => authorizationService.hasProjectPermission(userId, role, p.Id, Permissions.Project.Read)),
    );
    const readable = projects.filter((_, i) => readableFlags[i]);
    res.status(200).json(readable.map(toProjectDto));
  } catch (err) {
    next(err);
  }
});

projectRouter.get("/:id", requirePermission(Permissions.Project.Read), async (req, res, next) => {
  try {
    const project = await projectService.getById(req.params.id);
    if (!project) {
      res.status(404).send();
      return;
    }
    res.status(200).json(toProjectDto(project));
  } catch (err) {
    next(err);
  }
});

projectRouter.post("/", requirePermission(Permissions.Global.ProjectsCreate), async (req, res, next) => {
  try {
    const { Title, Description, Location } = req.body ?? {};
    const project = await projectService.create({ Title, Description, Location }, req.user!.sub);
    res.status(200).json(toProjectDto(project));
  } catch (err) {
    next(err);
  }
});

projectRouter.put("/:id", requirePermission(Permissions.Project.Update), async (req, res, next) => {
  try {
    if (!req.body) {
      res.status(400).send();
      return;
    }
    const { Title, Description, Location } = req.body;
    const success = await projectService.update(req.params.id, { Title, Description, Location });
    res.status(success ? 200 : 404).send();
  } catch (err) {
    next(err);
  }
});

projectRouter.delete("/:id", requirePermission(Permissions.Project.Delete), async (req, res, next) => {
  try {
    const success = await projectService.deleteProject(req.params.id);
    res.status(success ? 200 : 404).send();
  } catch (err) {
    next(err);
  }
});

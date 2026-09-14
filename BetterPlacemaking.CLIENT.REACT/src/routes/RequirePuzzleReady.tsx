import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import * as homographyApi from "../services/homographyApi";

interface RequirePuzzleReadyProps {
  children: ReactNode;
}

/**
 * Mirrors guards/puzzle-ready-guard.ts: fetches the puzzle workspace for the current
 * :projectId and only renders children once every puzzle piece is Status "ready" (and there
 * is at least one). Otherwise redirects to the project's Vision page with
 * `puzzleNotReady=1` so that page can surface a message, matching the Angular guard's
 * `router.createUrlTree([projectId, 'vision'], { queryParams: { puzzleNotReady: '1' } })`.
 * A failed workspace fetch redirects to Vision with no query param, matching the guard's
 * `catchError(() => of(router.createUrlTree([projectId, 'vision'])))`.
 *
 * Intended composition at the route (wired in separately, not here): same order as the old
 * `canActivate: [permissionGuard, puzzleReadyGuard]` -
 *   <RequirePermission permission={Permissions.Project.VisionRead}>
 *     <RequirePuzzleReady>
 *       <Puzzle />
 *     </RequirePuzzleReady>
 *   </RequirePermission>
 */
export function RequirePuzzleReady({ children }: RequirePuzzleReadyProps) {
  const { projectId } = useParams();
  const [state, setState] = useState<"loading" | "ready" | "not-ready" | "error">("loading");

  useEffect(() => {
    if (!projectId) {
      setState("error");
      return;
    }

    let cancelled = false;
    setState("loading");

    homographyApi
      .getPuzzleWorkspace(projectId)
      .then((workspace) => {
        if (cancelled) return;
        const allReady =
          workspace.PuzzlePieces.length > 0 && workspace.PuzzlePieces.every((p) => p.Status === "ready");
        setState(allReady ? "ready" : "not-ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state === "loading") return null;
  if (state === "not-ready") return <Navigate to={`/${projectId}/vision?puzzleNotReady=1`} replace />;
  if (state === "error") return <Navigate to={`/${projectId}/vision`} replace />;
  return <>{children}</>;
}

import { getDb } from "../config/firebase.js";
import { createSignedDownloadUrl } from "./cloudStorageService.js";
import { runFusionEngine } from "./fusionEngineService.js";
import {
  toFusionRunDto,
  type FusionConfigDoc,
  type FusionConfigDto,
  type FusionRun,
  type FusionRunDoc,
  type FusionRunDto,
  type UpdateFusionConfigDto,
} from "../models/fusion.js";

/**
 * Ported from BetterPlacemaking.SERVER/Services/FusionService.cs (361 lines) - the
 * orchestration/CRUD layer FusionController calls: history/trigger/cancel/delete/config. Calls
 * into fusionEngineService.ts (FusionEngine.cs/FusionRunner.RunAsync) for the actual fusion run
 * and cloudStorageService.ts for signed download URLs.
 *
 * NOT ported: FusionSchedulerService.cs (127 lines, a recurring background poller that
 * auto-triggers fusion on a schedule) and FusionBackgroundService.cs (Hangfire recurring-job
 * registration). Both are always-on background processes with no HTTP surface of their own,
 * analogous to ScanScheduleExecutorService which this codebase has already deliberately left
 * unported elsewhere (see scanScheduleService.ts) - see the TODO on the schedule config below.
 * The config CRUD they would read from (GET/PUT /api/fusion/config) is fully ported.
 */

const ColFusionRuns = "fusion_runs";
const ColFusionConfig = "fusion_config";
const DefaultConfigDocId = "default";

function configDocIdFor(projectId: string | null | undefined): string {
  return projectId && projectId.trim() ? projectId : DefaultConfigDocId;
}

// Max wall-clock time a single fusion run is allowed to take before we cancel it and mark it as
// failed. Keep this in sync with FusionSchedulerService.FusionTimeout (15 min) if that background
// poller is ever ported - this value matches FusionService.cs's own FusionTimeout (30 min).
const FUSION_TIMEOUT_MINUTES = 30;
const FUSION_TIMEOUT_MS = FUSION_TIMEOUT_MINUTES * 60 * 1000;

function nowUnix(): number {
  return Date.now() / 1000;
}

function yyyymmddUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function runsCollection() {
  return getDb().collection(ColFusionRuns);
}

// ── Cancellation registry ──────────────────────────────────────────────────

/**
 * Ported from FusionCancellationRegistry.cs - a simple process-wide registry of in-flight fusion
 * runs, letting an HTTP endpoint cancel a run whose AbortController would otherwise be trapped
 * inside the fire-and-forget closure started by triggerFusion. C#'s CancellationTokenSource maps
 * directly onto Node's AbortController here.
 */
export class FusionCancellationRegistry {
  private readonly active = new Map<string, AbortController>();

  register(runId: string, controller: AbortController): void {
    this.active.set(runId, controller);
  }

  unregister(runId: string): void {
    this.active.delete(runId);
  }

  /** Returns true if a live run with this id was found and signalled. False means the run isn't
   * active in this process (finished, never existed, or lives in a previous process after a restart). */
  tryCancel(runId: string): boolean {
    const controller = this.active.get(runId);
    if (!controller) return false;
    this.active.delete(runId);
    try {
      controller.abort(new Error("Cancelled by user"));
    } catch {
      /* already aborted/settled - ignore, matches the C# ObjectDisposedException swallow */
    }
    return true;
  }

  isActive(runId: string): boolean {
    return this.active.has(runId);
  }
}

export const fusionCancellationRegistry = new FusionCancellationRegistry();

// ── History ──────────────────────────────────────────────────────────────

/**
 * Ported from FusionService.GetHistory(projectId, limit). Uses a plain equality filter (single-
 * field index, auto-created by Firestore) and sorts/limits in memory - same approach and same
 * scale caveat as the C# comment: fine at small/medium scale, switch to server-side
 * OrderByDescending + Limit (with a composite index) if a project ever accumulates hundreds of
 * thousands of runs.
 */
export async function getHistory(projectId: string, limit = 50): Promise<FusionRunDto[]> {
  const snap = await runsCollection().where("ProjectId", "==", projectId).get();
  const runs = snap.docs.map((d) => toFusionRunDto({ Id: d.id, ...(d.data() as FusionRunDoc) }));
  return runs.sort((a, b) => (b.StartedAtUnix ?? 0) - (a.StartedAtUnix ?? 0)).slice(0, limit);
}

/** Raw run doc lookup, used by the routes' resource-scoped authorization check (mirrors
 * FusionController.GetAuthorizedRunAsync, which loads the run to discover its ProjectId before
 * checking the caller's permission on that project). */
export async function getRun(runId: string): Promise<FusionRun | null> {
  const snap = await runsCollection().doc(runId).get();
  if (!snap.exists) return null;
  return { Id: snap.id, ...(snap.data() as FusionRunDoc) };
}

// ── Sweep stale / orphaned runs ─────────────────────────────────────────────

/**
 * Ported from FusionService.SweepStaleRunsAsync. Not called from anywhere in this port (nothing
 * wires it in) - on the C# server it's invoked by FusionSchedulerService's poll loop, which is
 * the unported background piece described above. Kept here, unwired, for parity; safe to call
 * repeatedly (idempotent) once something does call it.
 */
export async function sweepStaleRuns(): Promise<void> {
  const cutoffUnix = nowUnix() - (FUSION_TIMEOUT_MINUTES * 60 + 5 * 60); // +5 min grace buffer
  const snap = await runsCollection().where("Status", "==", "running").get();

  let swept = 0;
  for (const doc of snap.docs) {
    const run = doc.data() as FusionRunDoc;
    if (typeof run.StartedAtUnix !== "number" || run.StartedAtUnix >= cutoffUnix) continue;

    await runsCollection().doc(doc.id).update({
      Status: "failed",
      ErrorMessage: "Run abandoned (process exited before completion — likely OOM, restart, or crash)",
      CompletedAtUnix: nowUnix(),
    });
    swept++;
    console.warn(`Swept stale fusion run ${doc.id} → failed`);
  }

  if (swept > 0) console.log(`Fusion stale-run sweep completed: ${swept} run(s) marked failed`);
}

// ── Delete a run ─────────────────────────────────────────────────────────

/** Ported from FusionService.DeleteRunAsync. */
export async function deleteRun(runId: string): Promise<void> {
  await runsCollection().doc(runId).delete();
}

// ── Cancel a run ─────────────────────────────────────────────────────────

export type CancelResult = "cancelling" | "stale" | "not_running" | "not_found";

/** Ported from FusionService.CancelRunAsync. */
export async function cancelRun(runId: string): Promise<CancelResult> {
  const ref = runsCollection().doc(runId);
  const snap = await ref.get();
  if (!snap.exists) return "not_found";

  const run = snap.data() as FusionRunDoc;
  if (run.Status !== "running") return "not_running";

  if (fusionCancellationRegistry.tryCancel(runId)) {
    // Write the terminal state immediately so the UI stops polling this run. The background
    // task (triggerFusion below) will also write the same "failed" status when its catch block
    // observes the abort - that second write is a no-op (identical values); if the process dies
    // before that unwinds, we already have a correct terminal row.
    await ref.update({
      Status: "failed",
      ErrorMessage: "Cancelled by user",
      CompletedAtUnix: nowUnix(),
    });
    console.log(`Fusion ${runId} cancellation requested (marked failed)`);
    return "cancelling";
  }

  // DB says running but no live AbortController - the previous process died mid-run. Flip the
  // row so the UI stops treating it as active.
  await ref.update({
    Status: "failed",
    ErrorMessage: "Cancelled by user (run was not active in this process)",
    CompletedAtUnix: nowUnix(),
  });
  console.warn(`Fusion ${runId} marked failed (stale running state, cancelled by user)`);
  return "stale";
}

// ── Trigger ──────────────────────────────────────────────────────────────

/**
 * Ported from FusionService.TriggerFusion. The C# version is synchronous (it blocks on
 * `AddAsync(run).Result` to obtain the run id before returning, then fires a detached
 * `Task.Run`). Firestore access here is inherently async, so this is `async` and `await`s only
 * the initial doc write before returning - the actual fusion run below is still fire-and-forget,
 * matching the "create the row, kick off the job, return immediately" contract.
 */
export async function triggerFusion(
  fromUnix: number,
  toUnix: number,
  triggeredBy: string = "manual",
  projectId: string | null = null,
): Promise<FusionRunDto> {
  const runDoc: FusionRunDoc = {
    Status: "running",
    TriggeredBy: triggeredBy,
    FromDateUnix: fromUnix,
    ToDateUnix: toUnix,
    StartedAtUnix: nowUnix(),
    ProjectId: projectId,
  };

  const docRef = runsCollection().doc();
  await docRef.set(runDoc);
  const runId = docRef.id;

  // Hard timeout on the whole run - when this fires, controller.signal is aborted, which
  // runFusionEngine observes at every checkpoint (same role as the linked timeout/user
  // CancellationTokenSources in the C# source).
  const controller = new AbortController();
  const timeoutError = new Error(`Fusion timed out after ${FUSION_TIMEOUT_MINUTES} minutes`);
  const timeoutId = setTimeout(() => controller.abort(timeoutError), FUSION_TIMEOUT_MS);
  fusionCancellationRegistry.register(runId, controller);

  const fromUtc = new Date(fromUnix * 1000);
  const toUtc = new Date(toUnix * 1000);

  void (async () => {
    try {
      const result = await runFusionEngine(
        {
          from: fromUtc,
          to: toUtc,
          inputStorageFolder: projectId ? `vision/tracks-raw/${projectId}` : null,
          outputStorageFolder: projectId ? `vision/tracks-fused/${projectId}` : null,
        },
        { signal: controller.signal, debug: false },
      );

      if (!result.success) throw new Error(result.message);

      // Recomputed independently here rather than threaded back from runFusionEngine's return
      // value - same duplication as the C# source (see the comment on FusionResult there:
      // "FusionService only ever looks at result.Success / result.Message"). Both formulas
      // reduce to the same yyyyMMdd(from)/yyyyMMdd(to) pair.
      const fromStr = yyyymmddUtc(fromUtc);
      const toStr = yyyymmddUtc(toUtc);
      const folder = projectId ? `vision/tracks-fused/${projectId}` : "vision/tracks-fused";
      const outputKey =
        fromStr === toStr
          ? `${folder}/fused_tracks-${fromStr}.json`
          : `${folder}/fused_tracks-${fromStr}_${toStr}.json`;

      await docRef.update({
        Status: "success",
        RecordsFused: 0,
        OutputGcsPath: outputKey,
        CompletedAtUnix: nowUnix(),
      });
      console.log(`Fusion ${runId} completed → ${outputKey}`);
    } catch (err) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        const timedOut = reason === timeoutError;
        if (timedOut) {
          console.error(`Fusion ${runId} timed out after ${FUSION_TIMEOUT_MINUTES} minutes`);
          await docRef.update({
            Status: "failed",
            ErrorMessage: timeoutError.message,
            CompletedAtUnix: nowUnix(),
          });
        } else {
          // User-initiated cancellation is treated as a failure so downstream callers (UI) only
          // have one terminal state to handle. cancelRun() above already wrote this same
          // terminal state synchronously when the cancel request came in - this write is the
          // same idempotent no-op the C# comment describes.
          console.warn(`Fusion ${runId} cancelled by user (marked failed)`);
          await docRef.update({
            Status: "failed",
            ErrorMessage: "Cancelled by user",
            CompletedAtUnix: nowUnix(),
          });
        }
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Fusion ${runId} failed: ${message}`);
        await docRef.update({
          Status: "failed",
          ErrorMessage: message,
          CompletedAtUnix: nowUnix(),
        });
      }
    } finally {
      clearTimeout(timeoutId);
      fusionCancellationRegistry.unregister(runId);
    }
  })();

  return toFusionRunDto({ Id: runId, ...runDoc });
}

// ── Signed download URL for a fused output file ─────────────────────────────

/** Ported from FusionService.GetDownloadUrlAsync. Reuses cloudStorageService's already-ported
 * signed-URL helper rather than duplicating it. */
export async function getDownloadUrl(runId: string): Promise<string | null> {
  const run = await getRun(runId);
  if (!run || !run.OutputGcsPath || !run.OutputGcsPath.trim()) return null;

  const result = await createSignedDownloadUrl({ PathFromRoot: run.OutputGcsPath });
  return result.SignedUrl;
}

// ── Config ───────────────────────────────────────────────────────────────

/**
 * Ported from FusionService.GetConfig/UpdateConfig - the nightly-fusion schedule settings
 * storage (`fusion_config` collection, one doc per project keyed by projectId, or "default").
 *
 * TODO: port FusionSchedulerService's background poller separately. That's the piece which
 * actually reads this config on an interval and calls triggerFusion(..., "scheduled", ...) -
 * an always-on background process, not part of this request-scoped HTTP API. Nothing in this
 * server currently reads/acts on ScheduledHourUtc/ScheduledMinuteUtc/Enabled below; they are
 * only stored and returned via GET/PUT /api/fusion/config today.
 */
export async function getConfig(projectId?: string | null): Promise<FusionConfigDto> {
  const docId = configDocIdFor(projectId);
  const snap = await getDb().collection(ColFusionConfig).doc(docId).get();

  if (!snap.exists) {
    return { ScheduledHourUtc: 21, ScheduledMinuteUtc: 0, Enabled: true, ProjectId: projectId ?? undefined };
  }

  const cfg = snap.data() as FusionConfigDoc;
  return {
    ScheduledHourUtc: cfg.ScheduledHourUtc,
    ScheduledMinuteUtc: cfg.ScheduledMinuteUtc,
    Enabled: cfg.Enabled,
    ProjectId: cfg.ProjectId ?? projectId ?? undefined,
  };
}

/** Ported from CloudStorageService... no - from FusionService's own ArgumentOutOfRangeException
 * validation in UpdateConfig. */
export class FusionConfigValidationError extends Error {}

export async function updateConfig(dto: UpdateFusionConfigDto): Promise<FusionConfigDto> {
  if (dto.ScheduledHourUtc < 0 || dto.ScheduledHourUtc > 23) {
    throw new FusionConfigValidationError("Hour must be 0-23.");
  }
  if (dto.ScheduledMinuteUtc < 0 || dto.ScheduledMinuteUtc > 59) {
    throw new FusionConfigValidationError("Minute must be 0-59.");
  }

  const docId = configDocIdFor(dto.ProjectId);
  const ref = getDb().collection(ColFusionConfig).doc(docId);

  const cfg: FusionConfigDoc = {
    ScheduledHourUtc: dto.ScheduledHourUtc,
    ScheduledMinuteUtc: dto.ScheduledMinuteUtc,
    Enabled: dto.Enabled,
    ProjectId: dto.ProjectId ?? null,
    UpdatedAtUnix: nowUnix(),
  };

  await ref.set(cfg);
  console.log(
    `Fusion config updated for project=${dto.ProjectId ?? "<default>"}: ${cfg.ScheduledHourUtc}:${cfg.ScheduledMinuteUtc} enabled=${cfg.Enabled}`,
  );

  return {
    ScheduledHourUtc: cfg.ScheduledHourUtc,
    ScheduledMinuteUtc: cfg.ScheduledMinuteUtc,
    Enabled: cfg.Enabled,
    ProjectId: cfg.ProjectId ?? undefined,
  };
}

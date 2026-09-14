import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Axis-aligned bounding box for one detected solid-object cluster, in scanner-space meters. */
export interface SolidObjectCluster {
  /** Number of lidar points that formed this cluster; clusters with fewer than 2 points are skipped. */
  PointCount: number;
  /** Bounding box min X (floor plane). */
  MinX: number;
  /** Bounding box max X (floor plane). */
  MaxX: number;
  /** Bounding box min Y (floor plane — note: scanner Y, rendered as scene Z/depth). */
  MinY: number;
  /** Bounding box max Y (floor plane — note: scanner Y, rendered as scene Z/depth). */
  MaxY: number;
  /** Cluster height above the floor in meters; used as the rendered box's vertical extent. */
  MaxHeight: number;
}

/** One 3D waypoint of a tracking path, in scanner-meter coordinates (x/z = floor plane, y = height). */
export interface TrackingPathPoint {
  x: number;
  y: number;
  z: number;
}

/** A single tracked trajectory overlay (e.g. one person's path through the scan), scanner-origin meters. */
export interface SolidObjectsTrackingPath {
  /** Optional stable key, used as the React key and to distinguish overlapping paths. */
  id?: string;
  /** Ordered waypoints; paths with fewer than 2 points are skipped. */
  points: TrackingPathPoint[];
  /** Optional "#rrggbb" hex color; falls back to a palette cycle by path index when omitted. */
  color?: string;
}

export interface SolidObjectsViewProps {
  /** Cluster bounding boxes to render as solid blue boxes on the floor grid; null/empty renders just the grid. */
  clusters?: SolidObjectCluster[] | null;
  /** Optional trajectory overlays, drawn as smoothed curves with waypoint markers and an end-cap sphere. */
  trackingPaths?: SolidObjectsTrackingPath[];
  /** CSS width of the viewer's container. Defaults to "100%" (fills parent). */
  width?: number | string;
  /** CSS height of the viewer's container. Defaults to "100%" (fills parent) — parent must give it a definite height. */
  height?: number | string;
  /** Extra class names applied to the outer container. */
  className?: string;
  /** Cluster box color. Defaults to 0x60a5fa (light blue). */
  clusterColor?: string | number;
  /** Show the reference floor grid. Defaults to true. */
  showGrid?: boolean;
  /** Shows a semi-transparent "Loading…" overlay on top of the canvas; the viewer itself never sets this. */
  isLoading?: boolean;
}

/** Imperative handle for actions a parent can't express as props (e.g. a toolbar "Reset view" button). */
export interface SolidObjectsViewHandle {
  /** Reset the camera to the default overview position/target. */
  resetView: () => void;
}

const TRACKING_PALETTE = [0x22c55e, 0xeab308, 0x06b6d4, 0xf472b6, 0xa78bfa, 0x34d399];
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(5, 5, 5);
/** Height substituted for tracking waypoints whose y is 0/undefined, so paths stay visible above the floor. */
const DEFAULT_TRACK_HEIGHT = 0.2;

/**
 * Renders solid-object cluster bounding boxes (e.g. calibration targets or scan-detected obstacles)
 * plus optional tracked-path overlays on a floor grid, using raw Three.js with orbit camera controls.
 * Self-contained: owns its renderer/scene/animation-loop lifecycle via a mount `useEffect` and tears
 * everything down on unmount. Pass cluster/path data in via props — this component does no data
 * fetching, file parsing, or backend calls itself.
 *
 * Ported from the Angular `SolidObjectsSceneComponent` (`solid-objects-scene.component.ts`); the sibling
 * `SolidObjectsViewComponent` (session polling, tracking-file upload/parsing, homography alignment) was
 * page-level business logic and is left to whatever page composes this component.
 */
export const SolidObjectsView = forwardRef<SolidObjectsViewHandle, SolidObjectsViewProps>(
  function SolidObjectsView(
    {
      clusters,
      trackingPaths = [],
      width = "100%",
      height = "100%",
      className,
      clusterColor = 0x60a5fa,
      showGrid = true,
      isLoading = false,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const trackingGroupRef = useRef<THREE.Group | null>(null);
    const frameIdRef = useRef<number | undefined>(undefined);

    // ─── Mount: create renderer/scene/camera/controls once, animate, and clean up on unmount ───
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x0a0c10);

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const w = Math.max(1, container.clientWidth || 800);
      const h = Math.max(1, container.clientHeight || 600);
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
      camera.position.copy(DEFAULT_CAMERA_POSITION);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;

      if (showGrid) scene.add(new THREE.GridHelper(20, 20, 0x2a3548, 0x1e2433));
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(10, 15, 10);
      scene.add(dir);

      const meshGroup = new THREE.Group();
      const trackingGroup = new THREE.Group();
      scene.add(meshGroup);
      scene.add(trackingGroup);
      meshGroupRef.current = meshGroup;
      trackingGroupRef.current = trackingGroup;

      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const cw = container.clientWidth || 800;
        const ch = container.clientHeight || 600;
        renderer.setSize(cw, ch);
        renderer.setPixelRatio(window.devicePixelRatio);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);
      renderer.setSize(w, h);

      return () => {
        if (frameIdRef.current !== undefined) cancelAnimationFrame(frameIdRef.current);
        resizeObserver.disconnect();
        controls.dispose();
        disposeGroup(meshGroup);
        disposeGroup(trackingGroup);
        renderer.dispose();
        sceneRef.current = null;
        cameraRef.current = null;
        controlsRef.current = null;
        meshGroupRef.current = null;
        trackingGroupRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time mount; showGrid is init-only, matching the old component's ngAfterViewInit.
    }, []);

    // ─── Rebuild cluster boxes whenever `clusters`/`clusterColor` change ───
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;
      disposeGroup(meshGroup);

      const color = typeof clusterColor === "string" ? new THREE.Color(clusterColor) : clusterColor;
      for (const c of clusters ?? []) {
        if (c.PointCount < 2) continue;
        const boxWidth = Math.max(0.1, c.MaxX - c.MinX);
        const depth = Math.max(0.1, c.MaxY - c.MinY);
        const boxHeight = Math.max(0.1, c.MaxHeight);
        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, depth);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        const mesh = new THREE.Mesh(geometry, material);
        const centerX = (c.MinX + c.MaxX) / 2;
        const centerZ = (c.MinY + c.MaxY) / 2;
        mesh.position.set(centerX, boxHeight / 2, centerZ);
        meshGroup.add(mesh);
      }
    }, [clusters, clusterColor]);

    // ─── Rebuild tracking-path overlays whenever `trackingPaths` changes ───
    useEffect(() => {
      const trackingGroup = trackingGroupRef.current;
      if (!trackingGroup) return;
      disposeGroup(trackingGroup);

      trackingPaths.forEach((track, i) => {
        if (!track.points || track.points.length < 2) return;

        const colorHex = track.color ? parseInt(track.color.replace("#", ""), 16) : TRACKING_PALETTE[i % TRACKING_PALETTE.length];
        const color = new THREE.Color(colorHex);
        const resolveY = (p: TrackingPathPoint) => (p.y !== undefined && p.y !== 0 ? p.y : DEFAULT_TRACK_HEIGHT);

        const vectors = track.points.map((p) => new THREE.Vector3(p.x, resolveY(p), p.z));
        const curve = new THREE.CatmullRomCurve3(vectors);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
        const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
        trackingGroup.add(line);

        const step = Math.max(1, Math.floor(track.points.length / 12));
        for (let j = 0; j < track.points.length; j += step) {
          const p = track.points[j];
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshBasicMaterial({ color }));
          sphere.position.set(p.x, resolveY(p), p.z);
          trackingGroup.add(sphere);
        }

        const last = track.points[track.points.length - 1];
        const endSphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshBasicMaterial({ color }));
        endSphere.position.set(last.x, resolveY(last), last.z);
        trackingGroup.add(endSphere);
      });
    }, [trackingPaths]);

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (!camera || !controls) return;
          camera.position.copy(DEFAULT_CAMERA_POSITION);
          controls.target.set(0, 0, 0);
        },
      }),
      [],
    );

    return (
      <div ref={containerRef} className={`relative bg-[#0a0c10] ${className ?? ""}`} style={{ width, height }}>
        <canvas ref={canvasRef} className="block h-full w-full" />
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 text-base text-white">
            <span>Loading…</span>
          </div>
        )}
      </div>
    );
  },
);

/** Removes and disposes every child mesh's geometry/material from a group, leaving it empty. */
function disposeGroup(group: THREE.Group): void {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const mat = child.material;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    }
  }
}

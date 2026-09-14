import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/** One lidar/scan point in scanner-space meters, with optional per-point styling. */
export interface PointCloudPoint {
  /** X coordinate in scanner-space meters. */
  x: number;
  /** Y coordinate in scanner-space meters (floor plane, paired with x). */
  y: number;
  /** Z coordinate in scanner-space meters — treated as height and remapped to the Three.js "up" axis. */
  z: number;
  /** Optional "#rrggbb" hex color; when omitted, color falls back to classification/intensity shading. */
  color?: string | null;
  /** Optional 0-1 brightness multiplier applied to the classification/intensity fallback color. */
  intensity?: number | null;
  /** Optional classification code (0 = ground, 1 = low object, anything else = default) used for fallback coloring. */
  classification?: number | null;
}

/**
 * Point cloud data, accepted in either shape:
 * - `PointCloudPoint[]` — convenient when points already carry per-point color/intensity/classification.
 * - `Float32Array` — a flat `[x0,y0,z0, x1,y1,z1, ...]` buffer for large clouds built without per-point allocation;
 *   pair it with the separate `colors` prop for per-point color.
 */
export type PointCloudData = PointCloudPoint[] | Float32Array;

/** Ported from the Angular `point-cloud-viewer.component.ts` `initThreeJS`/`renderPointCloud`. */
export interface PointCloudViewerProps {
  /** The point cloud to render. An empty array/undefined renders an empty scene (grid + axes only). */
  points?: PointCloudData;
  /** Parallel `[r0,g0,b0, r1,g1,b1, ...]` colors (0-1 floats) — only read when `points` is a `Float32Array`. */
  colors?: Float32Array;
  /** Raw Wavefront .obj text to render as a supplementary mesh overlay (e.g. a reconstructed surface); omit for points-only. */
  meshObjText?: string | null;
  /** Whether the mesh overlay (when `meshObjText` is supplied) starts visible. Defaults to false, matching the old viewer. */
  meshVisible?: boolean;
  /** CSS width of the viewer's container. Defaults to "100%" (fills parent). */
  width?: number | string;
  /** CSS height of the viewer's container. Defaults to "100%" (fills parent) — parent must give the container a definite height. */
  height?: number | string;
  /** Extra class names applied to the outer container. */
  className?: string;
  /** Base point sprite size in scene units before density/zoom scaling is applied. Defaults to 2.0. */
  pointSize?: number;
  /** Scene/canvas clear color. Defaults to 0x1a1a1a (dark gray), matching the old viewer. */
  backgroundColor?: string | number;
  /** Show the reference floor grid. Defaults to true. */
  showGrid?: boolean;
  /** Show the RGB axes helper at the origin. Defaults to true. */
  showAxes?: boolean;
  /** Whether OrbitControls damping/inertia is enabled. Defaults to true. */
  enableDamping?: boolean;
  /** Automatically reframe the camera on the point cloud's bounding box whenever `points` changes. Defaults to true. */
  autoFrameCamera?: boolean;
  /** Shows a semi-transparent "Loading…" overlay on top of the canvas; the viewer itself never sets this. */
  isLoading?: boolean;
  /** Loading overlay label. Defaults to "Loading…". */
  loadingLabel?: string;
  /** Called roughly once per second with the current render loop frames-per-second. */
  onFpsUpdate?: (fps: number) => void;
}

/** Imperative handle for actions a parent can't express as props (e.g. a toolbar "Reset view" button). */
export interface PointCloudViewerHandle {
  /** Reframe the camera on the current point cloud's bounding box (or the origin if there is none). */
  resetView: () => void;
  /** Show/hide the mesh overlay loaded from `meshObjText`, if any. */
  setMeshVisible: (visible: boolean) => void;
}

/**
 * Renders a lidar/scan point cloud (and an optional reconstructed mesh overlay) using raw Three.js,
 * with mouse-orbit camera controls. Self-contained: it owns its renderer/scene/animation-loop lifecycle
 * via a mount `useEffect` and tears everything down on unmount. Pass point data in via props; this
 * component does not fetch, upload, or export data itself — that belongs in whatever page composes it.
 *
 * Ported from the Angular `PointCloudViewerComponent` (`point-cloud-viewer.component.ts`).
 */
export const PointCloudViewer = forwardRef<PointCloudViewerHandle, PointCloudViewerProps>(
  function PointCloudViewer(
    {
      points,
      colors,
      meshObjText,
      meshVisible = false,
      width = "100%",
      height = "100%",
      className,
      pointSize = 2.0,
      backgroundColor = 0x1a1a1a,
      showGrid = true,
      showAxes = true,
      enableDamping = true,
      autoFrameCamera = true,
      isLoading = false,
      loadingLabel = "Loading…",
      onFpsUpdate,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Three.js objects live in refs, not state — they're mutated imperatively by the render loop
    // and must never trigger a React re-render.
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const pointCloudRef = useRef<THREE.Points | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const frameIdRef = useRef<number | undefined>(undefined);
    const onFpsUpdateRef = useRef(onFpsUpdate);
    onFpsUpdateRef.current = onFpsUpdate;

    // ─── Mount: create renderer/scene/camera/controls once, animate, and clean up on unmount ───
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);
      sceneRef.current = scene;

      const w = Math.max(1, container.clientWidth || 800);
      const h = Math.max(1, container.clientHeight || 600);
      const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 50000);
      camera.position.set(500, 500, 500);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        precision: "highp",
      });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = false;
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = enableDamping;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(500, 500, 500);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(-500, 300, -500);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.4);
      rim.position.set(0, 1000, 0);
      scene.add(rim);

      if (showGrid) scene.add(new THREE.GridHelper(2000, 20, 0x333333, 0x444444));
      if (showAxes) scene.add(new THREE.AxesHelper(200));

      const meshGroup = new THREE.Group();
      meshGroup.visible = meshVisible;
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      let frameCount = 0;
      let lastFpsTime = performance.now();
      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);

        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          onFpsUpdateRef.current?.(frameCount);
          frameCount = 0;
          lastFpsTime = now;
        }
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

      return () => {
        if (frameIdRef.current !== undefined) cancelAnimationFrame(frameIdRef.current);
        resizeObserver.disconnect();
        controls.dispose();
        pointCloudRef.current?.geometry.dispose();
        (pointCloudRef.current?.material as THREE.Material | undefined)?.dispose();
        meshGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mat = child.material;
            (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        sceneRef.current = null;
        cameraRef.current = null;
        rendererRef.current = null;
        controlsRef.current = null;
        pointCloudRef.current = null;
        meshGroupRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time mount; background/grid/axes/damping are init-only, matching the old component's ngAfterViewInit.
    }, []);

    // ─── Rebuild the point cloud geometry whenever `points`/`colors`/`pointSize` change ───
    useEffect(() => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!scene || !camera || !controls) return;

      if (pointCloudRef.current) {
        scene.remove(pointCloudRef.current);
        pointCloudRef.current.geometry.dispose();
        (pointCloudRef.current.material as THREE.Material).dispose();
        pointCloudRef.current = null;
      }

      const count = points ? (points instanceof Float32Array ? points.length / 3 : points.length) : 0;
      if (!points || count === 0) return;

      const positions = new Float32Array(count * 3);
      const pointColors = new Float32Array(count * 3);
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;

      const getPoint = (i: number): PointCloudPoint =>
        points instanceof Float32Array
          ? { x: points[i * 3], y: points[i * 3 + 1], z: points[i * 3 + 2] }
          : points[i];

      for (let i = 0; i < count; i++) {
        const p = getPoint(i);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        const z = p.z || 0;
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const p = getPoint(i);
        // Scanner Z (height) becomes the Three.js up axis (Y); scanner X/Y become the floor plane.
        positions[i * 3] = p.x - centerX;
        positions[i * 3 + 1] = (p.z || 0) - centerZ;
        positions[i * 3 + 2] = p.y - centerY;

        if (points instanceof Float32Array && colors) {
          pointColors[i * 3] = colors[i * 3] ?? 0.5;
          pointColors[i * 3 + 1] = colors[i * 3 + 1] ?? 0.5;
          pointColors[i * 3 + 2] = colors[i * 3 + 2] ?? 0.5;
          continue;
        }

        if (p.color?.startsWith("#") && p.color.length === 7) {
          try {
            color.setHex(parseInt(p.color.slice(1), 16));
          } catch {
            color.setRGB(0.5, 0.5, 0.5);
          }
        } else {
          const intensity = p.intensity ?? 1.0;
          if (p.classification === 0) color.setRGB(0.5, 0.5, 0.5);
          else if (p.classification === 1) color.setRGB(0.4, 0.4, 0.4);
          else color.setRGB(0.3, 0.3, 0.6);
          color.multiplyScalar(intensity);
        }
        color.r = Math.min(1, Math.max(0, color.r));
        color.g = Math.min(1, Math.max(0, color.g));
        color.b = Math.min(1, Math.max(0, color.b));
        pointColors[i * 3] = color.r;
        pointColors[i * 3 + 1] = color.g;
        pointColors[i * 3 + 2] = color.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));

      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ, 0);
      const densityFactor = Math.max(0.8, Math.min(2.0, Math.sqrt(100000 / count)));
      const sizeFactor = Math.max(0.8, Math.min(1.5, maxSize / 800));
      const resolvedSize = Math.max(2.0, Math.min(8.0, pointSize * densityFactor * sizeFactor));

      // Soft radial-gradient sprite so points read as circles rather than hard squares.
      const gradCanvas = document.createElement("canvas");
      gradCanvas.width = 64;
      gradCanvas.height = 64;
      const ctx = gradCanvas.getContext("2d");
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255,255,255,1.0)");
        gradient.addColorStop(0.5, "rgba(255,255,255,0.9)");
        gradient.addColorStop(0.8, "rgba(255,255,255,0.5)");
        gradient.addColorStop(1, "rgba(255,255,255,0.0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      const pointTexture = new THREE.CanvasTexture(gradCanvas);
      pointTexture.needsUpdate = true;

      const material = new THREE.PointsMaterial({
        size: resolvedSize,
        vertexColors: true,
        sizeAttenuation: true,
        map: pointTexture,
        alphaTest: 0.01,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        fog: false,
        blending: THREE.NormalBlending,
      });

      const cloud = new THREE.Points(geometry, material);
      scene.add(cloud);
      pointCloudRef.current = cloud;

      if (autoFrameCamera) {
        const distance = Math.max(maxSize * 2, 1000);
        camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      }
    }, [points, colors, pointSize, autoFrameCamera]);

    // ─── Load the optional OBJ mesh overlay whenever the source text changes ───
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      const scene = sceneRef.current;
      if (!meshGroup || !scene) return;

      while (meshGroup.children.length) {
        const child = meshGroup.children[0];
        meshGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const mat = child.material;
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
        }
      }

      if (!meshObjText || !meshObjText.trim()) return;

      const blob = new Blob([meshObjText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const loader = new OBJLoader();
      loader.load(
        url,
        (object) => {
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          object.position.sub(center);
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x888888,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.7,
              });
              child.geometry.computeVertexNormals();
            }
          });
          meshGroup.add(object);
          URL.revokeObjectURL(url);
        },
        undefined,
        () => URL.revokeObjectURL(url),
      );
    }, [meshObjText]);

    // Visibility toggle is separate from the (re)load effect so it doesn't force a re-parse of the OBJ text.
    useEffect(() => {
      if (meshGroupRef.current) meshGroupRef.current.visible = meshVisible;
    }, [meshVisible]);

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (!camera || !controls) return;
          camera.position.set(500, 500, 500);
          camera.lookAt(0, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();
        },
        setMeshVisible: (visible: boolean) => {
          if (meshGroupRef.current) meshGroupRef.current.visible = visible;
        },
      }),
      [],
    );

    return (
      <div ref={containerRef} className={`relative ${className ?? ""}`} style={{ width, height }}>
        <canvas ref={canvasRef} className="block h-full w-full" />
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 text-base text-white">
            <span>{loadingLabel}</span>
          </div>
        )}
      </div>
    );
  },
);

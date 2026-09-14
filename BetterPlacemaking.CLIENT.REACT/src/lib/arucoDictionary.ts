/**
 * js-aruco2 ships plain legacy scripts with no ESM exports and no real
 * `module.exports =` either (see aruco.js: `var AR = {}; ... this.AR = AR;`) -
 * they only work under Node's CJS loader, which calls each module function
 * with `this` bound to `module.exports` and a working `require()`. Vite/
 * rolldown's static ESM import analysis can't see through that pattern (a
 * plain `import { AR } from "js-aruco2/src/aruco"` fails at build time with
 * "AR is not exported"), so instead of importing these as modules we pull in
 * their raw source text (Vite's `?raw` import) and execute each one exactly
 * the way Node's CJS loader would - `this` bound to a fresh module.exports,
 * and a `require()` that resolves this package's small, fixed dependency
 * graph and caches results per id (matching Node's module cache, which is
 * what makes `this.AR || require('../aruco').AR` in each dictionary file
 * correctly return the same singleton `AR` object every other dictionary
 * file mutates `AR.DICTIONARIES` into).
 *
 * This is the same three dictionaries (4x4/5x5/6x6, each up to 1000 markers)
 * the Angular client's board-generate-modal.ts side-effect-imports.
 */
import arucoSrc from "js-aruco2/src/aruco.js?raw";
import cvSrc from "js-aruco2/src/cv.js?raw";
import dict4x4Src from "js-aruco2/src/dictionaries/aruco_4x4_1000.js?raw";
import dict5x5Src from "js-aruco2/src/dictionaries/aruco_5x5_1000.js?raw";
import dict6x6Src from "js-aruco2/src/dictionaries/aruco_6x6_1000.js?raw";

interface ArDictionaryInstance {
  codeList: string[];
  nBits: number;
}

interface ArNamespace {
  DICTIONARIES: Record<string, unknown>;
  Dictionary: new (name: string) => ArDictionaryInstance;
}

const SOURCES: Record<string, string> = {
  "aruco.js": arucoSrc,
  "cv.js": cvSrc,
  "dictionaries/aruco_4x4_1000.js": dict4x4Src,
  "dictionaries/aruco_5x5_1000.js": dict5x5Src,
  "dictionaries/aruco_6x6_1000.js": dict6x6Src,
};

/** Each module's require() targets, resolved to the SOURCES keys above. */
const REQUIRE_MAP: Record<string, Record<string, string>> = {
  "aruco.js": { "./cv": "cv.js" },
  "dictionaries/aruco_4x4_1000.js": { "../aruco": "aruco.js" },
  "dictionaries/aruco_5x5_1000.js": { "../aruco": "aruco.js" },
  "dictionaries/aruco_6x6_1000.js": { "../aruco": "aruco.js" },
};

interface CjsModule {
  exports: Record<string, unknown>;
}

const moduleCache = new Map<string, CjsModule>();

function loadModule(id: string): Record<string, unknown> {
  const cached = moduleCache.get(id);
  if (cached) return cached.exports;

  const source = SOURCES[id];
  if (!source) throw new Error(`Unknown js-aruco2 module: ${id}`);

  const mod: CjsModule = { exports: {} };
  moduleCache.set(id, mod);

  function localRequire(dep: string): Record<string, unknown> {
    const targetId = REQUIRE_MAP[id]?.[dep];
    if (!targetId) throw new Error(`Unresolved require("${dep}") from js-aruco2/${id}`);
    return loadModule(targetId);
  }

  const factory = new Function("module", "exports", "require", source) as (
    module: CjsModule,
    exports: Record<string, unknown>,
    require: (dep: string) => Record<string, unknown>,
  ) => void;
  factory.call(mod.exports, mod, mod.exports, localRequire);
  return mod.exports;
}

let arNamespace: ArNamespace | null = null;

function getAR(): ArNamespace {
  if (!arNamespace) {
    loadModule("dictionaries/aruco_4x4_1000.js");
    loadModule("dictionaries/aruco_5x5_1000.js");
    loadModule("dictionaries/aruco_6x6_1000.js");
    arNamespace = loadModule("aruco.js").AR as ArNamespace;
  }
  return arNamespace;
}

const dictionaryCache = new Map<string, ArDictionaryInstance>();

/** Returns (and caches) an `AR.Dictionary` instance - `.codeList` is the marker bit-pattern list, one string per marker id. */
export function getArucoDictionary(name: string): ArDictionaryInstance {
  let dict = dictionaryCache.get(name);
  if (!dict) {
    dict = new (getAR().Dictionary)(name);
    dictionaryCache.set(name, dict);
  }
  return dict;
}

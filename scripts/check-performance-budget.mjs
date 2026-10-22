import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = process.cwd();
const budgets = {
  "app/right-hand/page.tsx": 52000,
  // Trainer's route source is intentionally bounded separately from the lazy 3D engine.
  "app/trainer/page.tsx": 330000,
  "components/RightHandRecordingCoach.tsx": 16000,
  "lib/practicePlatform.ts": 14000,
  "public/sw.js": 5000
};

let failed = false;
for (const [file, maximumBytes] of Object.entries(budgets)) {
  const bytes = (await stat(resolve(root, file))).size;
  const status = bytes <= maximumBytes ? "PASS" : "FAIL";
  console.log(`${status} ${file}: ${bytes} / ${maximumBytes} bytes`);
  if (bytes > maximumBytes) failed = true;
}

// The browser's initial Trainer load is measured as gzip bytes from every asset
// emitted for the route. Optional 3D chunks are reported separately from the
// react-loadable manifest and are never removed from the initial set by name or size.
try {
  const manifestPath = resolve(root, ".next/app-build-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const layoutFiles = manifest.pages?.["/layout"] ?? [];
  const trainerFiles = manifest.pages?.["/trainer/page"] ?? [];
  const routeFiles = [...new Set([...layoutFiles, ...trainerFiles])];
  if (!layoutFiles.length || !trainerFiles.length) {
    failed = true;
    console.error("FAIL built /trainer initial assets: /layout and /trainer/page emitted files are both required. Run `npm run build` immediately before this check.");
  } else {
    let initialGzipBytes = 0;
    for (const file of [...new Set(routeFiles)]) {
      const relativeFile = file.replace(/^\/+/, "");
      const bytes = await readFile(resolve(root, ".next", relativeFile));
      initialGzipBytes += gzipSync(bytes).length;
    }
    let optionalGzipBytes = 0;
    try {
      const loadable = JSON.parse(await readFile(resolve(root, ".next/react-loadable-manifest.json"), "utf8"));
      const entry = Object.entries(loadable).find(([key]) => key.startsWith("app/trainer/page.tsx -> ../../components/GuitarTechnique3D"))?.[1];
      for (const file of (entry?.files ?? [])) {
        const relativeFile = String(file).replace(/^\/+/, "");
        if (routeFiles.some((routeFile) => routeFile.replace(/^\/+/, "") === relativeFile)) {
          failed = true;
          console.error(`FAIL /trainer optional 3D asset is eagerly emitted: ${relativeFile}`);
        }
        optionalGzipBytes += gzipSync(await readFile(resolve(root, ".next", relativeFile))).length;
      }
    } catch {
      // Older builds may not emit a loadable manifest; the initial route budget remains valid.
    }
    const maximumTrainerInitialGzipBytes = 280000;
    const status = initialGzipBytes <= maximumTrainerInitialGzipBytes ? "PASS" : "FAIL";
    console.log(`${status} built /trainer initial assets: ${initialGzipBytes} / ${maximumTrainerInitialGzipBytes} gzip bytes (optional 3D: ${optionalGzipBytes} bytes)`);
    if (initialGzipBytes > maximumTrainerInitialGzipBytes) failed = true;
  }
} catch (error) {
  failed = true;
  console.error(`FAIL built /trainer assets: ${error instanceof Error ? error.message : "build manifest unavailable"}`);
}

const maximumRouteBytes = 400000;
try {
  const manifestPath = resolve(root, ".next/app-build-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const routeKey = Object.keys(manifest.pages ?? {}).find((key) => key === "/right-hand/page");
  const routeFiles = routeKey ? [...new Set(manifest.pages[routeKey])] : [];

  if (!routeFiles.length) {
    failed = true;
    console.error("FAIL built /right-hand assets: no emitted route files found. Run `npm run build` immediately before this check; a development .next directory is not valid budget input.");
  } else {
    let routeBytes = 0;
    for (const file of routeFiles) {
      const relativeFile = file.replace(/^\/+/, "");
      routeBytes += (await stat(resolve(root, ".next", relativeFile))).size;
    }
    // Next's app-build manifest associates the route with both its emitted route chunk and
    // the shared browser runtime needed to load it. Budgeting the complete set prevents a
    // route from appearing cheaper by moving code into a shared chunk.
    const status = routeBytes <= maximumRouteBytes ? "PASS" : "FAIL";
    console.log(`${status} built /right-hand assets: ${routeBytes} / ${maximumRouteBytes} bytes across ${routeFiles.length} emitted files`);
    if (routeBytes > maximumRouteBytes) failed = true;
  }
} catch (error) {
  failed = true;
  console.error(`FAIL built /right-hand assets: ${error instanceof Error ? error.message : "build manifest unavailable"}`);
}

if (failed) process.exitCode = 1;

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const budgets = {
  "app/right-hand/page.tsx": 52000,
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

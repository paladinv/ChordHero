import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baselineDirectory = process.env.VISUAL_BASELINE_DIR;
const currentDirectory = process.env.VISUAL_CURRENT_DIR;
if (!baselineDirectory || !currentDirectory) {
  console.error("FAIL visual comparison requires VISUAL_BASELINE_DIR and VISUAL_CURRENT_DIR to point to captured PNG folders.");
  process.exit(1);
}

const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const baselineFiles = (await readdir(resolve(baselineDirectory))).filter((file) => file.endsWith(".png")).sort();
const currentFiles = (await readdir(resolve(currentDirectory))).filter((file) => file.endsWith(".png")).sort();
const currentSet = new Set(currentFiles);
const baselineSet = new Set(baselineFiles);
let failed = false;
for (const file of baselineFiles) {
  if (!currentSet.has(file)) { console.error(`FAIL missing current screenshot: ${file}`); failed = true; continue; }
  const matches = await digest(resolve(baselineDirectory, file)) === await digest(resolve(currentDirectory, file));
  console.log(`${matches ? "PASS" : "FAIL"} ${file}`);
  if (!matches) failed = true;
}
for (const file of currentFiles) {
  if (!baselineSet.has(file)) { console.error(`FAIL screenshot has no baseline: ${file}`); failed = true; }
}
if (!baselineFiles.length) { console.error("FAIL baseline directory contains no PNG files."); failed = true; }
if (failed) process.exitCode = 1;

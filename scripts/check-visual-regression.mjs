import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baselineDirectory = process.env.VISUAL_BASELINE_DIR;
const currentDirectory = process.env.VISUAL_CURRENT_DIR;
if (!baselineDirectory || !currentDirectory) {
  console.log("INFO visual comparison skipped. Set VISUAL_BASELINE_DIR and VISUAL_CURRENT_DIR to PNG folders after browser capture.");
  process.exit(0);
}

const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const baselineFiles = (await readdir(resolve(baselineDirectory))).filter((file) => file.endsWith(".png")).sort();
const currentFiles = new Set((await readdir(resolve(currentDirectory))).filter((file) => file.endsWith(".png")));
let failed = false;
for (const file of baselineFiles) {
  if (!currentFiles.has(file)) { console.error(`FAIL missing current screenshot: ${file}`); failed = true; continue; }
  const matches = await digest(resolve(baselineDirectory, file)) === await digest(resolve(currentDirectory, file));
  console.log(`${matches ? "PASS" : "FAIL"} ${file}`);
  if (!matches) failed = true;
}
if (!baselineFiles.length) { console.error("FAIL baseline directory contains no PNG files."); failed = true; }
if (failed) process.exitCode = 1;

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const task = process.argv[2];
const gradleTask = {
  unit: "testDebugUnitTest",
  instrumented: "connectedDebugAndroidTest",
}[task];

if (!gradleTask) {
  console.error("Usage: run-android-tests.mjs unit|instrumented");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDirectory = path.join(root, "android");
const windows = process.platform === "win32";
const command = windows ? (process.env.ComSpec ?? "cmd.exe") : "./gradlew";
const args = windows ? ["/d", "/s", "/c", `gradlew.bat ${gradleTask}`] : [gradleTask];
const child = spawn(command, args, { cwd: androidDirectory, stdio: "inherit" });
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("close", (code) => { process.exitCode = code ?? 1; });

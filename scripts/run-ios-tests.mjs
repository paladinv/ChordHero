import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const target = process.argv[2];
const onlyTesting = {
  unit: "ChordHeroTests",
  ui: "ChordHeroUITests",
}[target];

if (!onlyTesting) {
  console.error("Usage: run-ios-tests.mjs unit|ui");
  process.exit(2);
}

if (process.platform !== "darwin") {
  console.error("iOS tests require macOS and Xcode.");
  process.exit(2);
}

let deviceData;
try {
  deviceData = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "available", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.error("Unable to query available iOS simulators. Check that Xcode and CoreSimulator are installed and available.");
  process.exit(1);
}
const simulator = Object.values(deviceData.devices ?? {})
  .flat()
  .find((device) => device.isAvailable && device.name.startsWith("iPhone"));
if (!simulator) {
  console.error("No available iPhone simulator was found.");
  process.exit(1);
}

const derivedData = mkdtempSync(path.join(tmpdir(), `chord-hero-${target}-`));
const args = [
  "test",
  "-project", "ios/ChordHero/ChordHero.xcodeproj",
  "-scheme", "ChordHero",
  "-destination", `platform=iOS Simulator,id=${simulator.udid}`,
  "-derivedDataPath", derivedData,
  `-only-testing:${onlyTesting}`,
  "CODE_SIGNING_ALLOWED=NO",
];

const child = spawn("xcodebuild", args, { stdio: "inherit", cwd: process.cwd() });
child.once("error", (error) => {
  console.error(error.message);
  rmSync(derivedData, { recursive: true, force: true });
  process.exitCode = 1;
});
child.once("close", (code) => {
  rmSync(derivedData, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});

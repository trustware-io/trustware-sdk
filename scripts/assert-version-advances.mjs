/* global console, process */
/**
 * Refuses a publish that would move a package's `latest` dist-tag backward.
 *
 * Staging publishes with an explicit `--tag latest`, and npm only runs its own
 * "latest must not go backward" check when the tag is implicit. Without this,
 * a staging run that finishes after a newer one re-points `latest` at the
 * older build.
 *
 * Usage: node scripts/assert-version-advances.mjs <version> '<npm view versions --json>'
 */
import { fileURLToPath } from "node:url";

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-staging\.(\d+))?$/;

/** Sort key for the two version shapes this repo publishes. A release sorts
 *  above every staging build of the same X.Y.Z, as in semver. */
function parseVersion(version) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(
      `Version "${version}" is neither X.Y.Z nor X.Y.Z-staging.N`
    );
  }
  const [, major, minor, patch, stagingBuild] = match;
  return [
    Number(major),
    Number(minor),
    Number(patch),
    stagingBuild === undefined ? Infinity : Number(stagingBuild),
  ];
}

function compareVersions(left, right) {
  const leftKey = parseVersion(left);
  const rightKey = parseVersion(right);
  for (let i = 0; i < leftKey.length; i++) {
    if (leftKey[i] !== rightKey[i]) return leftKey[i] < rightKey[i] ? -1 : 1;
  }
  return 0;
}

/**
 * `npm view <pkg> versions --json` prints an array, or a bare string when the
 * package has exactly one version.
 */
export function parsePublishedVersions(json) {
  const parsed = JSON.parse(json);
  if (typeof parsed === "string") return [parsed];
  if (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.every((v) => typeof v === "string")
  ) {
    return parsed;
  }
  throw new Error(`Unexpected npm versions output: ${json}`);
}

/** Throws unless `version` sorts above every published version. */
export function assertVersionAdvances(version, publishedVersions) {
  parseVersion(version);
  const highest = publishedVersions.reduce((a, b) =>
    compareVersions(a, b) >= 0 ? a : b
  );
  if (compareVersions(version, highest) <= 0) {
    throw new Error(
      `Refusing to publish ${version}: ${highest} is already published, and publishing with --tag latest would move latest backward`
    );
  }
  return highest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, publishedJson] = process.argv.slice(2);
  if (version === undefined || publishedJson === undefined) {
    throw new Error(
      "Usage: assert-version-advances.mjs <version> '<npm view versions --json>'"
    );
  }
  const highest = assertVersionAdvances(
    version,
    parsePublishedVersions(publishedJson)
  );
  console.log(`${version} is above the highest published version, ${highest}`);
}

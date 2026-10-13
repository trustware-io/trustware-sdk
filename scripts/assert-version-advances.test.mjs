/* global process */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertVersionAdvances,
  parsePublishedVersions,
} from "./assert-version-advances.mjs";

const SCRIPT = fileURLToPath(
  new URL("./assert-version-advances.mjs", import.meta.url)
);

describe("assertVersionAdvances: publishes that move latest forward", () => {
  it("allows the next staging build of the same release", () => {
    assert.equal(
      assertVersionAdvances("1.1.17-staging.2", [
        "0.0.0",
        "1.1.16-staging.3",
        "1.1.17-staging.1",
      ]),
      "1.1.17-staging.1"
    );
  });

  it("allows the first staging build of the next release", () => {
    assert.equal(
      assertVersionAdvances("1.1.18-staging.1", ["1.1.17-staging.9"]),
      "1.1.17-staging.9"
    );
  });

  it("allows a staging build above the last published release", () => {
    assert.equal(
      assertVersionAdvances("1.1.17-staging.1", ["1.1.16"]),
      "1.1.16"
    );
  });

  it("compares staging builds numerically, not as text", () => {
    assert.equal(
      assertVersionAdvances("1.1.17-staging.10", ["1.1.17-staging.9"]),
      "1.1.17-staging.9"
    );
  });

  it("compares each release component numerically", () => {
    assert.equal(
      assertVersionAdvances("1.10.0-staging.1", ["1.9.99"]),
      "1.9.99"
    );
  });

  it("allows the first build over the 0.0.0 placeholder", () => {
    assert.equal(assertVersionAdvances("1.1.17-staging.1", ["0.0.0"]), "0.0.0");
  });

  it("measures against the highest version, wherever it sits in the list", () => {
    assert.equal(
      assertVersionAdvances("1.1.17-staging.3", [
        "1.1.17-staging.2",
        "0.0.0",
        "1.1.16-staging.3",
      ]),
      "1.1.17-staging.2"
    );
  });
});

describe("assertVersionAdvances: publishes that would move latest backward", () => {
  it("refuses an older staging build after a newer one published", () => {
    assert.throws(
      () =>
        assertVersionAdvances("1.1.17-staging.1", [
          "1.1.17-staging.1",
          "1.1.17-staging.2",
        ]),
      {
        message:
          "Refusing to publish 1.1.17-staging.1: 1.1.17-staging.2 is already published, and publishing with --tag latest would move latest backward",
      }
    );
  });

  it("refuses a version that is already published", () => {
    assert.throws(
      () => assertVersionAdvances("1.1.17-staging.2", ["1.1.17-staging.2"]),
      {
        message:
          "Refusing to publish 1.1.17-staging.2: 1.1.17-staging.2 is already published, and publishing with --tag latest would move latest backward",
      }
    );
  });

  it("refuses a staging build of a release that is already out", () => {
    assert.throws(() => assertVersionAdvances("1.1.17-staging.5", ["1.1.17"]), {
      message:
        "Refusing to publish 1.1.17-staging.5: 1.1.17 is already published, and publishing with --tag latest would move latest backward",
    });
  });
});

describe("assertVersionAdvances: malformed versions", () => {
  for (const bad of [
    "v1.1.17-staging.2",
    "1.1.17-rc.1",
    "1.1.17-staging",
    "1.1",
    "",
  ]) {
    it(`rejects the new version ${JSON.stringify(bad)}`, () => {
      assert.throws(() => assertVersionAdvances(bad, ["0.0.0"]), {
        message: `Version "${bad}" is neither X.Y.Z nor X.Y.Z-staging.N`,
      });
    });
  }

  it("rejects a published version it cannot order", () => {
    assert.throws(
      () =>
        assertVersionAdvances("1.1.17-staging.2", ["0.0.0", "1.2.0-beta.1"]),
      { message: 'Version "1.2.0-beta.1" is neither X.Y.Z nor X.Y.Z-staging.N' }
    );
  });
});

describe("parsePublishedVersions", () => {
  it("reads the array npm prints for several versions", () => {
    assert.deepEqual(parsePublishedVersions('["0.0.0","1.1.17-staging.1"]'), [
      "0.0.0",
      "1.1.17-staging.1",
    ]);
  });

  it("reads the bare string npm prints for a single version", () => {
    assert.deepEqual(parsePublishedVersions('"0.0.0"'), ["0.0.0"]);
  });

  for (const bad of ["[]", "[1]", "null", '{"latest":"0.0.0"}']) {
    it(`rejects ${bad}`, () => {
      assert.throws(() => parsePublishedVersions(bad), {
        message: `Unexpected npm versions output: ${bad}`,
      });
    });
  }

  it("rejects output that is not JSON", () => {
    assert.throws(() => parsePublishedVersions("npm error 404"), SyntaxError);
  });
});

// ── Properties ──────────────────────────────────────────────────────────────

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small components so generated pairs often tie on a prefix, which is
 *  where an ordering bug would hide. */
function randomVersion(random) {
  const part = () => Math.floor(random() * 3) * (random() < 0.1 ? 10 : 1);
  const base = `${part()}.${part()}.${part()}`;
  return random() < 0.3 ? base : `${base}-staging.${part()}`;
}

const advances = (version, published) => {
  try {
    assertVersionAdvances(version, published);
    return true;
  } catch (error) {
    if (!error.message.startsWith("Refusing to publish")) throw error;
    return false;
  }
};

describe("assertVersionAdvances properties", () => {
  it("orders any two versions strictly: exactly one may follow the other, and neither may follow itself", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 5000; i++) {
      const a = randomVersion(random);
      const b = randomVersion(random);
      const context = `${a} vs ${b}`;
      if (a === b) {
        assert.equal(advances(a, [b]), false, context);
      } else {
        assert.notEqual(advances(a, [b]), advances(b, [a]), context);
      }
    }
  });

  it("gives the same verdict however the published list is ordered", () => {
    const random = mulberry32(2);
    for (let i = 0; i < 2000; i++) {
      const published = Array.from(
        { length: 1 + Math.floor(random() * 6) },
        () => randomVersion(random)
      );
      const candidate = randomVersion(random);
      const reversed = [...published].reverse();
      const verdict = advances(candidate, published);
      assert.equal(
        advances(candidate, reversed),
        verdict,
        `${candidate} over ${JSON.stringify(published)}`
      );
      // Advancing past the list means advancing past every member of it.
      assert.equal(
        verdict,
        published.every((p) => advances(candidate, [p])),
        `${candidate} over ${JSON.stringify(published)}`
      );
    }
  });
});

// ── CLI, as publish.yml calls it ────────────────────────────────────────────

describe("assert-version-advances CLI", () => {
  it("exits 0 and names the version it advanced past", () => {
    const stdout = execFileSync(
      process.execPath,
      [SCRIPT, "1.1.17-staging.2", '["0.0.0","1.1.17-staging.1"]'],
      { encoding: "utf8" }
    );
    assert.equal(
      stdout,
      "1.1.17-staging.2 is above the highest published version, 1.1.17-staging.1\n"
    );
  });

  it("exits non-zero with the reason when latest would move backward", () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, "1.1.17-staging.1", '["1.1.17-staging.2"]'],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(
      result.stderr.includes(
        "Error: Refusing to publish 1.1.17-staging.1: 1.1.17-staging.2 is already published, and publishing with --tag latest would move latest backward"
      ),
      result.stderr
    );
  });

  it("exits non-zero when an argument is missing", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "1.1.17-staging.2"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Error: Usage: assert-version-advances.mjs <version> '<npm view versions --json>'"
      ),
      result.stderr
    );
  });
});

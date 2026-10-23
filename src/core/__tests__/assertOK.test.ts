import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertOK, HttpError } from "../http";

describe("assertOK", () => {
  it("resolves for a 2xx response", async () => {
    await assertOK(new Response("{}", { status: 200 }));
  });

  it("throws an HttpError carrying the status and the envelope's error", async () => {
    const thrown = await assertOK(
      new Response(JSON.stringify({ error: "transaction hash already used" }), {
        status: 409,
      })
    ).catch((e: unknown) => e);

    assert.ok(thrown instanceof HttpError);
    assert.equal(thrown.status, 409);
    assert.equal(thrown.serverMessage, "transaction hash already used");
    // Displayed and logged text is unchanged from the plain Error it replaced.
    assert.equal(thrown.message, "HTTP 409: transaction hash already used");
    assert.equal(thrown.name, "HttpError");
  });

  it("falls back to the status text when the body is not JSON", async () => {
    const thrown = await assertOK(
      new Response("<html>bad gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
      })
    ).catch((e: unknown) => e);

    assert.ok(thrown instanceof HttpError);
    assert.equal(thrown.status, 502);
    assert.equal(thrown.message, "HTTP 502: Bad Gateway");
  });
});

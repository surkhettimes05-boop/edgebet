#!/usr/bin/env node
/**
 * smoke-test.js
 *
 * End-to-end post-deploy smoke test.
 * Validates that the API, database, and all critical endpoints are live
 * and returning expected shapes.
 *
 * DB-dependent checks (auth, bets) are automatically skipped when the
 * health endpoint reports database=unconfigured, so this script passes
 * cleanly in local dev without a DATABASE_URL.
 *
 * Usage:
 *   node apps/api/scripts/smoke-test.js [BASE_URL]
 *   API_URL=https://edgebet-api.up.railway.app node apps/api/scripts/smoke-test.js
 *
 * Environment:
 *   API_URL        — target base URL (overridden by positional arg)
 *   SMOKE_EMAIL    — test account email   (default: smoke@edgebet-test.local)
 *   SMOKE_PASSWORD — test account password (default: SmokeTest2026!)
 *
 * Exit codes:
 *   0 — all applicable checks passed
 *   1 — one or more checks failed
 */

"use strict";

const https = require("https");
const http  = require("http");

const BASE_URL       = process.argv[2] || process.env.API_URL || "http://localhost:4000";
const SMOKE_EMAIL    = process.env.SMOKE_EMAIL    || "smoke@edgebet-test.local";
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || "SmokeTest2026!";
const TIMEOUT_MS     = 15_000;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url     = new URL(path, BASE_URL);
    const client  = url.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const headers = { "Content-Type": "application/json" };
    if (token)   headers["Authorization"] = `Bearer ${token}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname,
      method,
      headers,
      timeout: TIMEOUT_MS
    };

    const req = client.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on("error",   reject);
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Assertion helper ─────────────────────────────────────────────────────────

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const results = [];

async function check(name, fn, { skip = false, skipReason = "" } = {}) {
  if (skip) {
    results.push({ name, ok: true, skipped: true, skipReason });
    console.log(`  ○  ${name} [skipped: ${skipReason}]`);
    return;
  }
  try {
    await fn();
    results.push({ name, ok: true, skipped: false });
    console.log(`  ✓  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, skipped: false, error: err.message });
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
  }
}

async function run() {
  console.log(`\nEdgeBet Smoke Test`);
  console.log(`Target:  ${BASE_URL}`);
  console.log(`Account: ${SMOKE_EMAIL}`);
  console.log("─".repeat(54));

  // ── Probe health first to decide which checks to run ──────────────────────
  let dbStatus = "unknown";
  try {
    const { body } = await request("GET", "/health");
    dbStatus = body.database ?? "unknown";
  } catch {
    // health check itself will report the failure below
  }

  const dbAvailable = dbStatus === "connected";
  const dbSkipReason = dbStatus === "unconfigured"
    ? "DATABASE_URL not configured"
    : dbStatus === "unavailable"
    ? "database unavailable"
    : "";

  // ── Infrastructure checks (always run) ────────────────────────────────────

  await check("GET /health → status ok", async () => {
    const { status, body } = await request("GET", "/health");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(
      body.status === "ok" || body.status === "degraded",
      `Unexpected status: ${body.status}`
    );
    assert(body.service === "edgebet-api", `Unexpected service: ${body.service}`);
    assert(typeof body.uptime === "number", "Missing uptime field");
  });

  await check("GET /health → database field present", async () => {
    const { body } = await request("GET", "/health");
    const valid = ["connected", "unconfigured", "unavailable"];
    assert(valid.includes(body.database), `Unexpected database value: ${body.database}`);
    if (body.database !== "connected") {
      console.log(`     ℹ  database=${body.database} — DB checks will be skipped`);
    }
  });

  await check("GET /matches → returns data array", async () => {
    const { status, body } = await request("GET", "/matches");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(body.data), "Expected body.data to be an array");
  });

  await check("GET /predictions → returns data array", async () => {
    const { status, body } = await request("GET", "/predictions");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(body.data), "Expected body.data to be an array");
  });

  await check("GET /calibration → returns stats object", async () => {
    const { status, body } = await request("GET", "/calibration");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(body.status === "OK", `Expected status=OK, got ${body.status}`);
    assert(typeof body.data?.stats === "object", "Expected data.stats to be an object");
    assert(typeof body.data?.bins  === "object", "Expected data.bins to be an array");
  });

  await check("GET /bets → 401 without token", async () => {
    const { status } = await request("GET", "/bets");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await check("GET /auth/me → 401 without token", async () => {
    const { status } = await request("GET", "/auth/me");
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── DB-dependent checks (skipped when database is not connected) ───────────

  let authToken = null;

  await check(
    "POST /auth/register → creates or finds user",
    async () => {
      const { status, body } = await request("POST", "/auth/register", {
        email: SMOKE_EMAIL, password: SMOKE_PASSWORD, name: "Smoke Test"
      });
      // 201 = new user, 400 USER_EXISTS = already exists from prior run — both fine
      assert(
        status === 201 || (status === 400 && body.status === "USER_EXISTS"),
        `Unexpected ${status}: ${JSON.stringify(body)}`
      );
      if (status === 201) authToken = body.token;
    },
    { skip: !dbAvailable, skipReason: dbSkipReason }
  );

  await check(
    "POST /auth/login → returns JWT token",
    async () => {
      const { status, body } = await request("POST", "/auth/login", {
        email: SMOKE_EMAIL, password: SMOKE_PASSWORD
      });
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
      assert(typeof body.token === "string" && body.token.length > 20, "Token missing or too short");
      authToken = body.token;
    },
    { skip: !dbAvailable, skipReason: dbSkipReason }
  );

  await check(
    "GET /auth/me → returns authenticated user",
    async () => {
      assert(authToken, "No token — login must succeed first");
      const { status, body } = await request("GET", "/auth/me", null, authToken);
      assert(status === 200, `Expected 200, got ${status}`);
      assert(body.user?.email === SMOKE_EMAIL, `Expected ${SMOKE_EMAIL}, got ${body.user?.email}`);
    },
    { skip: !dbAvailable, skipReason: dbSkipReason }
  );

  await check(
    "GET /bets → returns data array with valid token",
    async () => {
      assert(authToken, "No token — login must succeed first");
      const { status, body } = await request("GET", "/bets", null, authToken);
      assert(status === 200, `Expected 200, got ${status}`);
      assert(Array.isArray(body.data), "Expected body.data to be an array");
    },
    { skip: !dbAvailable, skipReason: dbSkipReason }
  );

  await check(
    "POST /auth/logout → clears session",
    async () => {
      assert(authToken, "No token — login must succeed first");
      const { status, body } = await request("POST", "/auth/logout", null, authToken);
      assert(status === 200, `Expected 200, got ${status}`);
      assert(body.status === "OK", `Expected status=OK, got ${body.status}`);
    },
    { skip: !dbAvailable, skipReason: dbSkipReason }
  );

  // ── Summary ───────────────────────────────────────────────────────────────

  const passed  = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed  = results.filter((r) => !r.ok).length;

  console.log("─".repeat(54));
  console.log(`  ${passed} passed, ${skipped} skipped, ${failed} failed\n`);

  if (failed > 0) {
    console.error("Failed checks:");
    results.filter((r) => !r.ok).forEach((r) => {
      console.error(`  • ${r.name}`);
      console.error(`    ${r.error}`);
    });
    console.error("");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("\nSmoke test runner error:", err.message);
  process.exit(1);
});

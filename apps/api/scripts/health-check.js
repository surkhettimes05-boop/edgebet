#!/usr/bin/env node
/**
 * health-check.js
 *
 * Post-deploy health verification script.
 * Checks the API /health endpoint and validates the response shape.
 *
 * Usage:
 *   node scripts/health-check.js https://edgebet-api.up.railway.app
 *   node scripts/health-check.js http://localhost:4000
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

"use strict";

const https = require("https");
const http = require("http");

const BASE_URL = process.argv[2] || process.env.API_URL || "http://localhost:4000";
const TIMEOUT_MS = 10000;

// ─── Checks ───────────────────────────────────────────────────────────────────

const checks = [
  {
    name: "API reachable",
    path: "/health",
    validate(body) {
      if (body.status !== "ok" && body.status !== "degraded") {
        throw new Error(`Unexpected status: ${body.status}`);
      }
    }
  },
  {
    name: "Database connected",
    path: "/health",
    validate(body) {
      if (body.database === "unavailable") {
        throw new Error("Database reports unavailable.");
      }
    }
  },
  {
    name: "Matches endpoint responds",
    path: "/matches",
    validate(body) {
      if (!Array.isArray(body.data)) {
        throw new Error("Expected data array in /matches response.");
      }
    }
  },
  {
    name: "Calibration endpoint responds",
    path: "/calibration",
    validate(body) {
      if (body.status !== "OK") {
        throw new Error(`Unexpected status from /calibration: ${body.status}`);
      }
    }
  }
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          reject(new Error(`Non-JSON response from ${url}: ${raw.slice(0, 120)}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
    });
  });
}

async function run() {
  console.log(`\nEdgeBet Production Health Check`);
  console.log(`Target: ${BASE_URL}`);
  console.log("─".repeat(50));

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const url = `${BASE_URL}${check.path}`;
    try {
      const { body } = await fetchJson(url);
      check.validate(body);
      console.log(`  ✓  ${check.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗  ${check.name}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  console.log("─".repeat(50));
  console.log(`  ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Health check runner error:", err.message);
  process.exit(1);
});

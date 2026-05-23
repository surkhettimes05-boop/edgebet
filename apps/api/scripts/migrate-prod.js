#!/usr/bin/env node
/**
 * migrate-prod.js
 *
 * Runs `prisma migrate deploy` against the production DATABASE_URL.
 * Called by `npm run start:prod` before the server starts.
 *
 * Exits with code 1 on failure so Railway/Render aborts the deploy
 * rather than starting a server against an unmigrated schema.
 */

"use strict";

require("dotenv").config();

const { execSync } = require("child_process");
const path = require("path");

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

if (!process.env.DATABASE_URL) {
  console.error("[migrate] ERROR: DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

console.log("[migrate] Running prisma migrate deploy...");

try {
  execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
    stdio: "inherit",
    env: process.env
  });
  console.log("[migrate] Migrations applied successfully.");
} catch (err) {
  console.error("[migrate] Migration failed:", err.message);
  process.exit(1);
}

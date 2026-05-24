const request = require("supertest");

const { app, prisma } = require("../src/server");

describe("odds ingestion job route", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("ODDS_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rejects job calls without the cron secret", async () => {
    const response = await request(app).get("/jobs/fetch-odds");

    expect(response.status).toBe(401);
  });

  test("reports missing odds provider key when the cron secret is valid", async () => {
    const response = await request(app)
      .get("/jobs/fetch-odds")
      .set("Authorization", "Bearer test-secret");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "SKIPPED",
      data: {
        fetchedMatches: 0,
        normalizedSnapshots: 0,
        storedSnapshots: 0,
        skipped: true,
        error: "ODDS_API_KEY is not configured."
      }
    });
  });

  test("accepts a separate job secret for external schedulers", async () => {
    vi.stubEnv("CRON_SECRET", "vercel-secret");
    vi.stubEnv("JOB_SECRET", "external-secret");

    const response = await request(app)
      .get("/jobs/fetch-odds")
      .set("Authorization", "Bearer external-secret");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "SKIPPED",
      data: {
        skipped: true,
        error: "ODDS_API_KEY is not configured."
      }
    });
  });

  test("rejects prediction job calls without the cron secret", async () => {
    const response = await request(app).get("/jobs/generate-predictions");

    expect(response.status).toBe(401);
  });

  test("skips prediction generation when database is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await request(app)
      .get("/jobs/generate-predictions")
      .set("Authorization", "Bearer test-secret");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "SKIPPED",
      data: {
        skipped: true,
        error: "DATABASE_URL is not configured."
      }
    });
  });
});

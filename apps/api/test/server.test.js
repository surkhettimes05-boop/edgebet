const request = require("supertest");
const { app } = require("../src/server");

describe("EdgeBet API", () => {
  test("reports API and database health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "edgebet-api"
    });
    expect(response.body).toHaveProperty("database");
  });

  test("returns a matches collection envelope", async () => {
    const response = await request(app).get("/matches");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: {
        source: "database",
        count: 0
      }
    });
  });

  test("returns predictions without fake confidence", async () => {
    const response = await request(app).get("/predictions");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: {
        source: "database",
        count: 0,
        note: "Model outputs require persisted records; no synthetic confidence is generated."
      }
    });
  });
});

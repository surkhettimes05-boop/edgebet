describe("Vercel API adapter", () => {
  it("exports the Express app as a request handler", () => {
    const handler = require("../api/index");

    expect(typeof handler).toBe("function");
    expect(typeof handler.use).toBe("function");
    expect(handler.default).toBe(handler);
  });
});

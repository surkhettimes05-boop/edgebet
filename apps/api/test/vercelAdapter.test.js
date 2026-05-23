describe("Vercel API adapter", () => {
  it("exports the Express app as a default request handler", async () => {
    const { default: handler } = await import("../api/index.mjs");

    expect(typeof handler).toBe("function");
    expect(typeof handler.use).toBe("function");
  });
});

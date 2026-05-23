// Absolute top: mock Prisma Client


const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => {
      return {
        user: {
          findUnique: mockFindUnique,
          create: mockCreate
        }
      };
    })
  };
});

// Set a dummy DATABASE_URL so Prisma client initialization won't throw
process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";

// Now import the rest of the application
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { app } = require("../src/server");
const { signToken, verifyToken } = require("../src/utils/jwt");

describe("JWT Utilities", () => {
  test("signs and verifies tokens correctly", () => {
    const payload = { id: "user-1", email: "test@edgebet.com" };
    const token = signToken(payload);

    expect(token).toBeTypeOf("string");

    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(payload);
  });

  test("returns null for invalid token verify", () => {
    expect(verifyToken("invalid-token-string")).toBeNull();
  });
});

describe("Authentication Routes & Controllers", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
  });

  describe("POST /auth/register", () => {
    test("registers a new user successfully", async () => {
      mockFindUnique.mockResolvedValue(null); // User does not exist
      mockCreate.mockResolvedValue({
        id: "user-1",
        email: "new@edgebet.com",
        name: "Test User",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "new@edgebet.com",
          password: "password123",
          name: "Test User"
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("OK");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toMatchObject({
        id: "user-1",
        email: "new@edgebet.com",
        name: "Test User"
      });
      expect(response.body.user).not.toHaveProperty("hashedPassword");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "new@edgebet.com" }
      });
      expect(mockCreate).toHaveBeenCalled();
    });

    test("fails if user email already exists", async () => {
      mockFindUnique.mockResolvedValue({ id: "user-existing" });

      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "existing@edgebet.com",
          password: "password123"
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("USER_EXISTS");
      expect(response.body.error).toContain("already exists");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test("rejects missing parameters", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({ email: "only-email@edgebet.com" });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("INVALID_INPUT");
    });
  });

  describe("POST /auth/login", () => {
    test("authenticates user with correct credentials", async () => {
      const plainPassword = "password123";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      mockFindUnique.mockResolvedValue({
        id: "user-1",
        email: "login@edgebet.com",
        name: "Login User",
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "login@edgebet.com",
          password: plainPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("OK");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toMatchObject({
        id: "user-1",
        email: "login@edgebet.com"
      });
    });

    test("rejects incorrect password", async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("correct-password", salt);

      mockFindUnique.mockResolvedValue({
        id: "user-1",
        email: "login@edgebet.com",
        hashedPassword
      });

      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "login@edgebet.com",
          password: "wrong-password"
        });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("INVALID_CREDENTIALS");
      expect(response.body).not.toHaveProperty("token");
    });

    test("rejects non-existent email", async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "notfound@edgebet.com",
          password: "password123"
        });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("GET /auth/me (Protected Route)", () => {
    test("rejects request lacking token", async () => {
      const response = await request(app).get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("UNAUTHORIZED");
    });

    test("accepts request with valid token", async () => {
      const token = signToken({ id: "user-1", email: "auth@edgebet.com" });

      mockFindUnique.mockResolvedValue({
        id: "user-1",
        email: "auth@edgebet.com",
        name: "Authorized User",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("OK");
      expect(response.body.user).toMatchObject({
        id: "user-1",
        email: "auth@edgebet.com"
      });
    });

    test("rejects request if user associated with valid token was deleted", async () => {
      const token = signToken({ id: "user-deleted", email: "deleted@edgebet.com" });

      mockFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe("UNAUTHORIZED");
      expect(response.body.error).toContain("no longer exists");
    });
  });
});

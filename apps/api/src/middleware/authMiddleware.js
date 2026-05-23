const { verifyToken } = require("../utils/jwt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
  try {
    let token = null;

    // 1. Extract from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. Fallback: Extract from cookie (requires cookie-parser middleware)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        error: "Access token is missing."
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        error: "Access token is invalid or expired."
      });
    }

    // Check if user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        error: "User associated with this token no longer exists."
      });
    }

    // Attach user payload to request
    req.user = user;
    next();
  } catch (error) {
    console.error("MIDDLEWARE ERROR:", error);
    return res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
}

module.exports = {
  requireAuth
};

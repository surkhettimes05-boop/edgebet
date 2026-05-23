const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { signToken } = require("../utils/jwt");

const prisma = new PrismaClient();

async function register(req, res) {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: "Email and password are required."
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({
        status: "USER_EXISTS",
        error: "A user with this email address already exists."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name || null,
        hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const token = signToken({ id: user.id, email: user.email });

    // Optional: set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(201).json({
      status: "OK",
      token,
      user
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: "Email and password are required."
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({
        status: "INVALID_CREDENTIALS",
        error: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: "INVALID_CREDENTIALS",
        error: "Invalid email or password."
      });
    }

    const token = signToken({ id: user.id, email: user.email });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      status: "OK",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
}

async function logout(req, res) {
  res.clearCookie("token");
  return res.status(200).json({
    status: "OK",
    message: "Logged out successfully."
  });
}

async function me(req, res) {
  return res.status(200).json({
    status: "OK",
    user: req.user
  });
}

module.exports = {
  register,
  login,
  logout,
  me
};

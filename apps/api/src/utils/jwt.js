const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "edgebet-secure-fallback-secret-key-32-chars";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  JWT_SECRET
};

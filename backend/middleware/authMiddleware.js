const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    if (payload.role === "student" && payload.userId) {
      const user = await userModel.findById(payload.userId);
      if (!user) return res.status(401).json({ message: "User not found" });
      const approvalStatus = user.approvalStatus || "approved";
      if (approvalStatus !== "approved") {
        return res.status(403).json({ message: "Student access requires admin approval" });
      }
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}

function representativeRequired(req, res, next) {
  if (!req.user || req.user.role !== "representative") {
    return res.status(403).json({ message: "Representative access required" });
  }
  return next();
}

module.exports = {
  authRequired,
  adminRequired,
  representativeRequired
};

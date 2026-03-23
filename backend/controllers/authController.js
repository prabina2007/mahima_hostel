const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

function issueToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "dev-secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

function sanitizeUser(user) {
  const approvalStatus = user.approvalStatus || "approved";
  return {
    id: user.id,
    studentName: user.studentName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    roomNumber: user.roomNumber,
    bed: user.bed,
    rollNumber: user.rollNumber,
    defaultPreference: user.defaultPreference,
    approvalStatus,
    approvedAt: user.approvedAt || null,
    rejectedAt: user.rejectedAt || null,
    createdAt: user.createdAt
  };
}

async function signup(req, res) {
  try {
    const {
      studentName,
      email,
      phoneNumber,
      roomNumber,
      bed,
      rollNumber,
      password,
      defaultPreference
    } = req.body;

    if (!studentName || !email || !phoneNumber || !roomNumber || !bed || !rollNumber || !password) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const normalizedPhoneNumber = String(phoneNumber).replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalizedPhoneNumber)) {
      return res.status(400).json({ message: "Phone number must be 10 digits" });
    }

    if (!["A", "B"].includes(String(bed).toUpperCase())) {
      return res.status(400).json({ message: "Bed must be A or B" });
    }

    const emailExists = await userModel.findByEmail(email);
    if (emailExists) return res.status(409).json({ message: "Email already registered" });

    const roomBedExists = await userModel.findByRoomBed(roomNumber, bed);
    if (roomBedExists) return res.status(409).json({ message: "Room and bed already occupied" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userModel.createUser({
      studentName,
      email,
      phoneNumber: normalizedPhoneNumber,
      roomNumber,
      bed,
      rollNumber,
      passwordHash,
      defaultPreference: defaultPreference || "veg",
      approvalStatus: "pending"
    });

    return res.status(201).json({
      message: "Signup submitted successfully. Wait for admin approval before login.",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed", error: error.message });
  }
}

async function login(req, res) {
  try {
    const { roomNumber, bed, password } = req.body;
    if (!roomNumber || !bed || !password) {
      return res.status(400).json({ message: "Room number, bed and password are required" });
    }

    const user = await userModel.findByRoomBed(roomNumber, bed);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const approvalStatus = user.approvalStatus || "approved";

    if (approvalStatus === "pending") {
      return res.status(403).json({ message: "Your account is pending admin approval" });
    }

    if (approvalStatus === "rejected") {
      return res.status(403).json({ message: "Your account has been rejected by the administrator" });
    }

    const token = issueToken({ userId: user.id, role: "student" });
    return res.json({
      message: "Login successful",
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

async function me(req, res) {
  try {
    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
}

async function adminLogin(req, res) {
  const { username, password } = req.body;
  if (username !== "admin" || password !== "mahima@2007") {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }
  const token = issueToken({ role: "admin", username: "admin" });
  return res.json({ message: "Admin login successful", token });
}

async function representativeLogin(req, res) {
  const { username, password } = req.body;
  if (username !== "admin" || password !== "hostel@2007") {
    return res.status(401).json({ message: "Invalid representative credentials" });
  }
  const token = issueToken({ role: "representative", username: "admin" });
  return res.json({ message: "Representative login successful", token });
}

module.exports = {
  signup,
  login,
  me,
  adminLogin,
  representativeLogin
};





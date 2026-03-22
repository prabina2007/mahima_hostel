const { v4: uuidv4 } = require("uuid");
const { readJson, writeJson } = require("./store");
const { getMongoModels, isMongoReady } = require("./mongoClient");

const FILE = "users.json";

async function getAllUsers() {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const docs = await UserModel.find({}).sort({ createdAt: 1 }).lean();
    return docs.map(normalizeMongoUser);
  }
  return readJson(FILE);
}

async function saveAllUsers(users) {
  return writeJson(FILE, users);
}

function normalizePreference(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "non-veg" ? "non-veg" : "veg";
}

function normalizeApprovalStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "approved" || v === "rejected") return v;
  return "pending";
}

function normalizeOverrideValue(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "force-on" || v === "force-off") return v;
  return "none";
}

function normalizeMealOverride(value) {
  const override = value || {};
  return {
    lunch: normalizeOverrideValue(override.lunch),
    dinner: normalizeOverrideValue(override.dinner)
  };
}

async function findByEmail(email) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const doc = await UserModel.findOne({ email: String(email).toLowerCase().trim() }).lean();
    return normalizeMongoUser(doc);
  }
  const users = await getAllUsers();
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

async function findByRoomBed(roomNumber, bed) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const doc = await UserModel.findOne({
      roomNumber: String(roomNumber).trim(),
      bed: String(bed).trim().toUpperCase()
    }).lean();
    return normalizeMongoUser(doc);
  }
  const users = await getAllUsers();
  return users.find(
    (u) =>
      String(u.roomNumber).trim().toLowerCase() === String(roomNumber).trim().toLowerCase() &&
      String(u.bed).trim().toUpperCase() === String(bed).trim().toUpperCase()
  );
}

async function findById(id) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const doc = await UserModel.findOne({ id }).lean();
    return normalizeMongoUser(doc);
  }
  const users = await getAllUsers();
  return users.find((u) => u.id === id);
}

async function createUser(payload) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const doc = await UserModel.create({
      id: uuidv4(),
      studentName: payload.studentName.trim(),
      email: payload.email.trim().toLowerCase(),
      phoneNumber: String(payload.phoneNumber || "").trim(),
      roomNumber: String(payload.roomNumber).trim(),
      bed: String(payload.bed).trim().toUpperCase(),
      rollNumber: String(payload.rollNumber).trim(),
      passwordHash: payload.passwordHash,
      defaultPreference: normalizePreference(payload.defaultPreference),
      approvalStatus: normalizeApprovalStatus(payload.approvalStatus),
      approvedAt: payload.approvedAt || null,
      rejectedAt: payload.rejectedAt || null,
      adminMealOverride: normalizeMealOverride(payload.adminMealOverride),
      meals: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return normalizeMongoUser(doc.toObject());
  }
  const users = await getAllUsers();
  const user = {
    id: uuidv4(),
    studentName: payload.studentName.trim(),
    email: payload.email.trim().toLowerCase(),
    phoneNumber: String(payload.phoneNumber || "").trim(),
    roomNumber: String(payload.roomNumber).trim(),
    bed: String(payload.bed).trim().toUpperCase(),
    rollNumber: String(payload.rollNumber).trim(),
    passwordHash: payload.passwordHash,
    defaultPreference: normalizePreference(payload.defaultPreference),
    approvalStatus: normalizeApprovalStatus(payload.approvalStatus),
    approvedAt: payload.approvedAt || null,
    rejectedAt: payload.rejectedAt || null,
    adminMealOverride: normalizeMealOverride(payload.adminMealOverride),
    meals: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  users.push(user);
  await saveAllUsers(users);
  return user;
}

async function updateUser(userId, updater) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const current = await UserModel.findOne({ id: userId }).lean();
    if (!current) return null;
    const next = typeof updater === "function" ? updater(normalizeMongoUser(current)) : updater;
    const updated = await UserModel.findOneAndUpdate(
      { id: userId },
      { $set: { ...next, updatedAt: new Date() } },
      { new: true, lean: true }
    );
    return normalizeMongoUser(updated);
  }
  const users = await getAllUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;
  const next = typeof updater === "function" ? updater(users[index]) : updater;
  users[index] = {
    ...users[index],
    ...next,
    updatedAt: new Date().toISOString()
  };
  await saveAllUsers(users);
  return users[index];
}

async function deleteUser(userId) {
  if (isMongoReady()) {
    const { UserModel } = getMongoModels();
    const out = await UserModel.deleteOne({ id: userId });
    return out.deletedCount > 0;
  }
  const users = await getAllUsers();
  const next = users.filter((u) => u.id !== userId);
  if (next.length === users.length) return false;
  await saveAllUsers(next);
  return true;
}

module.exports = {
  getAllUsers,
  findByEmail,
  findByRoomBed,
  findById,
  createUser,
  updateUser,
  deleteUser
};

function normalizeMongoUser(doc) {
  if (!doc) return null;
  const asObj = { ...doc };
  if (asObj.meals instanceof Map) {
    asObj.meals = Object.fromEntries(asObj.meals);
  }
  asObj.adminMealOverride = normalizeMealOverride(asObj.adminMealOverride);
  asObj.phoneNumber = asObj.phoneNumber ? String(asObj.phoneNumber).trim() : '';
  delete asObj._id;
  delete asObj.__v;
  return asObj;
}










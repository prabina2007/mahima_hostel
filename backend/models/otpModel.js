const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { readJson, writeJson } = require("./store");
const { getMongoModels, isMongoReady } = require("./mongoClient");

const FILE = "otps.json";
const EXPIRY_MS = 10 * 60 * 1000;

async function getOtps() {
  return readJson(FILE);
}

async function saveOtps(otps) {
  return writeJson(FILE, otps);
}

async function createOtp(email, code) {
  if (isMongoReady()) {
    const { OtpModel } = getMongoModels();
    const targetEmail = String(email).trim().toLowerCase();
    await OtpModel.deleteMany({ email: targetEmail, used: false });
    const codeHash = await bcrypt.hash(code, 10);
    const doc = await OtpModel.create({
      id: uuidv4(),
      email: targetEmail,
      codeHash,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
      used: false,
      createdAt: new Date()
    });
    return normalizeMongoOtp(doc.toObject());
  }
  const otps = await getOtps();
  const codeHash = await bcrypt.hash(code, 10);
  const record = {
    id: uuidv4(),
    email: String(email).trim().toLowerCase(),
    codeHash,
    expiresAt: new Date(Date.now() + EXPIRY_MS).toISOString(),
    used: false,
    createdAt: new Date().toISOString()
  };
  const next = otps.filter((o) => o.email !== record.email || o.used);
  next.push(record);
  await saveOtps(next);
  return record;
}

async function consumeValidOtp(email, code) {
  const normalizedCode = String(code || "").trim();
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  if (isMongoReady()) {
    const { OtpModel } = getMongoModels();
    const targetEmail = String(email).trim().toLowerCase();
    const now = new Date();
    const candidates = await OtpModel.find({
      email: targetEmail,
      used: false,
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    for (const item of candidates) {
      const ok = await bcrypt.compare(normalizedCode, item.codeHash);
      if (!ok) continue;
      await OtpModel.updateOne({ id: item.id }, { $set: { used: true } });
      return true;
    }
    return false;
  }
  const targetEmail = String(email).trim().toLowerCase();
  const now = Date.now();
  const otps = await getOtps();

  let matchIndex = -1;
  for (let i = otps.length - 1; i >= 0; i -= 1) {
    const item = otps[i];
    if (item.email !== targetEmail || item.used) continue;
    if (new Date(item.expiresAt).getTime() < now) continue;
    const ok = await bcrypt.compare(normalizedCode, item.codeHash);
    if (ok) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) return false;
  otps[matchIndex].used = true;
  await saveOtps(otps);
  return true;
}

module.exports = {
  createOtp,
  consumeValidOtp
};

function normalizeMongoOtp(doc) {
  if (!doc) return null;
  const asObj = { ...doc };
  delete asObj._id;
  delete asObj.__v;
  return asObj;
}

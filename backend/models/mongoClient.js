const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

let mongoReady = false;
let UserModel;
let OtpModel;
let MealRateModel;
let RepresentativeLogModel;

function shouldUseMongo() {
  return String(process.env.USE_MONGODB || "false").toLowerCase() === "true" && !!process.env.MONGODB_URI;
}

function defineModels() {
  if (UserModel && OtpModel && MealRateModel && RepresentativeLogModel) return;

  const mealSchema = new mongoose.Schema(
    {
      enabled: { type: Boolean, default: true },
      type: { type: String, enum: ["veg", "non-veg"], default: "veg" },
      adminLocked: { type: Boolean, default: false }
    },
    { _id: false }
  );

  const mealOverrideSchema = new mongoose.Schema(
    {
      lunch: { type: String, enum: ["none", "force-on", "force-off"], default: "none" },
      dinner: { type: String, enum: ["none", "force-on", "force-off"], default: "none" }
    },
    { _id: false }
  );

  const userSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4, unique: true, index: true },
    studentName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    bed: { type: String, required: true, enum: ["A", "B"], uppercase: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    defaultPreference: { type: String, enum: ["veg", "non-veg"], default: "veg" },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    adminMealOverride: { type: mealOverrideSchema, default: () => ({}) },
    meals: {
      type: Map,
      of: new mongoose.Schema(
        { lunch: { type: mealSchema, default: () => ({}) }, dinner: { type: mealSchema, default: () => ({}) } },
        { _id: false }
      ),
      default: {}
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

  userSchema.index({ roomNumber: 1, bed: 1 }, { unique: true });

  const otpSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true }
  });

  const mealRateSchema = new mongoose.Schema({
    monthKey: { type: String, required: true, unique: true, index: true },
    rate: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

  const representativeLogSchema = new mongoose.Schema({
    dateKey: { type: String, required: true, unique: true, index: true },
    entries: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

  UserModel = mongoose.models.User || mongoose.model("User", userSchema);
  OtpModel = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
  MealRateModel = mongoose.models.MealRate || mongoose.model("MealRate", mealRateSchema);
  RepresentativeLogModel = mongoose.models.RepresentativeLog || mongoose.model("RepresentativeLog", representativeLogSchema);
}

async function connectMongo() {
  if (!shouldUseMongo()) return false;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    defineModels();
    mongoReady = true;
    console.log("MongoDB connected.");
    return true;
  } catch (error) {
    mongoReady = false;
    console.warn(`MongoDB unavailable, falling back to JSON storage. Reason: ${error.message}`);
    return false;
  }
}

function isMongoReady() {
  return mongoReady;
}

function getMongoModels() {
  if (!mongoReady) return null;
  defineModels();
  return { UserModel, OtpModel, MealRateModel, RepresentativeLogModel };
}

module.exports = {
  connectMongo,
  isMongoReady,
  getMongoModels,
  shouldUseMongo
};




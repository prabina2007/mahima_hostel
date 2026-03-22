const { readJson, writeJson } = require("./store");
const { isMongoReady, getMongoModels } = require("./mongoClient");

const FILE_NAME = "mealRates.json";

function normalizeMonthKey(monthKey) {
  return /^\d{4}-\d{2}$/.test(String(monthKey || "")) ? String(monthKey) : null;
}

async function getMealRate(monthKey) {
  const normalized = normalizeMonthKey(monthKey);
  if (!normalized) return null;

  if (isMongoReady()) {
    const { MealRateModel } = getMongoModels();
    const doc = await MealRateModel.findOne({ monthKey: normalized }).lean();
    return doc ? Number(doc.rate || 0) : null;
  }

  const rows = await readJson(FILE_NAME);
  const row = rows.find((item) => item.monthKey === normalized);
  return row ? Number(row.rate || 0) : null;
}

async function getRatesByMonths(monthKeys) {
  const keys = [...new Set((Array.isArray(monthKeys) ? monthKeys : []).map(normalizeMonthKey).filter(Boolean))];
  if (!keys.length) return {};

  if (isMongoReady()) {
    const { MealRateModel } = getMongoModels();
    const docs = await MealRateModel.find({ monthKey: { $in: keys } }).lean();
    return docs.reduce((acc, doc) => {
      acc[doc.monthKey] = Number(doc.rate || 0);
      return acc;
    }, {});
  }

  const rows = await readJson(FILE_NAME);
  return rows.reduce((acc, row) => {
    if (keys.includes(row.monthKey)) acc[row.monthKey] = Number(row.rate || 0);
    return acc;
  }, {});
}

async function setMealRate(monthKey, rate) {
  const normalized = normalizeMonthKey(monthKey);
  const nextRate = Number(rate);
  if (!normalized || Number.isNaN(nextRate) || nextRate < 0) {
    throw new Error("Invalid month or rate");
  }

  if (isMongoReady()) {
    const { MealRateModel } = getMongoModels();
    await MealRateModel.findOneAndUpdate(
      { monthKey: normalized },
      { monthKey: normalized, rate: nextRate, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { monthKey: normalized, rate: nextRate };
  }

  const rows = await readJson(FILE_NAME);
  const index = rows.findIndex((item) => item.monthKey === normalized);
  const payload = { monthKey: normalized, rate: nextRate };
  if (index >= 0) rows[index] = payload;
  else rows.push(payload);
  await writeJson(FILE_NAME, rows);
  return payload;
}

async function listMealRates() {
  if (isMongoReady()) {
    const { MealRateModel } = getMongoModels();
    const docs = await MealRateModel.find({}).sort({ monthKey: -1 }).lean();
    return docs.map((doc) => ({ monthKey: doc.monthKey, rate: Number(doc.rate || 0) }));
  }

  const rows = await readJson(FILE_NAME);
  return rows
    .map((row) => ({ monthKey: row.monthKey, rate: Number(row.rate || 0) }))
    .sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
}

async function resetMealRate(monthKey) {
  const normalized = normalizeMonthKey(monthKey);
  if (!normalized) {
    throw new Error("Invalid month");
  }

  if (isMongoReady()) {
    const { MealRateModel } = getMongoModels();
    const deleted = await MealRateModel.findOneAndDelete({ monthKey: normalized }).lean();
    return !!deleted;
  }

  const rows = await readJson(FILE_NAME);
  const nextRows = rows.filter((item) => item.monthKey !== normalized);
  if (nextRows.length === rows.length) return false;
  await writeJson(FILE_NAME, nextRows);
  return true;
}

module.exports = {
  getMealRate,
  getRatesByMonths,
  setMealRate,
  listMealRates,
  resetMealRate
};



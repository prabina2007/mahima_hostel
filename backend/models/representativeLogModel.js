const { readJson, writeJson } = require('./store');
const { isMongoReady, getMongoModels } = require('./mongoClient');

const FILE_NAME = 'representativeLogs.json';

function normalizeDateKey(dateKey) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')) ? String(dateKey) : null;
}

function normalizeMealName(meal) {
  const value = String(meal || '').trim().toLowerCase();
  return value === 'dinner' ? 'dinner' : value === 'lunch' ? 'lunch' : null;
}

function normalizeEntry(entry = {}) {
  return {
    lunchTaken: entry.lunchTaken === true,
    dinnerTaken: entry.dinnerTaken === true,
    lunchTakenAt: entry.lunchTakenAt || null,
    dinnerTakenAt: entry.dinnerTakenAt || null,
    updatedAt: entry.updatedAt || null
  };
}

async function getDayLog(dateKey) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  if (!normalizedDateKey) return {};

  if (isMongoReady()) {
    const { RepresentativeLogModel } = getMongoModels();
    const doc = await RepresentativeLogModel.findOne({ dateKey: normalizedDateKey }).lean();
    return doc && doc.entries ? doc.entries : {};
  }

  const rows = await readJson(FILE_NAME);
  const row = rows.find((item) => item.dateKey === normalizedDateKey);
  return row && row.entries ? row.entries : {};
}

async function setMealTaken(dateKey, studentId, meal, taken) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  const normalizedMeal = normalizeMealName(meal);
  if (!normalizedDateKey || !studentId || !normalizedMeal) {
    throw new Error('Invalid date, student, or meal');
  }

  const flagKey = normalizedMeal === 'lunch' ? 'lunchTaken' : 'dinnerTaken';
  const timeKey = normalizedMeal === 'lunch' ? 'lunchTakenAt' : 'dinnerTakenAt';
  const timestamp = taken ? new Date().toISOString() : null;

  if (isMongoReady()) {
    const { RepresentativeLogModel } = getMongoModels();
    const current = await RepresentativeLogModel.findOne({ dateKey: normalizedDateKey }).lean();
    const entries = { ...(current?.entries || {}) };
    const existingEntry = normalizeEntry(entries[studentId]);
    entries[studentId] = {
      ...existingEntry,
      [flagKey]: taken === true,
      [timeKey]: timestamp,
      updatedAt: new Date().toISOString()
    };

    await RepresentativeLogModel.findOneAndUpdate(
      { dateKey: normalizedDateKey },
      { dateKey: normalizedDateKey, entries, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return normalizeEntry(entries[studentId]);
  }

  const rows = await readJson(FILE_NAME);
  const index = rows.findIndex((item) => item.dateKey === normalizedDateKey);
  const row = index >= 0 ? rows[index] : { dateKey: normalizedDateKey, entries: {} };
  const entries = { ...(row.entries || {}) };
  const existingEntry = normalizeEntry(entries[studentId]);
  entries[studentId] = {
    ...existingEntry,
    [flagKey]: taken === true,
    [timeKey]: timestamp,
    updatedAt: new Date().toISOString()
  };

  const payload = { dateKey: normalizedDateKey, entries, updatedAt: new Date().toISOString() };
  if (index >= 0) rows[index] = payload;
  else rows.push(payload);
  await writeJson(FILE_NAME, rows);
  return normalizeEntry(entries[studentId]);
}

module.exports = {
  getDayLog,
  setMealTaken,
  normalizeEntry
};

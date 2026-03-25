function pad(v) {
  return String(v).padStart(2, "0");
}

function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isMealUpdateAllowed(dateKey, mealType) {
  const today = toDateKey(new Date());
  if (dateKey < today) return false;
  if (dateKey > today) return true;

  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(mealType === "lunch" ? 8 : 15, 0, 0, 0);
  return now < cutoff;
}

function isAdminReportAllowed(dateKey, mealType) {
  const today = toDateKey(new Date());
  if (dateKey < today) return true;
  if (dateKey > today) return false;

  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(mealType === "lunch" ? 8 : 15, 0, 0, 0);
  return now >= cutoff;
}

function getMonthDays(year, month) {
  return new Date(year, month, 0).getDate();
}

module.exports = {
  toDateKey,
  parseDateKey,
  isMealUpdateAllowed,
  isAdminReportAllowed,
  getMonthDays
};

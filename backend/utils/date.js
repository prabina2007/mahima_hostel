const APP_TIMEZONE = "Asia/Kolkata";

function pad(v) {
  return String(v).padStart(2, "0");
}

function getZonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function toDateKey(date = new Date()) {
  const parts = getZonedParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function parseDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getCurrentMinutesInTimezone(date = new Date()) {
  const parts = getZonedParts(date);
  return parts.hour * 60 + parts.minute;
}

function isMealUpdateAllowed(dateKey, mealType) {
  const today = toDateKey(new Date());
  if (dateKey < today) return false;
  if (dateKey > today) return true;

  const nowMinutes = getCurrentMinutesInTimezone(new Date());
  const cutoffMinutes = mealType === "lunch" ? 8 * 60 : 15 * 60;
  return nowMinutes < cutoffMinutes;
}

function isAdminReportAllowed(dateKey, mealType) {
  const today = toDateKey(new Date());
  if (dateKey < today) return true;
  if (dateKey > today) return false;

  const nowMinutes = getCurrentMinutesInTimezone(new Date());
  const cutoffMinutes = mealType === "lunch" ? 8 * 60 : 15 * 60;
  return nowMinutes >= cutoffMinutes;
}

function getMonthDays(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

module.exports = {
  toDateKey,
  parseDateKey,
  isMealUpdateAllowed,
  isAdminReportAllowed,
  getMonthDays,
  getZonedParts
};

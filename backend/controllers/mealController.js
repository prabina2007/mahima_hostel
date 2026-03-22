const userModel = require("../models/userModel");
const mealRateModel = require("../models/mealRateModel");
const { getMonthDays, isMealUpdateAllowed, parseDateKey, toDateKey } = require("../utils/date");

function defaultMeal(pref) {
  const type = pref === "non-veg" ? "non-veg" : "veg";
  return {
    lunch: { enabled: true, type, adminLocked: false },
    dinner: { enabled: true, type, adminLocked: false }
  };
}

function normalizeDayMeal(dayMeal, pref) {
  const fallback = defaultMeal(pref);
  return {
    lunch: {
      enabled: typeof dayMeal?.lunch?.enabled === "boolean" ? dayMeal.lunch.enabled : fallback.lunch.enabled,
      type: dayMeal?.lunch?.type === "non-veg" ? "non-veg" : fallback.lunch.type,
      adminLocked: dayMeal?.lunch?.adminLocked === true
    },
    dinner: {
      enabled: typeof dayMeal?.dinner?.enabled === "boolean" ? dayMeal.dinner.enabled : fallback.dinner.enabled,
      type: dayMeal?.dinner?.type === "non-veg" ? "non-veg" : fallback.dinner.type,
      adminLocked: dayMeal?.dinner?.adminLocked === true
    }
  };
}

function applyMealOverride(dayMeal, mealOverride = {}) {
  const nextDay = {
    lunch: { ...dayMeal.lunch },
    dinner: { ...dayMeal.dinner }
  };

  if (mealOverride.lunch === "force-off") nextDay.lunch.enabled = false;
  if (mealOverride.dinner === "force-off") nextDay.dinner.enabled = false;

  return nextDay;
}

function getMealStartKey(user) {
  const approvalStatus = user.approvalStatus || "approved";
  if (approvalStatus !== "approved") return null;

  const effectiveDate = user.approvedAt || user.createdAt;
  const parsed = effectiveDate ? new Date(effectiveDate) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function getInactiveDay(pref) {
  const type = pref === "non-veg" ? "non-veg" : "veg";
  return {
    lunch: { enabled: false, type, adminLocked: true },
    dinner: { enabled: false, type, adminLocked: true }
  };
}

function getDayMeal(user, dateKey) {
  const mealStartKey = getMealStartKey(user);
  if (!mealStartKey || dateKey < mealStartKey) {
    return getInactiveDay(user.defaultPreference);
  }

  const storedDay = normalizeDayMeal(
    user.meals && user.meals[dateKey] ? user.meals[dateKey] : defaultMeal(user.defaultPreference),
    user.defaultPreference
  );
  return applyMealOverride(storedDay, user.adminMealOverride);
}

function getAdminOverrideValue(user, mealType) {
  const value = user.adminMealOverride && user.adminMealOverride[mealType];
  return value === "force-off" ? "force-off" : "none";
}

function canStudentEditMeal(user, dateKey, mealType, meal) {
  const mealStartKey = getMealStartKey(user);
  if (!mealStartKey || dateKey < mealStartKey) return false;
  if (!isMealUpdateAllowed(dateKey, mealType)) return false;
  if (meal?.adminLocked) return false;
  if (getAdminOverrideValue(user, mealType) === "force-off") return false;
  return true;
}

async function computeBillTillDate(user, toKey) {
  const mealStartKey = getMealStartKey(user);
  if (!mealStartKey || mealStartKey > toKey) {
    return { totalBill: 0, currentMonthRate: 0, breakdown: [] };
  }

  let cursor = parseDateKey(mealStartKey);
  const end = parseDateKey(toKey);
  const monthMealCounts = {};

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const day = getDayMeal(user, key);
    const monthKey = key.slice(0, 7);
    let count = 0;

    if (day.lunch?.enabled) count += 1;
    if (day.dinner?.enabled) count += 1;

    monthMealCounts[monthKey] = (monthMealCounts[monthKey] || 0) + count;
    cursor.setDate(cursor.getDate() + 1);
  }

  const monthKeys = Object.keys(monthMealCounts).sort();
  const rates = await mealRateModel.getRatesByMonths(monthKeys);
  const breakdown = monthKeys.map((monthKey) => {
    const meals = Number(monthMealCounts[monthKey] || 0);
    const rate = Number(rates[monthKey] || 0);
    return {
      monthKey,
      meals,
      rate,
      bill: meals * rate
    };
  });
  const totalBill = breakdown.reduce((sum, item) => sum + item.bill, 0);
  const currentMonthRate = Number(rates[toKey.slice(0, 7)] || 0);

  return { totalBill, currentMonthRate, breakdown };
}

function computeStatsTillDate(user, toKey) {
  const mealStartKey = getMealStartKey(user);
  if (!mealStartKey || mealStartKey > toKey) return { totalMeals: 0, vegMeals: 0, nonVegMeals: 0 };

  let cursor = parseDateKey(mealStartKey);
  const end = parseDateKey(toKey);
  let totalMeals = 0;
  let vegMeals = 0;
  let nonVegMeals = 0;

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const day = getDayMeal(user, key);
    ["lunch", "dinner"].forEach((mealType) => {
      const meal = day[mealType];
      if (meal && meal.enabled) {
        totalMeals += 1;
        if (meal.type === "non-veg") nonVegMeals += 1;
        else vegMeals += 1;
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { totalMeals, vegMeals, nonVegMeals };
}

async function getMonth(req, res) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid year or month" });
    }

    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const mealStartKey = getMealStartKey(user);
    const days = getMonthDays(year, month);
    const result = [];
    for (let d = 1; d <= days; d += 1) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!mealStartKey || dateKey < mealStartKey) {
        result.push({
          date: dateKey,
          lunch: { enabled: false, type: user.defaultPreference, adminLocked: true },
          dinner: { enabled: false, type: user.defaultPreference, adminLocked: true },
          count: 0,
          locked: true,
          canToggleLunch: false,
          canToggleDinner: false
        });
        continue;
      }

      const day = getDayMeal(user, dateKey);
      const count = Number(day.lunch.enabled) + Number(day.dinner.enabled);
      result.push({
        date: dateKey,
        lunch: day.lunch,
        dinner: day.dinner,
        count,
        canToggleLunch:
          isMealUpdateAllowed(dateKey, "lunch") && !day.lunch.adminLocked && getAdminOverrideValue(user, "lunch") !== "force-off",
        canToggleDinner:
          isMealUpdateAllowed(dateKey, "dinner") && !day.dinner.adminLocked && getAdminOverrideValue(user, "dinner") !== "force-off"
      });
    }

    return res.json({ meals: result });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load month meals", error: error.message });
  }
}

async function updateDay(req, res) {
  try {
    const dateKey = req.params.date;
    if (!parseDateKey(dateKey)) return res.status(400).json({ message: "Invalid date format" });

    const updates = req.body || {};
    const validTypes = ["veg", "non-veg"];

    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const nextDay = { ...getDayMeal(user, dateKey) };

    const touchingLunch =
      typeof updates.lunchEnabled === "boolean" || typeof updates.lunchType === "string";
    const touchingDinner =
      typeof updates.dinnerEnabled === "boolean" || typeof updates.dinnerType === "string";

    if (touchingLunch && !isMealUpdateAllowed(dateKey, "lunch")) {
      return res.status(400).json({ message: "Lunch update time has passed for this date" });
    }
    if (touchingDinner && !isMealUpdateAllowed(dateKey, "dinner")) {
      return res.status(400).json({ message: "Dinner update time has passed for this date" });
    }
    if (touchingLunch && (nextDay.lunch.adminLocked || getAdminOverrideValue(user, "lunch") === "force-off")) {
      return res.status(400).json({ message: "Lunch is locked by admin and cannot be changed" });
    }
    if (touchingDinner && (nextDay.dinner.adminLocked || getAdminOverrideValue(user, "dinner") === "force-off")) {
      return res.status(400).json({ message: "Dinner is locked by admin and cannot be changed" });
    }

    if (typeof updates.lunchEnabled === "boolean") nextDay.lunch.enabled = updates.lunchEnabled;
    if (typeof updates.dinnerEnabled === "boolean") nextDay.dinner.enabled = updates.dinnerEnabled;
    if (typeof updates.lunchType === "string") {
      if (!validTypes.includes(updates.lunchType)) return res.status(400).json({ message: "Invalid lunch type" });
      nextDay.lunch.type = updates.lunchType;
    }
    if (typeof updates.dinnerType === "string") {
      if (!validTypes.includes(updates.dinnerType)) return res.status(400).json({ message: "Invalid dinner type" });
      nextDay.dinner.type = updates.dinnerType;
    }

    const updated = await userModel.updateUser(user.id, (current) => ({
      meals: { ...(current.meals || {}), [dateKey]: nextDay }
    }));

    return res.json({
      message: "Meal updated successfully",
      day: updated.meals[dateKey]
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update meal", error: error.message });
  }
}

async function updateMonthPreference(req, res) {
  try {
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    const preference = String(req.body.preference || "").trim().toLowerCase();

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid year or month" });
    }

    if (!["veg", "non-veg"].includes(preference)) {
      return res.status(400).json({ message: "Preference must be veg or non-veg" });
    }

    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const mealStartKey = getMealStartKey(user);
    const totalDays = getMonthDays(year, month);
    const nextMeals = { ...(user.meals || {}) };
    let updatedDays = 0;
    let updatedMeals = 0;

    for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      if (!mealStartKey || dateKey < mealStartKey) continue;

      const currentDay = {
        lunch: { ...getDayMeal(user, dateKey).lunch },
        dinner: { ...getDayMeal(user, dateKey).dinner }
      };

      let dayChanged = false;

      if (canStudentEditMeal(user, dateKey, "lunch", currentDay.lunch) && currentDay.lunch.type !== preference) {
        currentDay.lunch.type = preference;
        updatedMeals += 1;
        dayChanged = true;
      }

      if (canStudentEditMeal(user, dateKey, "dinner", currentDay.dinner) && currentDay.dinner.type !== preference) {
        currentDay.dinner.type = preference;
        updatedMeals += 1;
        dayChanged = true;
      }

      if (dayChanged) {
        nextMeals[dateKey] = currentDay;
        updatedDays += 1;
      }
    }

    const updated = await userModel.updateUser(user.id, { meals: nextMeals });

    return res.json({
      message: `Applied ${preference} preference to the selected month`,
      updatedDays,
      updatedMeals,
      meals: updated.meals
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update month preference", error: error.message });
  }
}

async function updateDefaultPreference(req, res) {
  try {
    const preference = String(req.body.preference || "").trim().toLowerCase();
    if (!["veg", "non-veg"].includes(preference)) {
      return res.status(400).json({ message: "Preference must be veg or non-veg" });
    }

    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const mealStartKey = getMealStartKey(user);
    if (!mealStartKey) {
      return res.status(400).json({ message: "Default preference cannot be updated before admin approval" });
    }

    const todayKey = toDateKey(new Date());
    const nextMeals = { ...(user.meals || {}) };
    const candidateDates = Object.keys(nextMeals).filter((dateKey) => dateKey >= todayKey);
    let updatedDates = 0;
    let updatedMeals = 0;

    candidateDates.forEach((dateKey) => {
      if (dateKey < mealStartKey) return;

      const currentDay = getDayMeal(user, dateKey);
      const nextDay = {
        lunch: { ...currentDay.lunch },
        dinner: { ...currentDay.dinner }
      };
      let touchedDay = false;

      if (canStudentEditMeal(user, dateKey, "lunch", currentDay.lunch) && nextDay.lunch.type !== preference) {
        nextDay.lunch.type = preference;
        updatedMeals += 1;
        touchedDay = true;
      }

      if (canStudentEditMeal(user, dateKey, "dinner", currentDay.dinner) && nextDay.dinner.type !== preference) {
        nextDay.dinner.type = preference;
        updatedMeals += 1;
        touchedDay = true;
      }

      if (touchedDay) {
        nextMeals[dateKey] = nextDay;
        updatedDates += 1;
      }
    });

    const updated = await userModel.updateUser(user.id, {
      defaultPreference: preference,
      meals: nextMeals
    });

    return res.json({
      message: `Default meal preference updated to ${preference} for upcoming editable meals`,
      defaultPreference: updated.defaultPreference,
      updatedDays: updatedDates,
      updatedMeals
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update default preference", error: error.message });
  }
}

async function stats(req, res) {
  try {
    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const today = toDateKey(new Date());
    const summary = computeStatsTillDate(user, today);
    const billing = await computeBillTillDate(user, today);
    return res.json({
      ...summary,
      totalBill: billing.totalBill,
      currentMonthRate: billing.currentMonthRate,
      billBreakdown: billing.breakdown
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
}

module.exports = {
  getMonth,
  updateDay,
  updateMonthPreference,
  updateDefaultPreference,
  stats,
  computeStatsTillDate,
  getDayMeal,
  getMealStartKey
};











const PDFDocument = require("pdfkit");
const userModel = require("../models/userModel");
const mealRateModel = require("../models/mealRateModel");
const { computeStatsTillDate, getDayMeal, getMealStartKey } = require("./mealController");
const { getMonthDays, isAdminReportAllowed, parseDateKey, toDateKey } = require("../utils/date");

function sanitizeUser(user) {
  const approvalStatus = user.approvalStatus || "approved";
  return {
    id: user.id,
    studentName: user.studentName,
    email: user.email,
    phoneNumber: user.phoneNumber ? String(user.phoneNumber).trim() : "",
    roomNumber: user.roomNumber,
    bed: user.bed,
    rollNumber: user.rollNumber,
    defaultPreference: user.defaultPreference,
    adminMealOverride: user.adminMealOverride || { lunch: "none", dinner: "none" },
    approvalStatus,
    approvedAt: user.approvedAt || null,
    rejectedAt: user.rejectedAt || null,
    createdAt: user.createdAt
  };
}

function compareRoomBed(a, b) {
  const roomA = Number.parseInt(a.roomNumber, 10);
  const roomB = Number.parseInt(b.roomNumber, 10);
  const normalizedRoomA = Number.isNaN(roomA) ? String(a.roomNumber) : roomA;
  const normalizedRoomB = Number.isNaN(roomB) ? String(b.roomNumber) : roomB;

  if (normalizedRoomA < normalizedRoomB) return -1;
  if (normalizedRoomA > normalizedRoomB) return 1;

  const bedA = String(a.bed || "").toUpperCase();
  const bedB = String(b.bed || "").toUpperCase();
  if (bedA < bedB) return -1;
  if (bedA > bedB) return 1;

  return String(a.studentName || "").localeCompare(String(b.studentName || ""), "en", { sensitivity: "base" });
}

function isApprovedStudent(user) {
  return (user.approvalStatus || "approved") === "approved";
}

function computeStatsTillMeal(user, toKey, mealType) {
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
    const mealOrder = key === toKey ? ["lunch", "dinner"].filter((item) => item === "lunch" || mealType === "dinner") : ["lunch", "dinner"];

    mealOrder.forEach((currentMealType) => {
      const meal = day[currentMealType];
      if (!meal || !meal.enabled) return;
      totalMeals += 1;
      if (meal.type === "non-veg") nonVegMeals += 1;
      else vegMeals += 1;
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return { totalMeals, vegMeals, nonVegMeals };
}

function createDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function enumerateMonth(year, month) {
  const totalDays = getMonthDays(year, month);
  return Array.from({ length: totalDays }, (_, index) => createDateKey(year, month, index + 1));
}

function enumerateDateRange(fromDate, toDate) {
  const start = parseDateKey(fromDate);
  const end = parseDateKey(toDate);
  if (!start || !end || start > end) return null;

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parseMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

function getCurrentMonthKey() {
  return toDateKey(new Date()).slice(0, 7);
}

async function getMealRate(req, res) {
  try {
    const monthKey = String(req.query.month || getCurrentMonthKey()).trim();
    if (!parseMonthKey(monthKey)) {
      return res.status(400).json({ message: "Month must be YYYY-MM" });
    }

    const rate = await mealRateModel.getMealRate(monthKey);
    return res.json({ monthKey, rate: Number(rate || 0) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load meal rate", error: error.message });
  }
}

async function setMealRate(req, res) {
  try {
    const monthKey = String(req.body.month || "").trim();
    const rate = Number(req.body.rate);
    if (!parseMonthKey(monthKey)) {
      return res.status(400).json({ message: "Month must be YYYY-MM" });
    }
    if (Number.isNaN(rate) || rate < 0) {
      return res.status(400).json({ message: "Rate must be a valid non-negative number" });
    }

    const saved = await mealRateModel.setMealRate(monthKey, rate);
    return res.json({ message: "Meal rate updated successfully", monthKey: saved.monthKey, rate: saved.rate });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save meal rate", error: error.message });
  }
}

async function listMealRates(req, res) {
  try {
    const rates = await mealRateModel.listMealRates();
    return res.json({ rates });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load meal rates", error: error.message });
  }
}

async function resetMealRate(req, res) {
  try {
    const monthKey = String(req.params.month || "").trim();
    if (!parseMonthKey(monthKey)) {
      return res.status(400).json({ message: "Month must be YYYY-MM" });
    }

    const removed = await mealRateModel.resetMealRate(monthKey);
    if (!removed) {
      return res.status(404).json({ message: "Meal rate not found for the selected month" });
    }

    return res.json({ message: "Meal rate reset successfully", monthKey });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset meal rate", error: error.message });
  }
}

function enumerateMonthRange(fromMonth, toMonth) {
  const start = parseMonthKey(fromMonth);
  const end = parseMonthKey(toMonth);
  if (!start || !end) return null;

  const startCursor = new Date(start.year, start.month - 1, 1);
  const endCursor = new Date(end.year, end.month - 1, 1);
  if (startCursor > endCursor) return null;

  const dates = [];
  const cursor = new Date(startCursor);
  while (cursor <= endCursor) {
    dates.push(...enumerateMonth(cursor.getFullYear(), cursor.getMonth() + 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

function resolveTargetDates(body) {
  const mode = String(body.scopeMode || "").trim().toLowerCase();

  if (mode === "day") {
    return parseDateKey(body.date) ? [body.date] : null;
  }

  if (mode === "month") {
    const parsed = parseMonthKey(body.month);
    return parsed ? enumerateMonth(parsed.year, parsed.month) : null;
  }

  if (mode === "month_range") {
    return enumerateMonthRange(body.fromMonth, body.toMonth);
  }

  if (mode === "date_range") {
    return enumerateDateRange(body.fromDate, body.toDate);
  }

  if (mode === "selected_days") {
    const dates = Array.isArray(body.dates) ? body.dates.filter((date) => parseDateKey(date)) : [];
    return dates.length ? [...new Set(dates)].sort() : null;
  }

  return null;
}

async function listStudents(req, res) {
  try {
    const search = String(req.query.search || "").trim().toLowerCase();
    const users = await userModel.getAllUsers();
    const todayDate = new Date();
    const todayKey = toDateKey(todayDate);
    const completedThroughDate = new Date(todayDate);
    completedThroughDate.setDate(completedThroughDate.getDate() - 1);
    const completedThroughKey = toDateKey(completedThroughDate);
    const filtered = !search
      ? users
      : users.filter((u) => {
          const roomBed = `${u.roomNumber}${u.bed}`.toLowerCase();
          return (
            u.studentName.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search) ||
            String(u.phoneNumber || "").toLowerCase().includes(search) ||
            u.rollNumber.toLowerCase().includes(search) ||
            roomBed.includes(search)
          );
        });
    return res.json({
      students: filtered.sort(compareRoomBed).map((user) => {
        const completedStats = computeStatsTillDate(user, completedThroughKey);
        const mealStartKey = getMealStartKey(user);
        const todayMeal = mealStartKey && todayKey >= mealStartKey ? getDayMeal(user, todayKey) : null;
        const todayPlannedMeals = todayMeal ? Number(todayMeal.lunch.enabled) + Number(todayMeal.dinner.enabled) : 0;

        return {
          ...sanitizeUser(user),
          totalMeals: completedStats.totalMeals,
          vegMeals: completedStats.vegMeals,
          nonVegMeals: completedStats.nonVegMeals,
          completedMeals: completedStats.totalMeals,
          todayPlannedMeals
        };
      })
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch students", error: error.message });
  }
}

async function removeStudent(req, res) {
  try {
    const ok = await userModel.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ message: "Student not found" });
    return res.json({ message: "Student deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete student", error: error.message });
  }
}

async function approveStudent(req, res) {
  try {
    const current = await userModel.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Student not found" });

    const updated = await userModel.updateUser(req.params.id, {
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      rejectedAt: null
    });
    return res.json({ message: "Student approved successfully", student: sanitizeUser(updated) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to approve student", error: error.message });
  }
}

async function rejectStudent(req, res) {
  try {
    const current = await userModel.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Student not found" });

    await userModel.deleteUser(req.params.id);
    return res.json({ message: "Student rejected and deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reject student", error: error.message });
  }
}

async function bulkMealUpdate(req, res) {
  try {
    const targetMode = String(req.body.targetMode || "").trim().toLowerCase();
    const mealScope = String(req.body.mealScope || "both").trim().toLowerCase();
    const action = String(req.body.action || "off").trim().toLowerCase();
    const isPermanentAction = action === "permanent_on" || action === "permanent_off";

    if (!["all", "single", "selected"].includes(targetMode)) {
      return res.status(400).json({ message: "Invalid target mode" });
    }

    if (!["lunch", "dinner", "both"].includes(mealScope)) {
      return res.status(400).json({ message: "Meal scope must be lunch, dinner or both" });
    }

    if (!["on", "off", "permanent_on", "permanent_off"].includes(action)) {
      return res.status(400).json({ message: "Action must be on, off, permanent_on or permanent_off" });
    }

    const users = await userModel.getAllUsers();
    let targetUsers = [];

    if (targetMode === "all") {
      targetUsers = users.filter(isApprovedStudent);
    } else if (targetMode === "single") {
      const user = await userModel.findById(req.body.userId);
      if (!user) return res.status(404).json({ message: "Student not found" });
      if (!isApprovedStudent(user)) return res.status(400).json({ message: "Selected student is not approved yet" });
      targetUsers = [user];
    } else {
      const ids = Array.isArray(req.body.userIds) ? req.body.userIds : [];
      targetUsers = users.filter((user) => ids.includes(user.id) && isApprovedStudent(user));
    }

    if (!targetUsers.length) {
      return res.status(400).json({ message: "No approved students selected for meal control" });
    }

    let updatedStudents = 0;
    let updatedDates = 0;
    let updatedMeals = 0;
    const enableValue = action === "on";

    if (isPermanentAction) {
      const overrideValue = action === "permanent_off" ? "force-off" : "none";

      for (const user of targetUsers) {
        const currentOverride = user.adminMealOverride || { lunch: "none", dinner: "none" };
        const nextOverride = {
          lunch: currentOverride.lunch || "none",
          dinner: currentOverride.dinner || "none"
        };
        let touchedStudent = false;

        if ((mealScope === "lunch" || mealScope === "both") && nextOverride.lunch !== overrideValue) {
          nextOverride.lunch = overrideValue;
          updatedMeals += 1;
          touchedStudent = true;
        }

        if ((mealScope === "dinner" || mealScope === "both") && nextOverride.dinner !== overrideValue) {
          nextOverride.dinner = overrideValue;
          updatedMeals += 1;
          touchedStudent = true;
        }

        let nextMeals = { ...(user.meals || {}) };
        let touchedStoredMeals = false;

        if (action === "permanent_on") {
          Object.keys(nextMeals).forEach((dateKey) => {
            const currentDay = getDayMeal(user, dateKey);
            const patchedDay = {
              lunch: { ...currentDay.lunch },
              dinner: { ...currentDay.dinner }
            };
            let touchedDay = false;

            if (mealScope === "lunch" || mealScope === "both") {
              if (!patchedDay.lunch.enabled || patchedDay.lunch.adminLocked) {
                patchedDay.lunch.enabled = true;
                patchedDay.lunch.adminLocked = false;
                touchedDay = true;
              }
            }

            if (mealScope === "dinner" || mealScope === "both") {
              if (!patchedDay.dinner.enabled || patchedDay.dinner.adminLocked) {
                patchedDay.dinner.enabled = true;
                patchedDay.dinner.adminLocked = false;
                touchedDay = true;
              }
            }

            if (touchedDay) {
              nextMeals[dateKey] = patchedDay;
              touchedStoredMeals = true;
            }
          });
        }

        if (touchedStudent || touchedStoredMeals) {
          await userModel.updateUser(user.id, {
            ...(touchedStudent ? { adminMealOverride: nextOverride } : {}),
            ...(touchedStoredMeals ? { meals: nextMeals } : {})
          });
          updatedStudents += 1;
        }
      }

      return res.json({
        message: "Permanent meal control applied successfully",
        targetMode,
        mealScope,
        action,
        updatedStudents,
        updatedDates,
        updatedMeals
      });
    }

    const dates = resolveTargetDates(req.body);
    if (!dates || !dates.length) {
      return res.status(400).json({ message: "Invalid date selection" });
    }

    for (const user of targetUsers) {
      const mealStartKey = getMealStartKey(user);
      const nextMeals = { ...(user.meals || {}) };
      let touchedStudent = false;

      dates.forEach((dateKey) => {
        if (!mealStartKey || dateKey < mealStartKey) return;

        const currentDay = getDayMeal(user, dateKey);
        const nextDay = {
          lunch: { ...currentDay.lunch },
          dinner: { ...currentDay.dinner }
        };
        let touchedDay = false;

        if ((mealScope === "lunch" || mealScope === "both") && nextDay.lunch.enabled !== enableValue) {
          nextDay.lunch.enabled = enableValue;
          nextDay.lunch.adminLocked = !enableValue;
          touchedDay = true;
          updatedMeals += 1;
        } else if ((mealScope === "lunch" || mealScope === "both") && nextDay.lunch.adminLocked !== !enableValue) {
          nextDay.lunch.adminLocked = !enableValue;
          touchedDay = true;
        }

        if ((mealScope === "dinner" || mealScope === "both") && nextDay.dinner.enabled !== enableValue) {
          nextDay.dinner.enabled = enableValue;
          nextDay.dinner.adminLocked = !enableValue;
          touchedDay = true;
          updatedMeals += 1;
        } else if ((mealScope === "dinner" || mealScope === "both") && nextDay.dinner.adminLocked !== !enableValue) {
          nextDay.dinner.adminLocked = !enableValue;
          touchedDay = true;
        }

        if (touchedDay) {
          nextMeals[dateKey] = nextDay;
          updatedDates += 1;
          touchedStudent = true;
        }
      });

      if (touchedStudent) {
        await userModel.updateUser(user.id, { meals: nextMeals });
        updatedStudents += 1;
      }
    }

    return res.json({
      message: `Meal control applied successfully`,
      targetMode,
      mealScope,
      action,
      updatedStudents,
      updatedDates,
      updatedMeals
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to apply meal control", error: error.message });
  }
}

async function dailyReport(req, res) {
  try {
    const meal = String(req.query.meal || "").toLowerCase();
    const date = String(req.query.date || toDateKey(new Date()));
    if (!["lunch", "dinner"].includes(meal)) {
      return res.status(400).json({ message: "Meal must be lunch or dinner" });
    }
    if (!parseDateKey(date)) {
      return res.status(400).json({ message: "Date must be YYYY-MM-DD" });
    }
    if (!isAdminReportAllowed(date, meal)) {
      return res.status(400).json({
        message:
          meal === "lunch"
            ? "Lunch report is available after 08:00 AM for current day"
            : "Dinner report is available after 02:00 PM for current day"
      });
    }

    const users = (await userModel.getAllUsers()).filter(isApprovedStudent);
    const rows = users.sort(compareRoomBed).map((u) => {
      const day = getDayMeal(u, date);
      const summary = computeStatsTillMeal(u, date, meal);
      return {
        roomBed: `${u.roomNumber}-${u.bed}`,
        studentName: u.studentName,
        status: day[meal].enabled ? "ON" : "OFF",
        preference: day[meal].type === "non-veg" ? "Non-Veg" : "Veg",
        totalMeals: summary.totalMeals,
        tillVegMeals: summary.vegMeals,
        tillNonVegMeals: summary.nonVegMeals
      };
    });

    const dayTotals = rows.reduce(
      (acc, row) => {
        if (row.status === "ON") {
          acc.totalMeals += 1;
          if (row.preference === "Non-Veg") acc.nonVegMeals += 1;
          else acc.vegMeals += 1;
        }
        return acc;
      },
      { totalMeals: 0, vegMeals: 0, nonVegMeals: 0 }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${meal}-report-${date}.pdf`);

    const doc = new PDFDocument({ margin: 32, size: "A4" });
    doc.pipe(res);

    doc.fontSize(18).text(`MAHIMA CHATRABAS - ${meal.toUpperCase()} REPORT`, { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(12).text(`Date: ${date}`, { align: "center" });
    doc.fontSize(11).text(`Students Included: ${rows.length}`, { align: "center" });
    doc.moveDown(1);

    const columns = [
      { label: "Room", x: 32, width: 50 },
      { label: "Student Name", x: 82, width: 160 },
      { label: "Status", x: 242, width: 48 },
      { label: "Type", x: 290, width: 60 },
      { label: "Total Till Meal", x: 350, width: 66 },
      { label: "Veg Till Meal", x: 416, width: 70 },
      { label: "Non-Veg Till Meal", x: 486, width: 76 }
    ];
    const rowHeight = 24;
    let y = 132;

    function drawHeader() {
      doc.fontSize(8).font("Helvetica-Bold");
      columns.forEach((column) => {
        doc.rect(column.x, y, column.width, rowHeight).stroke("#6a8f76");
        doc.text(column.label, column.x + 4, y + 7, {
          width: column.width - 8,
          align: "left"
        });
      });
      y += rowHeight;
    }

    function drawRow(row) {
      const values = [
        row.roomBed,
        row.studentName,
        row.status,
        row.preference,
        String(row.totalMeals),
        String(row.tillVegMeals),
        String(row.tillNonVegMeals)
      ];
      doc.fontSize(8).font("Helvetica");
      columns.forEach((column, index) => {
        doc.rect(column.x, y, column.width, rowHeight).stroke("#c7d8cb");
        doc.text(values[index], column.x + 4, y + 7, {
          width: column.width - 8,
          align: "left"
        });
      });
      y += rowHeight;
    }

    drawHeader();

    rows.forEach((row) => {
      if (y > 760) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      drawRow(row);
    });

    const footerY = y > 710 ? 720 : y + 18;
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text(`Total Students: ${rows.length}`, 40, footerY);
    doc.text(`Total ${meal === "lunch" ? "Lunch" : "Dinner"} ON: ${dayTotals.totalMeals}`, 40, footerY + 18);
    doc.text(`Total Veg: ${dayTotals.vegMeals}`, 40, footerY + 36);
    doc.text(`Total Non-Veg: ${dayTotals.nonVegMeals}`, 40, footerY + 54);
    doc.end();
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report", error: error.message });
  }
}

async function monthSummary(req, res) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid year or month" });
    }

    const users = (await userModel.getAllUsers()).filter(isApprovedStudent);
    const totalDays = getMonthDays(year, month);
    const days = [];

    for (let day = 1; day <= totalDays; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      let totalMeals = 0;
      let vegMeals = 0;
      let nonVegMeals = 0;

      users.forEach((user) => {
        const mealStartKey = getMealStartKey(user);
        if (!mealStartKey || date < mealStartKey) return;

        const currentDay = getDayMeal(user, date);
        ["lunch", "dinner"].forEach((mealType) => {
          const meal = currentDay[mealType];
          if (!meal || !meal.enabled) return;
          totalMeals += 1;
          if (meal.type === "non-veg") nonVegMeals += 1;
          else vegMeals += 1;
        });
      });

      days.push({
        date,
        totalMeals,
        vegMeals,
        nonVegMeals,
        lunchReportReady: isAdminReportAllowed(date, "lunch"),
        dinnerReportReady: isAdminReportAllowed(date, "dinner")
      });
    }

    return res.json({ days });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load admin month summary", error: error.message });
  }
}

async function daySummary(req, res) {
  try {
    const date = String(req.query.date || "").trim();
    if (!parseDateKey(date)) {
      return res.status(400).json({ message: "Date must be YYYY-MM-DD" });
    }

    const users = (await userModel.getAllUsers()).filter(isApprovedStudent);
    let totalMeals = 0;
    let vegMeals = 0;
    let nonVegMeals = 0;

    users.forEach((user) => {
        const mealStartKey = getMealStartKey(user);
        if (!mealStartKey || date < mealStartKey) return;

      const currentDay = getDayMeal(user, date);
      ["lunch", "dinner"].forEach((mealType) => {
        const meal = currentDay[mealType];
        if (!meal || !meal.enabled) return;
        totalMeals += 1;
        if (meal.type === "non-veg") nonVegMeals += 1;
        else vegMeals += 1;
      });
    });

    return res.json({
      date,
      totalMeals,
      vegMeals,
      nonVegMeals,
      lunchReportReady: isAdminReportAllowed(date, "lunch"),
      dinnerReportReady: isAdminReportAllowed(date, "dinner")
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load admin day summary", error: error.message });
  }
}
module.exports = {
  getMealRate,
  setMealRate,
  listMealRates,
  resetMealRate,
  listStudents,
  approveStudent,
  rejectStudent,
  bulkMealUpdate,
  removeStudent,
  dailyReport,
  monthSummary,
  daySummary
};





















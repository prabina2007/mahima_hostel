const PDFDocument = require('pdfkit');
const userModel = require('../models/userModel');
const representativeLogModel = require('../models/representativeLogModel');
const { getDayMeal, getMealStartKey } = require('./mealController');
const { parseDateKey, toDateKey } = require('../utils/date');

function compareRoomBed(a, b) {
  const roomA = Number.parseInt(a.roomNumber, 10);
  const roomB = Number.parseInt(b.roomNumber, 10);
  const normalizedRoomA = Number.isNaN(roomA) ? String(a.roomNumber) : roomA;
  const normalizedRoomB = Number.isNaN(roomB) ? String(b.roomNumber) : roomB;

  if (normalizedRoomA < normalizedRoomB) return -1;
  if (normalizedRoomA > normalizedRoomB) return 1;

  const bedA = String(a.bed || '').toUpperCase();
  const bedB = String(b.bed || '').toUpperCase();
  if (bedA < bedB) return -1;
  if (bedA > bedB) return 1;

  return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'en', { sensitivity: 'base' });
}

function isApprovedStudent(user) {
  return (user.approvalStatus || 'approved') === 'approved';
}

function resolveTodayDateKey(inputDate) {
  const todayKey = toDateKey(new Date());
  const requested = String(inputDate || todayKey).trim();
  if (!parseDateKey(requested)) return { error: 'Date must be YYYY-MM-DD' };
  if (requested !== todayKey) {
    return { error: 'Representative panel only shows the current date meal status' };
  }
  return { dateKey: todayKey };
}

function isRepresentativeMealVisible(dateKey, meal) {
  const todayKey = toDateKey(new Date());
  if (dateKey !== todayKey) return false;

  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(meal === 'lunch' ? 8 : 14, meal === 'lunch' ? 0 : 30, 0, 0);
  return now >= cutoff;
}

function buildStudentRow(user, dateKey, logEntries) {
  const mealStartKey = getMealStartKey(user);
  const dayMeal = !mealStartKey || dateKey < mealStartKey
    ? {
        lunch: { enabled: false, type: user.defaultPreference || 'veg' },
        dinner: { enabled: false, type: user.defaultPreference || 'veg' }
      }
    : getDayMeal(user, dateKey);

  const entry = representativeLogModel.normalizeEntry(logEntries[user.id]);
  const lunchVisible = isRepresentativeMealVisible(dateKey, 'lunch');
  const dinnerVisible = isRepresentativeMealVisible(dateKey, 'dinner');
  const lunchOn = lunchVisible && dayMeal.lunch?.enabled === true;
  const dinnerOn = dinnerVisible && dayMeal.dinner?.enabled === true;

  return {
    id: user.id,
    studentName: user.studentName,
    roomNumber: user.roomNumber,
    bed: user.bed,
    phoneNumber: user.phoneNumber || '',
    lunchVisible,
    lunchStatus: lunchVisible ? (dayMeal.lunch?.enabled ? 'ON' : 'OFF') : 'HIDDEN',
    lunchType: lunchVisible ? (dayMeal.lunch?.type === 'non-veg' ? 'Non-Veg' : 'Veg') : '-',
    lunchTaken: lunchOn ? entry.lunchTaken === true : false,
    lunchTakenAt: entry.lunchTakenAt,
    dinnerVisible,
    dinnerStatus: dinnerVisible ? (dayMeal.dinner?.enabled ? 'ON' : 'OFF') : 'HIDDEN',
    dinnerType: dinnerVisible ? (dayMeal.dinner?.type === 'non-veg' ? 'Non-Veg' : 'Veg') : '-',
    dinnerTaken: dinnerOn ? entry.dinnerTaken === true : false,
    dinnerTakenAt: entry.dinnerTakenAt,
    totalPlannedMeals: Number(lunchOn) + Number(dinnerOn)
  };
}

function computeTotals(students) {
  return students.reduce(
    (acc, student) => {
      if (student.lunchStatus === 'ON') {
        acc.totalMeals += 1;
        if (student.lunchType === 'Non-Veg') acc.nonVegMeals += 1;
        else acc.vegMeals += 1;
      }
      if (student.dinnerStatus === 'ON') {
        acc.totalMeals += 1;
        if (student.dinnerType === 'Non-Veg') acc.nonVegMeals += 1;
        else acc.vegMeals += 1;
      }
      if (student.lunchTaken) acc.mealsTaken += 1;
      if (student.dinnerTaken) acc.mealsTaken += 1;
      return acc;
    },
    { totalMeals: 0, vegMeals: 0, nonVegMeals: 0, mealsTaken: 0 }
  );
}

async function getDayStatus(req, res) {
  try {
    const resolved = resolveTodayDateKey(req.query.date);
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const { dateKey } = resolved;

    const users = (await userModel.getAllUsers()).filter(isApprovedStudent).sort(compareRoomBed);
    const logEntries = await representativeLogModel.getDayLog(dateKey);
    const students = users.map((user) => buildStudentRow(user, dateKey, logEntries));
    const totals = computeTotals(students);

    return res.json({
      date: dateKey,
      students,
      ...totals,
      lunchVisible: isRepresentativeMealVisible(dateKey, 'lunch'),
      dinnerVisible: isRepresentativeMealVisible(dateKey, 'dinner'),
      lunchReportReady: isRepresentativeMealVisible(dateKey, 'lunch'),
      dinnerReportReady: isRepresentativeMealVisible(dateKey, 'dinner')
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load representative day status', error: error.message });
  }
}

async function updateMealTaken(req, res) {
  try {
    const resolved = resolveTodayDateKey(req.params.date);
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const { dateKey } = resolved;

    const studentId = String(req.params.studentId || '').trim();
    const meal = String(req.body.meal || '').trim().toLowerCase();
    const taken = req.body.taken === true;

    if (!studentId) return res.status(400).json({ message: 'Student id is required' });
    if (!['lunch', 'dinner'].includes(meal)) {
      return res.status(400).json({ message: 'Meal must be lunch or dinner' });
    }
    if (!isRepresentativeMealVisible(dateKey, meal)) {
      return res.status(400).json({
        message: meal === 'lunch'
          ? 'Lunch status becomes available after 08:00 AM'
          : 'Dinner status becomes available after 02:30 PM'
      });
    }

    const user = await userModel.findById(studentId);
    if (!user || !isApprovedStudent(user)) {
      return res.status(404).json({ message: 'Approved student not found' });
    }

    const row = buildStudentRow(user, dateKey, await representativeLogModel.getDayLog(dateKey));
    const statusKey = meal === 'lunch' ? 'lunchStatus' : 'dinnerStatus';
    if (row[statusKey] !== 'ON') {
      return res.status(400).json({ message: `Cannot mark ${meal} as taken because it is OFF for this student` });
    }

    const entry = await representativeLogModel.setMealTaken(dateKey, studentId, meal, taken);
    return res.json({ message: `${meal[0].toUpperCase() + meal.slice(1)} marked successfully`, entry });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update representative meal status', error: error.message });
  }
}

async function dailyPdf(req, res) {
  try {
    const resolved = resolveTodayDateKey(req.query.date);
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const { dateKey } = resolved;

    const meal = String(req.query.meal || '').trim().toLowerCase();
    if (!['lunch', 'dinner'].includes(meal)) {
      return res.status(400).json({ message: 'Meal must be lunch or dinner' });
    }
    if (!isRepresentativeMealVisible(dateKey, meal)) {
      return res.status(400).json({
        message: meal === 'lunch'
          ? 'Lunch PDF is available after 08:00 AM for current day'
          : 'Dinner PDF is available after 02:30 PM for current day'
      });
    }

    const users = (await userModel.getAllUsers()).filter(isApprovedStudent).sort(compareRoomBed);
    const logEntries = await representativeLogModel.getDayLog(dateKey);
    const students = users.map((user) => buildStudentRow(user, dateKey, logEntries));
    const totals = computeTotals(students);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=representative-${meal}-status-${dateKey}.pdf`);

    const doc = new PDFDocument({ margin: 28, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text(`MAHIMA CHATRABAS - REPRESENTATIVE ${meal.toUpperCase()} STATUS`, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Date: ${dateKey}`, { align: 'center' });
    doc.moveDown(1);

    const columns = [
      { label: 'Room', x: 24, width: 55 },
      { label: 'Student Name', x: 79, width: 170 },
      { label: 'Phone', x: 249, width: 95 },
      { label: 'Meal ON/OFF', x: 344, width: 75 },
      { label: 'Type', x: 419, width: 65 },
      { label: 'Taken', x: 484, width: 55 },
      { label: 'Taken Time', x: 539, width: 95 }
    ];
    const rowHeight = 24;
    let y = 120;

    const drawHeader = () => {
      doc.fontSize(8).font('Helvetica-Bold');
      columns.forEach((column) => {
        doc.rect(column.x, y, column.width, rowHeight).stroke('#6a8f76');
        doc.text(column.label, column.x + 4, y + 7, { width: column.width - 8 });
      });
      y += rowHeight;
    };

    const drawRow = (student) => {
      const isLunch = meal === 'lunch';
      const values = [
        `${student.roomNumber}-${student.bed}`,
        student.studentName,
        student.phoneNumber || '-',
        isLunch ? student.lunchStatus : student.dinnerStatus,
        isLunch ? student.lunchType : student.dinnerType,
        (isLunch ? student.lunchTaken : student.dinnerTaken) ? 'YES' : 'NO',
        (isLunch ? student.lunchTakenAt : student.dinnerTakenAt) || '-'
      ];
      doc.fontSize(8).font('Helvetica');
      columns.forEach((column, index) => {
        doc.rect(column.x, y, column.width, rowHeight).stroke('#d5e0d8');
        doc.text(values[index], column.x + 4, y + 7, { width: column.width - 8 });
      });
      y += rowHeight;
    };

    drawHeader();
    students.forEach((student) => {
      if (y > 760) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      drawRow(student);
    });

    const footerY = y + 16;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Total Visible Meals Today: ${totals.totalMeals}`, 28, footerY);
    doc.text(`Visible Meals Marked Taken: ${totals.mealsTaken}`, 28, footerY + 18);
    doc.text(`Visible Veg Meals: ${totals.vegMeals}`, 28, footerY + 36);
    doc.text(`Visible Non-Veg Meals: ${totals.nonVegMeals}`, 28, footerY + 54);
    doc.end();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate representative PDF', error: error.message });
  }
}

module.exports = {
  getDayStatus,
  updateMealTaken,
  dailyPdf
};

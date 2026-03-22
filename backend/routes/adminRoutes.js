const express = require("express");
const adminController = require("../controllers/adminController");
const { authRequired, adminRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authRequired, adminRequired);
router.get("/students", adminController.listStudents);
router.get("/calendar", adminController.monthSummary);
router.get("/day-summary", adminController.daySummary);
router.get("/meal-rate", adminController.getMealRate);
router.put("/meal-rate", adminController.setMealRate);
router.get("/meal-rates", adminController.listMealRates);
router.delete("/meal-rate/:month", adminController.resetMealRate);
router.post("/meals/bulk-update", adminController.bulkMealUpdate);
router.patch("/students/:id/approve", adminController.approveStudent);
router.patch("/students/:id/reject", adminController.rejectStudent);
router.delete("/students/:id", adminController.removeStudent);
router.get("/reports/daily", adminController.dailyReport);

module.exports = router;





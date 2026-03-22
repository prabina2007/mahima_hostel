const express = require("express");
const mealController = require("../controllers/mealController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authRequired);
router.get("/month", mealController.getMonth);
router.post("/month/preference", mealController.updateMonthPreference);
router.post("/default-preference", mealController.updateDefaultPreference);
router.patch("/:date", mealController.updateDay);
router.get("/stats/summary", mealController.stats);

module.exports = router;

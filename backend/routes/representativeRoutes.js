const express = require('express');
const representativeController = require('../controllers/representativeController');
const { authRequired, representativeRequired } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authRequired, representativeRequired);
router.get('/day-status', representativeController.getDayStatus);
router.patch('/day-status/:date/:studentId', representativeController.updateMealTaken);
router.get('/reports/daily', representativeController.dailyPdf);

module.exports = router;

const express = require("express");
const authController = require("../controllers/authController");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/admin-login", authController.adminLogin);
router.post("/representative-login", authController.representativeLogin);
router.get("/me", authRequired, authController.me);

module.exports = router;

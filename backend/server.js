require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const mealRoutes = require("./routes/mealRoutes");
const adminRoutes = require("./routes/adminRoutes");
const representativeRoutes = require("./routes/representativeRoutes");
const { connectMongo, isMongoReady, shouldUseMongo } = require("./models/mongoClient");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/representative", representativeRoutes);

app.use("/assets", express.static(path.join(__dirname, "..")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "MAHIMA CHATRABAS API",
    storage: isMongoReady() ? "mongodb" : "json",
    mongoConfigured: shouldUseMongo(),
    allowedOrigins
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

async function startServer() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const publicRoutes = require("./routes/public");
const protectedRoutes = require("./routes/protected");
const auth = require("./middlewares/auth");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "force-commerciale-terrain-backend",
    },
  });
});

app.use("/api/v1", publicRoutes);
app.use("/api/v1", auth, protectedRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

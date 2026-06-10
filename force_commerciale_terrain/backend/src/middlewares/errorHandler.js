const { sendError } = require("../shared/apiResponse");

function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;

  return sendError(
    res,
    status,
    error.message || "Internal server error",
    error.details || null
  );
}

module.exports = errorHandler;

const { sendError } = require("../shared/apiResponse");

function notFound(req, res) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

module.exports = notFound;

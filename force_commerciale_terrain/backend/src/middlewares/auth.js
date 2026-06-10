const prisma = require("../lib/prisma");
const { verifyAccessToken } = require("../lib/jwt");
const HttpError = require("../shared/httpError");

async function auth(req, _res, next) {
  const authorization = req.header("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  try {
    const token = authorization.replace("Bearer ", "").trim();
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return next(new HttpError(401, "User session is invalid"));
    }

    req.user = user;
    return next();
  } catch (_error) {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}

module.exports = auth;

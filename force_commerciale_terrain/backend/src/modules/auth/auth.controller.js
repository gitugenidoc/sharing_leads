const bcrypt = require("bcryptjs");

const prisma = require("../../lib/prisma");
const { signAccessToken } = require("../../lib/jwt");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const { sanitizeUser } = require("../../shared/sanitize");

async function bootstrap(req, res) {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new HttpError(409, "Bootstrap already completed");
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const user = await prisma.user.create({
    data: {
      fullName: req.body.fullName,
      email: req.body.email.toLowerCase(),
      passwordHash,
      phoneNumber: req.body.phoneNumber || null,
      role: "ADMIN",
      territory: req.body.territory || "Default",
    },
  });

  return sendSuccess(
    res,
    {
      accessToken: signAccessToken(user),
      user: sanitizeUser(user),
    },
    201
  );
}

async function login(req, res) {
  const email = (req.body.email || "").toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(req.body.password || "", user.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  return sendSuccess(res, {
    accessToken: signAccessToken(user),
    user: sanitizeUser(user),
  });
}

async function me(req, res) {
  return sendSuccess(res, sanitizeUser(req.user));
}

module.exports = {
  bootstrap,
  login,
  me,
};

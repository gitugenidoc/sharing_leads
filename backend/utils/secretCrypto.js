const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  const source =
    process.env.INTEGRATION_SECRET_KEY ||
    process.env.JWT_SECRET ||
    "dev-only-integration-key-change-me";
  return crypto.createHash("sha256").update(source).digest();
};

const encryptSecret = (plaintext) => {
  const text = String(plaintext || "");
  if (!text) return { encrypted: "", iv: "" };
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
};

const decryptSecret = (encrypted, iv) => {
  if (!encrypted || !iv) return "";
  const data = Buffer.from(encrypted, "base64");
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

const generateWebhookSecret = () => crypto.randomBytes(32).toString("hex");

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

module.exports = {
  encryptSecret,
  decryptSecret,
  generateWebhookSecret,
  timingSafeEqual,
};

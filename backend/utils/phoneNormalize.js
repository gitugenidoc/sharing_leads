const toText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const stripFormatting = (phone) => toText(phone).replace(/[\s().\-]/g, "");

const normalizePhoneDigits = (phone) => {
  let text = stripFormatting(phone);
  if (!text) return "";
  if (text.startsWith("*")) text = text.slice(1);
  if (text.startsWith("00")) text = text.slice(2);
  if (text.startsWith("+")) text = text.slice(1);
  return text.replace(/[^\d]/g, "");
};

const getPhoneVariants = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return [];
  const variants = new Set([digits]);
  if (digits.startsWith("33") && digits.length > 2) {
    variants.add(`0${digits.slice(2)}`);
  }
  if (digits.startsWith("0") && digits.length > 1) {
    variants.add(`33${digits.slice(1)}`);
  }
  if (digits.startsWith("212") && digits.length > 3) {
    variants.add(`0${digits.slice(3)}`);
    variants.add(digits.slice(3));
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    variants.add(`212${digits.slice(1)}`);
  }
  return [...variants];
};

const phonesMatch = (a, b) => {
  const variantsA = getPhoneVariants(a);
  const variantsB = getPhoneVariants(b);
  if (!variantsA.length || !variantsB.length) return false;
  const setB = new Set(variantsB);
  return variantsA.some((v) => setB.has(v));
};

const formatDisplayPhone = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("33") && digits.length === 11) {
    return `+33 ${digits.slice(2, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  return phone || digits;
};

module.exports = {
  toText,
  normalizePhoneDigits,
  getPhoneVariants,
  phonesMatch,
  formatDisplayPhone,
};

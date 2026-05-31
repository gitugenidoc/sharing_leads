// Validation middleware for clients and users

// Validate name (nom/prenom)
const validateName = (name) => {
  return name && name.trim().length >= 2;
};

// Validate address
const validateAddress = (address) => {
  return address && address.trim().length >= 5;
};

// Validate city
const validateCity = (city) => {
  return city && city.trim().length >= 2;
};

// Validate postal code (French: 5 digits)
const validatePostalCode = (code) => {
  const re = /^\d{5}$/;
  return re.test(code);
};

// Validate mutual name
const validateMutualName = (name) => {
  return name && name.trim().length >= 2;
};

// Validate price
const validatePrice = (price) => {
  const amount = parseFloat(price);
  return !isNaN(amount) && amount >= 0;
};

// Validate status
const validStatuses = [
  "NEW",
  "TO_CALL",
  "UNREACHABLE",
  "CALLBACK_SCHEDULED",
  "QUOTE_SENT",
  "INTERESTED",
  "REFUSED",
  "SIGNED",
  "LOST",
  // Legacy statuses are kept to avoid breaking existing data/imports.
  "CONTACTED",
  "QUALIFIED",
  "CLOSED",
];
const validateStatus = (status) => validStatuses.includes(status);

// Validate client data
const validateClient = (data) => {
  const errors = [];

  if (!validateName(data.nom)) {
    errors.push("Nom must be at least 2 characters");
  }

  if (!validateName(data.prenom)) {
    errors.push("Prenom must be at least 2 characters");
  }

  if (!validateAddress(data.adresse)) {
    errors.push("Address must be at least 5 characters");
  }

  if (!validateCity(data.ville)) {
    errors.push("City must be at least 2 characters");
  }

  if (!validatePostalCode(data.code_postal)) {
    errors.push("Postal code must be 5 digits (French format)");
  }

  if (data.nom_mutuelle && !validateMutualName(data.nom_mutuelle)) {
    errors.push("Mutual name must be at least 2 characters");
  }

  if (
    data.prix_mutuelle !== undefined &&
    data.prix_mutuelle !== null &&
    data.prix_mutuelle !== "" &&
    !validatePrice(data.prix_mutuelle)
  ) {
    errors.push("Price must be a positive number");
  }

  if (data.status && !validateStatus(data.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate user data
const validateUser = (data) => {
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push("Invalid email format");
  }

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  const validRoles = ["SUPER_ADMIN", "ADMIN", "AGENT"];
  if (data.role && !validRoles.includes(data.role)) {
    errors.push(`Role must be one of: ${validRoles.join(", ")}`);
  }

  if (data.password) {
    if (data.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Middleware factory
const validateClientData = (req, res, next) => {
  const validation = validateClient(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors,
    });
  }
  next();
};

const validateUserData = (req, res, next) => {
  const validation = validateUser(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors,
    });
  }
  next();
};

module.exports = {
  validateName,
  validateAddress,
  validateCity,
  validatePostalCode,
  validateMutualName,
  validatePrice,
  validateStatus,
  validateClient,
  validateUser,
  validateClientData,
  validateUserData,
  validStatuses,
};

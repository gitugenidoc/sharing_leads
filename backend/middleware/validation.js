// Validation middleware for leads and users

// Validate email format
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validate phone format (basic international)
const validatePhone = (phone) => {
  const re = /^[\d\s\-\+\(\)]{10,}$/;
  return re.test(phone.replace(/\s/g, ""));
};

// Validate status
const validStatuses = ["NEW", "CONTACTED", "INTERESTED", "QUALIFIED", "CLOSED"];
const validateStatus = (status) => validStatuses.includes(status);

// Validate lead data
const validateLead = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push("Invalid email format");
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.push("Invalid phone number (minimum 10 digits)");
  }

  if (data.status && !validateStatus(data.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
  }

  if (data.amount) {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push("Amount must be a positive number");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate user data
const validateUser = (data) => {
  const errors = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push("Invalid email format");
  }

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  const validRoles = ["ADMIN", "SUPERVISOR", "VALIDATION", "AGENT"];
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
const validateLeadData = (req, res, next) => {
  const validation = validateLead(req.body);
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
  validateEmail,
  validatePhone,
  validateStatus,
  validateLead,
  validateUser,
  validateLeadData,
  validateUserData,
  validStatuses,
};

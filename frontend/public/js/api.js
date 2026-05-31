// API helper functions
const API_BASE_URL = "/api";

// Get token from localStorage
const getToken = () => localStorage.getItem("token");

// Set token in localStorage
const setToken = (token) => localStorage.setItem("token", token);

// Remove token
const removeToken = () => localStorage.removeItem("token");

// Get user from localStorage
const getUser = () => JSON.parse(localStorage.getItem("user"));

// Set user in localStorage
const setUser = (user) => localStorage.setItem("user", JSON.stringify(user));

// Remove user
const removeUser = () => localStorage.removeItem("user");

// Generic fetch function with auth and error handling
const apiCall = async (method, endpoint, data = null) => {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  const token = getToken();
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (data && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (response.status === 401) {
      // Token expired or invalid
      removeToken();
      removeUser();
      window.location.href = "/index.html";
      return null;
    }

    const json = await response.json();

    if (!response.ok) {
      const error = new Error(json.error || "API Error");
      error.status = response.status;
      error.details = json.details || [];
      throw error;
    }

    return json;
  } catch (error) {
    // Re-throw with formatted error message
    error.formattedMessage = formatErrorMessage(error);
    throw error;
  }
};

// Format error for display
const formatErrorMessage = (error) => {
  if (error.details && error.details.length > 0) {
    return error.details.join("\n");
  }
  return error.message || "An error occurred";
};

// Client-side validation helpers
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePhone = (phone) => {
  const re = /^[\d\s\-\+\(\)]{10,}$/;
  return re.test(phone.replace(/\s/g, ""));
};

const validateLeadForm = (formData) => {
  const errors = [];

  if (!formData.nom || formData.nom.trim().length < 2) {
    errors.push("Le nom doit contenir au moins 2 caracteres");
  }

  if (!formData.prenom || formData.prenom.trim().length < 2) {
    errors.push("Le prenom doit contenir au moins 2 caracteres");
  }

  if (!formData.adresse || formData.adresse.trim().length < 5) {
    errors.push("L'adresse doit contenir au moins 5 caracteres");
  }

  if (!formData.ville || formData.ville.trim().length < 2) {
    errors.push("La ville doit contenir au moins 2 caracteres");
  }

  if (!/^\d{5}$/.test(formData.code_postal || "")) {
    errors.push("Le code postal doit contenir 5 chiffres");
  }

  if (!formData.nom_mutuelle || formData.nom_mutuelle.trim().length < 2) {
    errors.push("Le nom de mutuelle est obligatoire");
  }

  const amount = parseFloat(formData.prix_mutuelle);
  if (isNaN(amount) || amount <= 0) {
    errors.push("Le prix mutuelle doit etre un nombre positif");
  }

  return errors;
};

const validateUserForm = (formData) => {
  const errors = [];

  if (!formData.email || !validateEmail(formData.email)) {
    errors.push("Invalid email format");
  }

  if (!formData.name || formData.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  return errors;
};

// Auth API calls
const login = async (email, password) => {
  const data = await apiCall("POST", "/auth/login", { email, password });
  if (data) {
    setToken(data.token);
    setUser(data.user);
  }
  return data;
};

const register = async (
  email,
  password,
  name,
  role = "AGENT",
  centerName = "",
  centerId = "",
) => {
  const data = await apiCall("POST", "/auth/register", {
    email,
    password,
    name,
    role,
    center_name: centerName,
    center_id: centerId,
  });
  return data;
};

const logout = () => {
  removeToken();
  removeUser();
};

const getCurrentUser = async () => {
  try {
    const data = await apiCall("GET", "/auth/me");
    return data.user;
  } catch (err) {
    return null;
  }
};

// Users API calls
const getAllUsers = async () => {
  const data = await apiCall("GET", "/users");
  return data;
};

const getCenters = async () => {
  const data = await apiCall("GET", "/users/centers");
  return data;
};

const getUserById = async (id) => {
  const data = await apiCall("GET", `/users/${id}`);
  return data;
};

const updateUser = async (id, name, role) => {
  const data = await apiCall("PUT", `/users/${id}`, { name, role });
  return data;
};

const deleteUser = async (id) => {
  const data = await apiCall("DELETE", `/users/${id}`);
  return data;
};

// Clients API calls. Function names remain lead-oriented for existing pages.
const getAllLeads = async (offset = 0, limit = 100) => {
  const data = await apiCall("GET", `/clients?offset=${offset}&limit=${limit}`);
  return data;
};

const getUserLeads = async (offset = 0, limit = 100) => {
  const data = await apiCall(
    "GET",
    `/clients/me?offset=${offset}&limit=${limit}`,
  );
  return data;
};

const getLeadById = async (id) => {
  const data = await apiCall("GET", `/clients/${id}`);
  return data;
};

const createLead = async (leadData) => {
  const data = await apiCall("POST", "/clients", leadData);
  return data;
};

const updateLead = async (id, leadData) => {
  const data = await apiCall("PUT", `/clients/${id}`, leadData);
  return data;
};

const deleteLead = async (id) => {
  const data = await apiCall("DELETE", `/clients/${id}`);
  return data;
};

const assignLead = async (id, userId) => {
  const data = await apiCall("PUT", `/clients/${id}/assign`, { userId });
  return data;
};

const assignRandomLeads = async (userId, count) => {
  const data = await apiCall("POST", "/clients/assign-random", {
    userId,
    count,
  });
  return data;
};

const getClientHistory = async (id) => {
  const data = await apiCall("GET", `/clients/${id}/history`);
  return data.history || [];
};

const getClientStatuses = async () => {
  const data = await apiCall("GET", "/clients/statuses/list");
  return data;
};

const searchLeads = async (query, offset = 0, limit = 100) => {
  const data = await apiCall(
    "GET",
    `/clients/search?q=${query}&offset=${offset}&limit=${limit}`,
  );
  return data;
};

const getImportLogs = async (offset = 0, limit = 100) => {
  const data = await apiCall("GET", `/logs/imports?offset=${offset}&limit=${limit}`);
  return data;
};

const getAuditLogs = async (offset = 0, limit = 100) => {
  const data = await apiCall("GET", `/logs/audit?offset=${offset}&limit=${limit}`);
  return data;
};

// File upload helper for Excel
const uploadExcel = async (file, optionsData = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(optionsData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  };

  const response = await fetch(`${API_BASE_URL}/clients/import`, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Upload failed");
  }

  return json;
};

const previewExcelImport = async (file, optionsData = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(optionsData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const response = await fetch(`${API_BASE_URL}/clients/import/preview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  });
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(json.error || "Preview failed");
    error.details = json.details || [];
    error.duplicateCandidates = json.duplicateCandidates || [];
    throw error;
  }
  return json;
};

const sendMail = async (
  recipientEmail,
  recipientName,
  subject,
  body,
  clientId = null,
  templateId = null,
) => {
  const data = await apiCall("POST", "/mail/send", {
    recipientEmail,
    recipientName,
    subject,
    body,
    clientId,
    templateId,
  });
  return data;
};

const getMailTemplates = async () => {
  const data = await apiCall("GET", "/mail/templates");
  return data;
};

const getMailHistory = async (clientId = null) => {
  const endpoint = clientId ? `/mail/history?clientId=${clientId}` : "/mail/history";
  const data = await apiCall("GET", endpoint);
  return data;
};

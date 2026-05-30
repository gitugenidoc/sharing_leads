// API helper functions
const API_BASE_URL = "http://localhost:5000/api";

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

// Generic fetch function with auth
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
    throw new Error(json.error || "API Error");
  }

  return json;
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

const register = async (email, password, name) => {
  const data = await apiCall("POST", "/auth/register", {
    email,
    password,
    name,
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

// Leads API calls
const getAllLeads = async (offset = 0, limit = 100) => {
  const data = await apiCall("GET", `/leads?offset=${offset}&limit=${limit}`);
  return data;
};

const getUserLeads = async (offset = 0, limit = 100) => {
  const data = await apiCall(
    "GET",
    `/leads/me?offset=${offset}&limit=${limit}`,
  );
  return data;
};

const getLeadById = async (id) => {
  const data = await apiCall("GET", `/leads/${id}`);
  return data;
};

const createLead = async (leadData) => {
  const data = await apiCall("POST", "/leads", leadData);
  return data;
};

const updateLead = async (id, leadData) => {
  const data = await apiCall("PUT", `/leads/${id}`, leadData);
  return data;
};

const deleteLead = async (id) => {
  const data = await apiCall("DELETE", `/leads/${id}`);
  return data;
};

const assignLead = async (id, userId) => {
  const data = await apiCall("PUT", `/leads/${id}/assign`, { userId });
  return data;
};

const searchLeads = async (query, offset = 0, limit = 100) => {
  const data = await apiCall(
    "GET",
    `/leads/search?q=${query}&offset=${offset}&limit=${limit}`,
  );
  return data;
};

// File upload helper for Excel
const uploadExcel = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  };

  const response = await fetch(`${API_BASE_URL}/leads/import`, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || "Upload failed");
  }

  return json;
};

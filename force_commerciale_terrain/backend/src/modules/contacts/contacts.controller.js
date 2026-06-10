const prisma = require("../../lib/prisma");
const HttpError = require("../../shared/httpError");
const { sendSuccess } = require("../../shared/apiResponse");
const { getScopedAgentId } = require("../../shared/scope");

async function listContacts(req, res) {
  const assignedAgentId = getScopedAgentId(req.user, req.query.assignedAgentId);
  const search = req.query.search?.trim();

  const contacts = await prisma.contact.findMany({
    where: {
      ...(assignedAgentId ? { assignedAgentId } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { phoneNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(res, contacts);
}

async function createContact(req, res) {
  const contact = await prisma.contact.create({
    data: {
      fullName: req.body.fullName,
      companyName: req.body.companyName || null,
      roleTitle: req.body.roleTitle || null,
      phoneNumber: req.body.phoneNumber || null,
      email: req.body.email || null,
      status: req.body.status || "NEW",
      assignedAgentId: req.body.assignedAgentId || req.user.id,
    },
  });

  return sendSuccess(res, contact, 201);
}

async function getContact(req, res) {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.contactId },
  });

  if (!contact) {
    throw new HttpError(404, "Contact not found");
  }

  return sendSuccess(res, contact);
}

async function updateContact(req, res) {
  const existingContact = await prisma.contact.findUnique({
    where: { id: req.params.contactId },
  });

  if (!existingContact) {
    throw new HttpError(404, "Contact not found");
  }

  const contact = await prisma.contact.update({
    where: { id: req.params.contactId },
    data: {
      fullName: req.body.fullName ?? undefined,
      companyName: req.body.companyName ?? undefined,
      roleTitle: req.body.roleTitle ?? undefined,
      phoneNumber: req.body.phoneNumber ?? undefined,
      email: req.body.email ?? undefined,
      status: req.body.status ?? undefined,
      assignedAgentId: req.body.assignedAgentId ?? undefined,
    },
  });

  return sendSuccess(res, contact);
}

module.exports = {
  listContacts,
  createContact,
  getContact,
  updateContact,
};

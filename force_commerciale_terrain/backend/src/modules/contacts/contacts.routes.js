const express = require("express");

const asyncHandler = require("../../shared/asyncHandler");
const controller = require("./contacts.controller");

const router = express.Router();

router.get("/", asyncHandler(controller.listContacts));
router.post("/", asyncHandler(controller.createContact));
router.get("/:contactId", asyncHandler(controller.getContact));
router.patch("/:contactId", asyncHandler(controller.updateContact));

module.exports = router;

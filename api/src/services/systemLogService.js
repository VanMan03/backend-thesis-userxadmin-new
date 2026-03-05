const SystemLog = require("../models/SystemLog");

const allowedSeverities = new Set(["Error", "Warning", "Info", "Success"]);
const allowedStatuses = new Set(["Success", "Warning", "Failed"]);

function normalizeSeverity(value) {
  return allowedSeverities.has(value) ? value : "Info";
}

function normalizeStatus(value) {
  return allowedStatuses.has(value) ? value : "Success";
}

async function createSystemLog({
  severity = "Info",
  event,
  description = "",
  status = "Success",
  actorId = null,
  actorRole = null,
  metadata = null
}) {
  if (!event || typeof event !== "string") {
    return null;
  }

  try {
    return await SystemLog.create({
      severity: normalizeSeverity(severity),
      event: event.trim(),
      description,
      status: normalizeStatus(status),
      actorId,
      actorRole,
      metadata
    });
  } catch (err) {
    console.error("System log write error:", err.message);
    return null;
  }
}

module.exports = {
  createSystemLog,
  allowedSeverities
};

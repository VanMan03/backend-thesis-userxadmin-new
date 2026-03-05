const SystemLog = require("../models/SystemLog");

const allowedSeverities = new Set(["Error", "Warning", "Info", "Success"]);
const allowedStatuses = new Set(["Success", "Warning", "Failed"]);
const logListeners = new Set();

function normalizeSeverity(value) {
  return allowedSeverities.has(value) ? value : "Info";
}

function normalizeStatus(value) {
  return allowedStatuses.has(value) ? value : "Success";
}

function serializeLog(logDoc) {
  if (!logDoc) return null;
  return {
    _id: logDoc._id,
    severity: logDoc.severity,
    event: logDoc.event,
    description: logDoc.description,
    status: logDoc.status,
    timestamp: logDoc.timestamp instanceof Date
      ? logDoc.timestamp.toISOString()
      : new Date(logDoc.timestamp).toISOString(),
    actorId: logDoc.actorId || null,
    actorRole: logDoc.actorRole || null
  };
}

function notifyLogListeners(logDoc) {
  const payload = serializeLog(logDoc);
  if (!payload) return;

  logListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error("System log listener error:", err.message);
    }
  });
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
    const logDoc = await SystemLog.create({
      severity: normalizeSeverity(severity),
      event: event.trim(),
      description,
      status: normalizeStatus(status),
      actorId,
      actorRole,
      metadata
    });
    notifyLogListeners(logDoc);
    return logDoc;
  } catch (err) {
    console.error("System log write error:", err.message);
    return null;
  }
}

function subscribeToSystemLogs(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  logListeners.add(listener);

  return () => {
    logListeners.delete(listener);
  };
}

module.exports = {
  createSystemLog,
  allowedSeverities,
  subscribeToSystemLogs
};

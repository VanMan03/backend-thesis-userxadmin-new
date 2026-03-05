const mongoose = require("mongoose");
const User = require("../models/User");

const TRAVEL_STYLE_RULES = {
  solo: { min: 0, max: 0 },
  couple: { min: 1, max: 1 },
  friends: { min: 1, max: 20 },
  family: { min: 1, max: 20 },
  family_group: { min: 1, max: null },
  team: { min: 1, max: 50 }
};

const DEFAULT_TRAVEL_STYLE = "solo";

function normalizeTravelStyle(input) {
  const styleInput = Array.isArray(input) ? input[0] : input;
  const raw = typeof styleInput === "string" ? styleInput.trim().toLowerCase() : "";
  if (!raw) return DEFAULT_TRAVEL_STYLE;

  if (raw === "familygroup" || raw === "family-group") return "family_group";
  if (TRAVEL_STYLE_RULES[raw]) return raw;

  return null;
}

function normalizeRawStringList(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function normalizeIdCandidates(input) {
  const rawIds = normalizeRawStringList(input);
  const ids = [];
  const seen = new Set();

  for (const id of rawIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        ok: false,
        code: "INVALID_COLLABORATOR_ID",
        message: `Invalid collaboratorId: ${id}`
      };
    }

    const normalized = new mongoose.Types.ObjectId(id).toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
  }

  return { ok: true, ids };
}

async function resolveCollaboratorsByLabel(labels) {
  const normalizedLabels = normalizeRawStringList(labels);
  if (!normalizedLabels.length) {
    return { ok: true, ids: [] };
  }

  const ids = [];
  const seen = new Set();

  for (const label of normalizedLabels) {
    const matches = await User.find({
      $or: [
        { email: { $regex: `^${escapeRegExp(label)}$`, $options: "i" } },
        { fullName: { $regex: `^${escapeRegExp(label)}$`, $options: "i" } }
      ]
    }).select("_id").limit(2);

    if (!matches.length) {
      return {
        ok: false,
        code: "UNKNOWN_COLLABORATOR",
        message: `Collaborator not found: ${label}`
      };
    }

    if (matches.length > 1) {
      return {
        ok: false,
        code: "AMBIGUOUS_COLLABORATOR",
        message: `Collaborator label is ambiguous: ${label}. Send collaboratorIds instead.`
      };
    }

    const id = matches[0]._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ok: true, ids };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function normalizeCollaborators({
  currentUserId,
  travelStyle,
  collaboratorIds,
  collaborators,
  enforceTravelStyleCount = false
}) {
  const normalizedStyle = normalizeTravelStyle(travelStyle);
  if (!normalizedStyle) {
    return {
      ok: false,
      code: "INVALID_TRAVEL_STYLE",
      message: `Unsupported travelStyle: ${travelStyle}`
    };
  }

  const normalizedIdResult = normalizeIdCandidates(collaboratorIds);
  if (!normalizedIdResult.ok) {
    return normalizedIdResult;
  }

  const resolvedLabelResult = await resolveCollaboratorsByLabel(collaborators);
  if (!resolvedLabelResult.ok) {
    return resolvedLabelResult;
  }

  const deduped = new Set([
    ...normalizedIdResult.ids,
    ...resolvedLabelResult.ids
  ]);
  const normalizedCurrentUserId = new mongoose.Types.ObjectId(currentUserId).toString();
  deduped.delete(normalizedCurrentUserId);

  const finalIds = [...deduped];
  if (enforceTravelStyleCount) {
    const rules = TRAVEL_STYLE_RULES[normalizedStyle] || TRAVEL_STYLE_RULES[DEFAULT_TRAVEL_STYLE];
    const exceedsMax = Number.isFinite(rules.max) ? finalIds.length > rules.max : false;

    if (finalIds.length < rules.min || exceedsMax) {
      const maxLabel = Number.isFinite(rules.max) ? rules.max : "unlimited";
      return {
        ok: false,
        code: "INVALID_COLLABORATOR_COUNT",
        message: `travelStyle '${normalizedStyle}' requires ${rules.min}-${maxLabel} collaborators`
      };
    }
  }

  if (finalIds.length) {
    const foundUsers = await User.find({ _id: { $in: finalIds } }).select("_id");
    if (foundUsers.length !== finalIds.length) {
      return {
        ok: false,
        code: "COLLABORATORS_NOT_FOUND",
        message: "One or more collaborators do not exist"
      };
    }
  }

  return {
    ok: true,
    travelStyle: normalizedStyle,
    collaboratorIds: finalIds
  };
}

module.exports = {
  TRAVEL_STYLE_RULES,
  DEFAULT_TRAVEL_STYLE,
  normalizeTravelStyle,
  normalizeCollaborators
};

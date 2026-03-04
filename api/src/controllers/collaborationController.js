const mongoose = require("mongoose");
const Itinerary = require("../models/Itinerary");
const User = require("../models/User");
const Destination = require("../models/Destination");
const CollaborationInvitation = require("../models/CollaborationInvitation");
const CollaborationNotification = require("../models/CollaborationNotification");
const { splitDestinationsByDays, normalizeDays } = require("../utils/splitItineraryByDays");
const { broadcastItineraryEdit } = require("../services/collaborationRealtime");

async function canAccessItinerary(userId, itineraryId) {
  return Itinerary.findOne({
    _id: itineraryId,
    $or: [{ user: userId }, { collaboratorIds: userId }]
  });
}

function mapNotification(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    itineraryId: notification.itineraryId ? notification.itineraryId.toString() : null,
    invitationId: notification.invitationId ? notification.invitationId.toString() : null,
    read: Boolean(notification.read),
    createdAt: notification.createdAt,
    actorName: notification.actor?.fullName || null
  };
}

exports.getNotifications = async (req, res) => {
  try {
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    const notifications = await CollaborationNotification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "_id fullName");

    return res.json(notifications.map(mapNotification));
  } catch (error) {
    console.error("Failed to list collaboration notifications:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const updated = await CollaborationNotification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { $set: { read: true } },
      { new: true }
    ).populate("actor", "_id fullName");

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json(mapNotification(updated));
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createInvitation = async (req, res) => {
  try {
    const { itineraryId, collaboratorId, collaboratorLabel } = req.body;

    if (!mongoose.Types.ObjectId.isValid(itineraryId)) {
      return res.status(400).json({ message: "Invalid itineraryId" });
    }

    let inviteeId = null;
    if (collaboratorId) {
      if (!mongoose.Types.ObjectId.isValid(collaboratorId)) {
        return res.status(400).json({ message: "Invalid collaboratorId" });
      }
      inviteeId = collaboratorId;
    } else if (typeof collaboratorLabel === "string" && collaboratorLabel.trim()) {
      const label = collaboratorLabel.trim();
      const matches = await User.find({
        $or: [
          { email: { $regex: `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
          { fullName: { $regex: `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
        ]
      }).select("_id").limit(2);

      if (!matches.length) {
        return res.status(404).json({ message: "Collaborator not found" });
      }
      if (matches.length > 1) {
        return res.status(400).json({ message: "Collaborator label is ambiguous. Send collaboratorId." });
      }
      inviteeId = matches[0]._id.toString();
    } else {
      return res.status(400).json({ message: "collaboratorId or collaboratorLabel is required" });
    }

    if (inviteeId.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: "Cannot invite yourself" });
    }

    const itinerary = await canAccessItinerary(req.user.id, itineraryId);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found or access denied" });
    }

    const invitee = await User.findById(inviteeId).select("_id fullName email");
    if (!invitee) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    if (itinerary.collaboratorIds.some((id) => id.toString() === invitee._id.toString())) {
      return res.status(409).json({ message: "User is already a collaborator" });
    }

    const pending = await CollaborationInvitation.findOne({
      itinerary: itinerary._id,
      invitee: invitee._id,
      status: "pending"
    });
    if (pending) {
      return res.status(409).json({ message: "Pending invitation already exists" });
    }

    const invitation = await CollaborationInvitation.create({
      itinerary: itinerary._id,
      inviter: req.user.id,
      invitee: invitee._id,
      collaboratorLabel: collaboratorLabel || invitee.email || invitee.fullName
    });

    const inviter = await User.findById(req.user.id).select("_id fullName");

    await CollaborationNotification.create({
      user: invitee._id,
      actor: req.user.id,
      type: "invite",
      title: "Collaboration invite",
      message: `${inviter?.fullName || "A user"} invited you to collaborate on an itinerary`,
      itineraryId: itinerary._id,
      invitationId: invitation._id
    });

    return res.status(201).json({
      id: invitation._id,
      itineraryId: invitation.itinerary,
      inviterId: invitation.inviter,
      inviteeId: invitation.invitee,
      status: invitation.status,
      collaboratorLabel: invitation.collaboratorLabel,
      createdAt: invitation.createdAt
    });
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.respondInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid invitation ID" });
    }
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "action must be accept or decline" });
    }

    const invitation = await CollaborationInvitation.findOne({
      _id: id,
      invitee: req.user.id
    }).populate("inviter", "_id fullName");

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(409).json({ message: "Invitation already responded" });
    }

    invitation.status = action === "accept" ? "accepted" : "declined";
    invitation.respondedAt = new Date();
    await invitation.save();

    if (action === "accept") {
      await Itinerary.findByIdAndUpdate(invitation.itinerary, {
        $addToSet: { collaboratorIds: req.user.id }
      });
    }

    const responder = await User.findById(req.user.id).select("_id fullName");

    await CollaborationNotification.create({
      user: invitation.inviter._id,
      actor: req.user.id,
      type: "system",
      title: "Invitation response",
      message: `${responder?.fullName || "A user"} ${action}ed your invitation`,
      itineraryId: invitation.itinerary,
      invitationId: invitation._id
    });

    return res.json({
      id: invitation._id,
      status: invitation.status,
      respondedAt: invitation.respondedAt
    });
  } catch (error) {
    console.error("Failed to respond to invitation:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.syncItinerary = async (req, res) => {
  try {
    const { itineraryId, name, tripDays, destinationIds, sourceUserId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(itineraryId)) {
      return res.status(400).json({ message: "Invalid itineraryId" });
    }

    if (sourceUserId && sourceUserId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "sourceUserId does not match authenticated user" });
    }

    const itinerary = await canAccessItinerary(req.user.id, itineraryId);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found or access denied" });
    }

    const edit = {};

    if (typeof name === "string") {
      itinerary.name = name.trim() || null;
      edit.name = itinerary.name;
    }

    const normalizedDays = tripDays !== undefined ? normalizeDays(tripDays) : itinerary.days;
    if (tripDays !== undefined && normalizedDays === null) {
      return res.status(400).json({ message: "tripDays must be a positive integer" });
    }

    if (tripDays !== undefined) {
      itinerary.days = normalizedDays;
      edit.tripDays = normalizedDays;
    }

    if (destinationIds !== undefined) {
      if (!Array.isArray(destinationIds)) {
        return res.status(400).json({ message: "destinationIds must be an array" });
      }

      const cleanedIds = [...new Set(destinationIds.map((id) => id?.toString()).filter(Boolean))];
      const validIds = cleanedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (cleanedIds.length !== validIds.length) {
        return res.status(400).json({ message: "destinationIds contains invalid IDs" });
      }

      const destinations = await Destination.find({
        _id: { $in: validIds },
        isActive: true
      }).select("_id estimatedCost");

      const destinationMap = new Map(destinations.map((d) => [d._id.toString(), d]));
      const itineraryDestinations = validIds
        .filter((id) => destinationMap.has(id))
        .map((id) => ({
          destination: id,
          cost: destinationMap.get(id).estimatedCost || 0
        }));

      itinerary.destinations = itineraryDestinations;
      itinerary.totalCost = itineraryDestinations.reduce((sum, item) => sum + (item.cost || 0), 0);
      edit.destinationIds = itineraryDestinations.map((item) => item.destination.toString());
    }

    const { dayPlans } = splitDestinationsByDays(itinerary.destinations, itinerary.days);
    itinerary.dayPlans = dayPlans;
    await itinerary.save();

    const actor = await User.findById(req.user.id).select("_id fullName");
    const participantIds = [itinerary.user, ...(itinerary.collaboratorIds || [])]
      .map((id) => id.toString())
      .filter((id) => id !== req.user.id.toString());

    if (participantIds.length) {
      await CollaborationNotification.insertMany(
        participantIds.map((participantId) => ({
          user: participantId,
          actor: req.user.id,
          type: "itinerary_updated",
          title: "Itinerary updated",
          message: `${actor?.fullName || "A collaborator"} updated a shared itinerary`,
          itineraryId: itinerary._id
        }))
      );
    }

    broadcastItineraryEdit({
      itineraryId: itinerary._id,
      actorId: req.user.id,
      actorName: actor?.fullName || null,
      edit,
      updatedAt: itinerary.updatedAt?.toISOString() || new Date().toISOString()
    });

    return res.json({
      ok: true,
      itinerary: {
        id: itinerary._id,
        name: itinerary.name,
        tripDays: itinerary.days,
        destinationIds: itinerary.destinations.map((item) => item.destination.toString()),
        updatedAt: itinerary.updatedAt
      }
    });
  } catch (error) {
    console.error("Failed to sync itinerary:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const mongoose = require("mongoose");
const DestinationComment = require("../models/DestinationComment");

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const deleted = await DestinationComment.findByIdAndDelete(commentId);
    if (!deleted) {
      return res.status(404).json({ message: "Comment not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCommentModeration = async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const inputStatus = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
    const action = typeof req.body?.action === "string" ? req.body.action.trim().toLowerCase() : "";

    let status = inputStatus;
    if (!status && action === "approve") status = "visible";
    if (!status && action === "hide") status = "hidden";
    if (status === "approve") status = "visible";

    if (!["visible", "hidden"].includes(status)) {
      return res.status(400).json({ message: "status must be visible or hidden" });
    }

    const comment = await DestinationComment.findByIdAndUpdate(
      commentId,
      { $set: { status } },
      { new: true }
    )
      .populate("user", "fullName email")
      .populate("destination", "name");

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    return res.json({
      id: comment._id.toString(),
      destinationId: comment.destination?._id?.toString() || null,
      destinationName: comment.destination?.name || null,
      userId: comment.user?._id?.toString() || null,
      userName: comment.user?.fullName || null,
      userEmail: comment.user?.email || null,
      body: comment.body,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const Itinerary = require("../models/Itinerary");
const User = require("../models/User");

const rooms = new Map();
let serverAttached = false;

function addClientToRoom(itineraryId, ws) {
  if (!rooms.has(itineraryId)) {
    rooms.set(itineraryId, new Set());
  }
  rooms.get(itineraryId).add(ws);
}

function removeClientFromRoom(itineraryId, ws) {
  const room = rooms.get(itineraryId);
  if (!room) return;
  room.delete(ws);
  if (!room.size) {
    rooms.delete(itineraryId);
  }
}

function broadcastToRoom(itineraryId, payload) {
  const room = rooms.get(itineraryId.toString());
  if (!room || !room.size) return;

  const raw = JSON.stringify(payload);
  room.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(raw);
    }
  });
}

async function canAccessItinerary(userId, itineraryId) {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    $or: [{ user: userId }, { collaboratorIds: userId }]
  }).select("_id");
  return Boolean(itinerary);
}

function setupCollaborationWebSocket(httpServer) {
  if (serverAttached) return;

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", async (request, socket, head) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      if (requestUrl.pathname !== "/api/collaboration/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const token = requestUrl.searchParams.get("token");
      const itineraryId = requestUrl.searchParams.get("itineraryId");

      if (!token || !itineraryId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id fullName");
      if (!user || !(await canAccessItinerary(user._id, itineraryId))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = user._id.toString();
        ws.userName = user.fullName;
        ws.itineraryId = itineraryId.toString();
        wss.emit("connection", ws);
      });
    } catch (_err) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    addClientToRoom(ws.itineraryId, ws);

    ws.on("close", () => {
      removeClientFromRoom(ws.itineraryId, ws);
    });
  });

  serverAttached = true;
}

function broadcastItineraryEdit({
  itineraryId,
  actorId,
  actorName,
  edit,
  updatedAt = new Date().toISOString()
}) {
  broadcastToRoom(itineraryId.toString(), {
    type: "itinerary_edit",
    itineraryId: itineraryId.toString(),
    actorId: actorId?.toString() || null,
    actorName: actorName || null,
    edit,
    updatedAt
  });
}

module.exports = {
  setupCollaborationWebSocket,
  broadcastItineraryEdit
};

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const Itinerary = require("../models/Itinerary");
const User = require("../models/User");
const { subscribeToSystemLogs } = require("./systemLogService");

const rooms = new Map();
const adminLogClients = new Set();
let serverAttached = false;
let unsubscribeSystemLogs = null;

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

function addAdminLogClient(ws) {
  adminLogClients.add(ws);
}

function removeAdminLogClient(ws) {
  adminLogClients.delete(ws);
}

function broadcastToAdminLogs(payload) {
  if (!adminLogClients.size) return;

  const raw = JSON.stringify(payload);
  adminLogClients.forEach((client) => {
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
  if (!unsubscribeSystemLogs) {
    unsubscribeSystemLogs = subscribeToSystemLogs((logEntry) => {
      broadcastToAdminLogs({
        type: "system_log",
        log: logEntry
      });
    });
  }

  httpServer.on("upgrade", async (request, socket, head) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      const { pathname } = requestUrl;
      const isCollaborationPath = pathname === "/api/collaboration/ws";
      const isAdminLogPath = pathname === "/api/admin/ws/logs";

      if (!isCollaborationPath && !isAdminLogPath) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const token = requestUrl.searchParams.get("token");

      if (!token) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id fullName role");
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      if (isAdminLogPath) {
        if (user.role !== "admin") {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.userId = user._id.toString();
          ws.userName = user.fullName;
          ws.userRole = user.role;
          ws.channel = "admin_logs";
          wss.emit("connection", ws);
        });
        return;
      }

      const itineraryId = requestUrl.searchParams.get("itineraryId");
      if (!itineraryId || !(await canAccessItinerary(user._id, itineraryId))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = user._id.toString();
        ws.userName = user.fullName;
        ws.itineraryId = itineraryId.toString();
        ws.channel = "collaboration";
        wss.emit("connection", ws);
      });
    } catch (_err) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    if (ws.channel === "admin_logs") {
      addAdminLogClient(ws);
      ws.send(JSON.stringify({ type: "connected", channel: "admin_logs" }));
      ws.on("close", () => {
        removeAdminLogClient(ws);
      });
      return;
    }

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

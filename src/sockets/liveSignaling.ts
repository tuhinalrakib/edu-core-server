import { Server, Socket } from "socket.io";
import { logger } from "../utils/logger";

interface Participant {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  avatar?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  joinedAt: Date;
}

// Map of classId -> Map of socketId -> Participant
const roomParticipants = new Map<string, Map<string, Participant>>();

export function registerLiveSignalingHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    let currentClassId: string | null = null;
    let currentUser: Participant | null = null;

    // 1. Join Live Classroom Room
    socket.on("live-class:join-room", (data: { classId: string; user: { id: string; name: string; role: string; avatar?: string } }) => {
      const { classId, user } = data;
      if (!classId || !user) return;

      currentClassId = classId;
      currentUser = {
        socketId: socket.id,
        userId: user.id,
        name: user.name || "Participant",
        role: user.role || "student",
        avatar: user.avatar,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date(),
      };

      socket.join(`live-room:${classId}`);

      if (!roomParticipants.has(classId)) {
        roomParticipants.set(classId, new Map());
      }
      const participantsMap = roomParticipants.get(classId)!;

      // Clean up any previous socket for the same user ID in this room to prevent duplicates
      for (const [oldSocketId, p] of participantsMap.entries()) {
        if (p.userId === user.id && oldSocketId !== socket.id) {
          participantsMap.delete(oldSocketId);
        }
      }

      participantsMap.set(socket.id, currentUser);

      const allParticipants = Array.from(participantsMap.values());

      // Send existing participants to the newly joined user
      socket.emit("live-class:existing-participants", {
        participants: allParticipants.filter((p) => p.socketId !== socket.id),
      });

      // Notify others in room that a new user joined
      socket.to(`live-room:${classId}`).emit("live-class:user-joined", {
        participant: currentUser,
        participants: allParticipants,
      });

      logger.info(`[WebRTC] User ${currentUser.name} (${currentUser.role}) joined live room ${classId}`);
    });

    // 2. WebRTC SDP Offer Relay
    socket.on("live-class:signal-offer", (data: { to: string; offer: any }) => {
      if (!data.to || !data.offer) return;
      io.to(data.to).emit("live-class:signal-offer", {
        from: socket.id,
        user: currentUser,
        offer: data.offer,
      });
    });

    // 3. WebRTC SDP Answer Relay
    socket.on("live-class:signal-answer", (data: { to: string; answer: any }) => {
      if (!data.to || !data.answer) return;
      io.to(data.to).emit("live-class:signal-answer", {
        from: socket.id,
        user: currentUser,
        answer: data.answer,
      });
    });

    // 4. ICE Candidate Relay
    socket.on("live-class:ice-candidate", (data: { to: string; candidate: any }) => {
      if (!data.to || !data.candidate) return;
      io.to(data.to).emit("live-class:ice-candidate", {
        from: socket.id,
        candidate: data.candidate,
      });
    });

    // 5. Media State Change (Mic / Camera / Screen Share Toggle)
    socket.on("live-class:media-state-change", (data: { classId: string; isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }) => {
      const { classId, isMuted, isVideoOff, isScreenSharing } = data;
      if (!classId || !currentUser) return;

      if (isMuted !== undefined) currentUser.isMuted = isMuted;
      if (isVideoOff !== undefined) currentUser.isVideoOff = isVideoOff;
      if (isScreenSharing !== undefined) currentUser.isScreenSharing = isScreenSharing;

      socket.to(`live-room:${classId}`).emit("live-class:participant-media-changed", {
        socketId: socket.id,
        userId: currentUser.userId,
        isMuted: currentUser.isMuted,
        isVideoOff: currentUser.isVideoOff,
        isScreenSharing: currentUser.isScreenSharing,
      });
    });

    // 6. Raise Hand / Lower Hand
    socket.on("live-class:raise-hand", (data: { classId: string; isRaised: boolean }) => {
      const { classId, isRaised } = data;
      if (!classId || !currentUser) return;

      currentUser.isHandRaised = isRaised;
      io.in(`live-room:${classId}`).emit("live-class:hand-raised-update", {
        socketId: socket.id,
        userId: currentUser.userId,
        userName: currentUser.name,
        isRaised,
      });
    });

    // 7. Real-Time Group Chat Message
    socket.on("live-class:chat-message", (data: { classId: string; text: string }) => {
      const { classId, text } = data;
      if (!classId || !text || !currentUser) return;

      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        senderId: currentUser.userId,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        text,
        timestamp: new Date().toISOString(),
      };

      io.in(`live-room:${classId}`).emit("live-class:new-chat-message", message);
    });

    // 8. Teacher Stream Broadcast Status (Start Live / End Session)
    socket.on("live-class:stream-status", (data: { classId: string; status: "live" | "completed" | "scheduled" }) => {
      const { classId, status } = data;
      if (!classId || !status) return;

      io.in(`live-room:${classId}`).emit("live-class:status-updated", {
        classId,
        status,
      });
    });

    // 9. Leave Room / Disconnect Handler
    const handleLeave = () => {
      if (currentClassId && currentUser) {
        const participantsMap = roomParticipants.get(currentClassId);
        if (participantsMap) {
          participantsMap.delete(socket.id);
          if (participantsMap.size === 0) {
            roomParticipants.delete(currentClassId);
          } else {
            const allParticipants = Array.from(participantsMap.values());
            socket.to(`live-room:${currentClassId}`).emit("live-class:user-left", {
              socketId: socket.id,
              userId: currentUser.userId,
              name: currentUser.name,
              participants: allParticipants,
            });
          }
        }
        socket.leave(`live-room:${currentClassId}`);
        logger.info(`[WebRTC] User ${currentUser.name} left live room ${currentClassId}`);
      }
    };

    socket.on("live-class:leave-room", handleLeave);
    socket.on("disconnect", handleLeave);
  });
}

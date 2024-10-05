const socketIo = require("socket.io");
const Messages = require("../schemas/message-schema");
const Users = require("../schemas/user-schema");
const axios = require("axios");
const userSockets = {};

let io;

function setupWebSocketServer(server) {
  io = socketIo(server, {
    cors: {
      origin: "http://localhost:4200",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log(`New WebSocket:${socket.id} connection`);

    socket.on("chat-init", async (username) => {
      try {
        if (!userSockets[username]) {
          userSockets[username] = [];
        }
        userSockets[username].push(socket);

        const chatRooms = await getChatRoomsForUser(username);
        console.log(`User registered: ${username}`);

        if (chatRooms) {
          chatRooms.forEach((roomId) => {
            const sockets = getUserSockets(socket);
            sockets.forEach((s) => {
              s.join(roomId);
            });
            console.log(`${username} joined room ${roomId}`);
          });
        }

        emitOnlineUsers();
      } catch (error) {
        console.error(`Error handling chat-init for ${username}:`, error);
        socket.emit("error", `Error handling chat-init for ${username}`);
      }
    });

    socket.on("new-chat", async (req) => {
      const fromUsername = req.from.username;
      const toUsername = req.to.username;
      const roomId = getRoomId(fromUsername, toUsername);

      const newChat = await addUsersToChatRoom(
        fromUsername,
        toUsername,
        roomId
      );
      const sockets = getUserSockets(socket);
      sockets.forEach((s) => {
        s.join(roomId);
      });

      console.log(`${fromUsername} joined room ${roomId}`);

      const recipientSocket = userSockets[toUsername];
      if (recipientSocket) {
        recipientSocket.forEach((socket) => socket.join(roomId));
        console.log(`${toUsername} joined room ${roomId}`);
      }

      const response = { ...newChat._doc, recipient: [req.to, req.from] };
      socket.to(roomId).emit("new-chat-rsp", response);
      socket.emit("new-chat-rsp", response);
    });

    socket.on("send-message", async (data) => {
      try {
        const response = await axios.post(
          "http://localhost:3000/api/save-msg",
          data,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.status === 201) {
          socket.to(data.room).emit("new-message", data);
        }
      } catch (error) {
        console.error(`Error while sending message: ${error.response.data}`);
        socket.emit("error", "Error while sending message");
      }
    });

    socket.on("delete-message", async (data) => {
      try {
        const response = await axios.get(
          `http://localhost:3000/api/delete/everyone/${data.room}/${data.message.id}`
        );

        if (response.status === 200) {
          socket
            .to(data.room)
            .emit("deleted-message", { ...response.data, room: data.room });
        }
      } catch (error) {
        console.error(`Error while deleting message: ${error.response.data}`);
        socket.emit(
          "error",
          `Error while deleting message: ${error.response.data}`
        );
      }
    });

    socket.on("typing-status", (data) => {
      socket.to(data.room).emit("typing", data);
    });

    socket.on("exit-group", async (data) => {
      try {
        const response = await axios.get(
          `http://localhost:3000/api/exit-group/${data.room}/${data.userId}`
        );

        if (response.status === 200) {
          socket.to(data.room).emit("user-exited-group", data);
          socket.emit("exited-group", data.room);
          socket.leave(data.room);
        }
      } catch (error) {
        console.error(error.response.data);
        socket.emit("error", `Error exiting group: ${error.response.data}`);
      }
    });

    socket.on("join-group", async (data) => {
      try {
        const response = await axios.post(
          `http://localhost:3000/api/join-group`,
          data,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.status === 200) {
          socket.emit("joined-group", response.data.group);
          socket.to(response.data.group.chatRoomId).emit("user-joined-group", {
            recDetails: response.data.recDetails,
            roomId: response.data.group.chatRoomId,
          });
        }
      } catch (error) {
        console.error(`Error joining group: ${error.response.data}`);
        socket.emit("error", `Error joining group: ${error.response.data}`);
      }
    });

    socket.on("read-messages", async (data) => {
      try {
        const response = await axios.get(
          `http://localhost:3000/api/set-read-status/${data.room}/${data.userId}`
        );

        if (response.status === 200) {
          socket.to(data.room).emit("rcp-read-msg", data);
        }
      } catch (error) {
        console.error(
          `Error while setting read status: ${error.response.data}`
        );
        socket.emit(
          "error",
          `Error setting read status: ${error.response.data}`
        );
      }
    });

    socket.on("disconnect", () => {
      //console.log(`WebSocket:${socket.id} connection closed`);

      Object.keys(userSockets).forEach((username) => {
        const index = userSockets[username].indexOf(socket);
        // if (index > -1) {
        //   userSockets[username].splice(index, 1);
        //   console.log(`Removed socket ${socket.id} from user ${username}`);
        //   if (userSockets[username].length === 0) {
        //     delete userSockets[username];
        //     console.log(`Deleted user ${username} from userSockets`);
        //   }
        // }

        if (index > -1) {
          delete userSockets[username];
          console.log(`Deleted user ${username} from userSockets`);
        }
      });
      emitOnlineUsers();
    });
  });
}

function getWebSocketServer() {
  return io;
}

function getUserSockets(socket) {
  let sockets;
  Object.keys(userSockets).forEach((username) => {
    const i = userSockets[username].find((s) => s.id === socket.id);

    if (i) {
      sockets = userSockets[username];
    } else {
      sockets = [socket];
    }
  });
  return sockets;
}

function emitOnlineUsers() {
  const userIds = Object.keys(userSockets).filter(
    (user) => userSockets[user].length > 0
  );
  console.log(`Online: ${userIds}`);
  io.emit("online-users", userIds);
}

async function getChatRoomsForUser(username) {
  try {
    const user = await Users.findOne({ username });
    if (!user) {
      console.error(`User ${username} not found`);
      return null;
    }
    return user.chatRooms;
  } catch (error) {
    console.error(`Error fetching chat rooms for ${username}:`, error);
    return null;
  }
}

const getRoomId = (username1, username2) => {
  const sortedUsers = [username1, username2].sort();
  return `chat:${sortedUsers[0]}:${sortedUsers[1]}`;
};

const cleanupOldMessages = async () => {
  const expirationTime = 30 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - expirationTime);
  await Messages.deleteMany({ timestamp: { $lt: cutoffDate } });
};

async function addUsersToChatRoom(userFrom, userTo, chatRoomId) {
  try {
    let user1 = await Users.findOne({ username: userFrom });
    let user2 = await Users.findOne({ username: userTo });

    [user1, user2].forEach(async (user) => {
      if (user) {
        const currentChatRoom = user.chatRooms.find(
          (roomId) => roomId === chatRoomId
        );

        if (!currentChatRoom) {
          user.chatRooms.push(chatRoomId);
          await user.save();
          console.log(`User ${user.username} added to room ${chatRoomId}`);
        }
      }
    });

    const chat = await Messages.findOne({ chatRoomId });

    if (chat) {
      return chat;
    }

    const newChat = new Messages({
      chatRoomId,
      chatType: "chat",
      messages: [],
      filter: { pinned: [], archived: [] },
      deleted: [],
    });
    await newChat.save();
    return newChat;
  } catch (error) {
    console.error("Error adding user to chat room:", error);
  }
}

module.exports = {
  setupWebSocketServer,
  getWebSocketServer,
};

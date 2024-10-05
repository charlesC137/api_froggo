const router = require("express").Router();
const Users = require("../schemas/user-schema");
const Messages = require("../schemas/message-schema");
const dayjs = require("dayjs");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const { modifyProfileImg } = require("./profile");
const { hashPassword, comparePassword } = require("../utils/password-methods");
const { group } = require("console");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, dayjs() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/save-msg", async (req, res) => {
  const { room, messageBody } = req.body;

  if (!room || !messageBody) {
    return res.status(400).json("Missing room or message body");
  }

  try {
    let messageParent = await Messages.findOne({ chatRoomId: room });
    if (!messageParent) {
      messageParent = new Messages({
        chatRoomId: room,
        chatType: "chat",
        messages: [],
        filter: { pinned: [], archived: [] },
        deleted: [],
      });
    }

    messageParent.deleted = [];
    messageParent.messages.push(messageBody);
    await messageParent.save();
    res.status(201).json("Message uploaded successfully");
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json("Error saving message to the database");
  }
});

router.get("/get-chats", async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json("User not authorized");
  }

  try {
    const user = await Users.findById(userId);

    if (!user) {
      return res.status(404).json("User not found");
    }

    const chatPromises = user.chatRooms.map(async (roomId) => {
      const chat = await Messages.findOne({ chatRoomId: roomId });
      if (!chat) {
        const i = user.chatRooms.indexOf(roomId);
        user.chatRooms.splice(i, 1);
        return null;
      }

      chat.messages.forEach((message) => {
        if (
          message.sender.id === userId &&
          message.sendStatus.status !== "read"
        ) {
          message.sendStatus.status = "received";
        }
      });

      await chat.save();

      if (chat.chatType === "group" || chat.recipient.length > 1) {
        return chat;
      }

      const recipientUsername = getUsernameFromChatRoom(roomId, user.username);
      const recipient = recipientUsername
        ? await Users.findOne({ username: recipientUsername })
        : null;

      if (chat && recipient) {
        chat._doc = {
          ...chat._doc,
          recipient: [
            { username: recipient.username, id: recipient._id },
            { username: user.username, id: user._id },
          ],
        };
        await chat.save();
        return chat;
      } else {
        return null;
      }
    });

    const chats = (await Promise.all(chatPromises)).filter(Boolean);
    await user.save();

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json("Error fetching chats");
  }
});

router.get("/get-all-users", async (req, res) => {
  const id = req.session.userId;

  if (!id) {
    return res.status(401).json("User not authorized");
  }

  try {
    const users = await Users.find({});

    if (!users) {
      return res.status(404).json("Users not found");
    }

    const mappedUsers = users.map((user) => ({
      id: user._id,
      username: user.username,
    }));

    res.status(200).json(mappedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json("Failed to fetch all users");
  }
});

router.get("/delete/:form/:chatRoomId/:msgId?/:username?", async (req, res) => {
  const { chatRoomId, form, username } = req.params;
  const msgId = parseInt(req.params.msgId);

  if (!msgId && (form === "everyone" || form === "for-user")) {
    return res.status(400).json("Message id required");
  }

  try {
    const chat = await Messages.findOne({ chatRoomId });

    if (!chat) {
      return res.status(404).json("Chat not found");
    }

    const messageSpec = chat.messages.find((message) => {
      return message.id === msgId;
    });

    if (!messageSpec && (form === "everyone" || form === "for-user")) {
      return res.status(404).json("Message not found");
    }

    if (form === "everyone") {
      messageSpec.deleteState.forEveryone = true;
      messageSpec.message = "";
      messageSpec.sendTime = dayjs().format("hh:mm A");
    } else if (form === "for-user" && username) {
      messageSpec.deleteState.forMe.push(username);
      if (messageSpec.deleteState.forMe.length === 2) {
        const index = chat.messages.findIndex(
          (message) => message.id === messageSpec.id
        );
        chat.messages.splice(index, 1);
      }
    } else if (form === "clear" && username) {
      chat.messages.forEach((message) => {
        message.deleteState.forMe.push(username);
      });
    } else if (form === "delete-chat" && username) {
      chat.messages.forEach((message) => {
        message.deleteState.forMe.push(username);
      });
      chat.deleted.push(username);
    } else {
      return res.status(400).json("Invalid delete request format");
    }

    await chat.save();
    res.status(200).json(messageSpec);
  } catch (error) {
    console.error(error);
    res.status(500).json("Error deleting message");
  }
});

router.get("/filter/:roomId/:filter/:id", async (req, res) => {
  const chatRoomId = req.params.roomId;
  const filter = req.params.filter;
  const userId = req.params.id;

  if (!chatRoomId || !filter || !userId) {
    return res.status(400).json("Invalid Request Format");
  }

  try {
    const chat = await Messages.findOne({ chatRoomId });

    if (!chat) {
      return res.status(404).json("Chat Not Found");
    }

    const oppositeFilter = filter === "pinned" ? "archived" : "pinned";
    const oppositeArray = chat.filter[oppositeFilter];

    if (oppositeArray.includes(userId)) {
      const oppositeIndex = oppositeArray.indexOf(userId);
      oppositeArray.splice(oppositeIndex, 1);
    }

    const currentArray = chat.filter[filter];
    const index = currentArray.indexOf(userId);

    if (index > -1) {
      currentArray.splice(index, 1);
    } else {
      currentArray.push(userId);
    }

    await chat.save();
    res.status(200).json(`user:${userId} has ${filter} set successfully`);
  } catch (error) {
    console.error(error);
    res.status(500).json("Error Setting Filter");
  }
});

router.get("/set-read-status/:roomId/:userId", async (req, res) => {
  const userId = req.params.userId;
  const chatRoomId = req.params.roomId;

  if (!chatRoomId || !userId) {
    return res.status(400).json("Invalid request format");
  }

  try {
    const chat = await Messages.findOne({ chatRoomId });

    if (!chat) {
      return res.status(404).json("Chat not found");
    }

    chat.messages.forEach((message) => {
      if (message.sender.id !== userId) {
        message.sendStatus.status = "read";
      }
    });

    await chat.save();
    res.status(200).json(chat);
  } catch (error) {
    console.error(error);
    return res.status(500).json("Error setting read status");
  }
});

router.post(
  "/create-group",
  upload.single("image"),
  async (req, res, next) => {
    await modifyProfileImg(req, res, "group", next);
  },
  async (req, res) => {
    const { name, description, form, password } = req.body;
    const id = req.session.userId;

    if (!id) {
      return res.status(401).json("User not authenticated");
    }

    if (form !== "public" && form !== "private") {
      return res.status(400).json("Invalid group form");
    }

    try {
      const existingGroup = await Messages.findOne({
        "groupDetails.name": name,
      });

      if (existingGroup) {
        return res.status(400).json("Group Aready Exists");
      }

      const user = await Users.findById(id);

      if (!user) {
        return res.status(404).json("User not found");
      }

      const newGroup = new Messages({
        chatRoomId: `group-${req.groupId}`,
        chatType: "group",
        messages: [],
        filter: { pinned: [], archived: [] },
        deleted: [],
        groupDetails: {
          name,
          description,
          form,
          password: password ? hashPassword(password) : "",
          createdAt: dayjs().format("D MMM YYYY [at] h:mm a"),
          createdBy: user.username,
          admins: [id],
        },
        recipient: [{ id, username: user.username, typing: false }],
      });

      await newGroup.save();
      user.chatRooms.push(`group-${req.groupId}`);
      await user.save();
      res.status(200).json(newGroup);
    } catch (error) {
      console.error(error);
      return res.status(500).json("Error creating group");
    }
  }
);

router.post("/join-group", async (req, res) => {
  const { userId, groupId, password } = req.body;

  try {
    const group = await Messages.findOne({ chatRoomId: groupId });
    const user = await Users.findOne({ _id: userId });

    const hasJoined = group.recipient.find((r) => r.id === userId);

    if (hasJoined) {
      return res.status(400).json("User has already joined");
    }

    if (!group) {
      return res.status(404).json("Group not found");
    }

    if (!user) {
      return res.status(404).json("User not found");
    }

    if (
      group.groupDetails.form !== "public" &&
      group.groupDetails.form !== "private"
    ) {
      return res.status(400).json("Invalid group form");
    }

    if (group.groupDetails.form === "private") {
      if (
        !password ||
        !comparePassword(password, group.groupDetails.password)
      ) {
        return res.status(401).json("Incorrect password");
      }
    }

    const recDetails = { username: user.username, id: userId };

    group.recipient.push(recDetails);
    user.chatRooms.push(groupId);
    await user.save();
    await group.save();
    return res.status(200).json({ group, recDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json(`Error Joining Group: ${error}`);
  }
});

router.get("/exit-group/:roomId/:userId", async (req, res) => {
  const { roomId, userId } = req.params;

  if (!roomId && !userId) {
    return res.status(400).json("Invalid request format");
  }

  try {
    const groupChat = await Messages.findOne({ chatRoomId: roomId });

    if (!groupChat) {
      return res.status(404).json("Group not found");
    }

    const recipientIndex = groupChat.recipient.findIndex(
      (r) => r.id === userId
    );
    if (recipientIndex === -1) {
      return res.status(404).json("Recipient not found");
    }

    groupChat.recipient.splice(recipientIndex, 1);

    if (groupChat.recipient.length === 0) {
      await Messages.deleteOne({ chatRoomId: groupChat.chatRoomId });
    } else {
      await groupChat.save();
    }

    const user = await Users.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json("User not found");
    }

    const chatRoomIndex = user.chatRooms.indexOf(roomId);
    if (chatRoomIndex !== -1) {
      user.chatRooms.splice(chatRoomIndex, 1);
      await user.save();
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    return res.status(500).json("Error exiting group");
  }
});

function getUsernameFromChatRoom(roomId, currentUser) {
  const [_, user1, user2] = roomId.split(":");
  if (user1 && user2) {
    return user1 === currentUser ? user2 : user2 === currentUser ? user1 : null;
  }
  return null;
}

module.exports = router;

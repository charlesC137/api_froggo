const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema({
  chatRoomId: { type: String, required: true },
  chatType: { type: String, required: true },
  messages: [
    {
      id: Number,
      message: String,
      sender: {
        name: String,
        id: String,
      },
      deleteState: {
        forMe: [String],
        forEveryone: Boolean,
      },
      sendStatus: { status: String, sendTime: String },
      reply: {
        id: String,
        name: String,
        time: String,
        message: String,
      },
    },
  ],
  filter: {
    pinned: [String],
    archived: [String],
  },
  deleted: [String],
  groupDetails: {
    name: String,
    password: String,
    form: String,
    description: String,
    createdAt: String,
    createdBy: String,
    admins: [String],
  },
  recipient: [{ username: String, id: String }],
});

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;

const mongoose = require("mongoose");

const UserSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String, required: true },
  location: { type: String },
  lastLogin: { type: String },
  bookmarks: [{ type: String }],
  bio: { type: String },
  chatRooms: [String],
});

const User = mongoose.model("Users", UserSchema);

module.exports = User;

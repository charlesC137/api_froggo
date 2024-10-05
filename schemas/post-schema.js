const mongoose = require("mongoose");

const PostSchema = mongoose.Schema({
  category: { type: String, required: true },
  title: { type: String, required: true },
  postDate: { type: String, required: true },
  postContent: { type: String, required: true },
  postQuote: {
    quote: { type: String, required: true },
    quoter: { type: String, required: true },
  },
  comments: [
    {
      userId: { type: String },
      username: { type: String },
      date: { type: String },
      comment: { type: String },
    },
  ],
  likeCount: [{ type: String }],
  viewCount: { type: Number },
  createdAt: { type: Number },
});

const Post = mongoose.model("Post", PostSchema);

module.exports = Post;

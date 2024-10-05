const router = require("express").Router();
const PostModule = require("../schemas/post-schema");
const UserModule = require("../schemas/user-schema");
const today = require("dayjs")();

router.get("/post/:id", async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    const post = await PostModule.findOne(filter);
    if (post) {
      const newViewCount = post.viewCount + 1;
      await PostModule.updateOne(filter, { $set: { viewCount: newViewCount } });
      res.status(200).json(post);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

router.post("/post-comment", async (req, res) => {
  const { comment, postId } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json("User not authenticated");
  }

  if (!postId) {
    res.status(404).json("Invalid post id");
  }

  class Comment {
    constructor(username, comment, date, id) {
      this.username = username;
      this.comment = comment;
      this.date = date;
      this.userId = id;
    }
  }

  const user = await UserModule.findOne({ _id: userId });

  if (!user) {
    res.status(404).json("User not found");
  }

  const postDate = today.format("D MMMM, YYYY");

  const newComment = new Comment(user.username, comment, postDate, user._id);

  const post = await PostModule.findOne({ _id: postId });

  const userComments = post.comments.filter(
    (comment) => comment.username === user.username
  );
  if (userComments.length >= 3) {
    return res
      .status(403)
      .json(
        "You have reached the maximum number of comments allowed for this post"
      );
  }

  post.comments.push(newComment);

  const update = { $set: { comments: post.comments } };

  await PostModule.updateOne({ _id: postId }, update);

  res.status(201).json(post.comments);
});

router.get("/post-bookmark/:id/:form?", async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;
  const getType = req.params.form;

  if (!postId || !userId) {
    return res.status(400).json("Invalid request parameters");
  }

  try {
    const post = await PostModule.findOne({ _id: postId });
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const user = await UserModule.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json("User not found");
    }

    const hasBookmarked = user.bookmarks.includes(postId);

    if (getType === "includes") {
      return res.status(200).json(hasBookmarked);
    }

    if (hasBookmarked) {
      user.bookmarks = user.bookmarks.filter((bookmark) => bookmark !== postId);
      await UserModule.updateOne(
        { _id: userId },
        { $set: { bookmarks: user.bookmarks } }
      );
      return res.status(200).json("Bookmark removed");
    } else {
      user.bookmarks.push(postId);
      await UserModule.updateOne(
        { _id: userId },
        { $set: { bookmarks: user.bookmarks } }
      );
      return res.status(201).json("Bookmark added");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json("Internal server error");
  }
});

router.get("/post-like/:id/:form?", async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;
  const getType = req.params.form;

  if (!postId || !userId) {
    return res.status(400).json("Invalid request parameters");
  }

  try {
    const post = await PostModule.findOne({ _id: postId });
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const hasLiked = post.likeCount.includes(userId);

    if (getType === "includes") {
      return res.status(200).json(hasLiked);
    }

    if (hasLiked) {
      post.likeCount = post.likeCount.filter((id) => id !== userId);
      await PostModule.updateOne(
        { _id: postId },
        { $set: { likeCount: post.likeCount } }
      );
      return res.status(200).json("Bookmark removed");
    } else {
      post.likeCount.push(userId);
      await PostModule.updateOne(
        { _id: postId },
        { $set: { likeCount: post.likeCount } }
      );
      return res.status(201).json("Bookmark added");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json("Internal server error");
  }
});

module.exports = router;

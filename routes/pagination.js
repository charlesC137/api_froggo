const router = require("express").Router();
const PostModel = require("../schemas/post-schema");
const UserModel = require("../schemas/user-schema");

router.get("/page/:category/:num", async (req, res) => {
  let pageNo = parseInt(req.params.num);
  const category = req.params.category;
  const postsPerPage = 4;
  let skip;

  try {
    const query = category === "all" ? {} : { category };
    const totalCount = await PostModel.countDocuments(query);

    if (pageNo > totalCount || pageNo === 0) {
      skip = 0;
    } else {
      skip = (pageNo - 1) * postsPerPage;
    }

    const posts = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(postsPerPage);
    const postPageCount = Math.ceil(totalCount / postsPerPage);

    res.status(200).json({ posts, postPageCount });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json("Error fetching posts. Please try again later.");
  }
});

router.get("/trending-posts", async (req, res) => {
  try {
    const postsDb = await PostModel.find({}).sort({ viewCount: -1 }).limit(5);
    let rank = 1;
    const posts = postsDb.map((post) => ({
      id: post._id,
      category: post.category,
      title: post.title,
      date: post.postDate,
      rank: rank++,
    }));
    res.status(200).json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json("Error getting trending posts");
  }
});

router.get("/bookmarks/:num", async (req, res) => {
  const pageNo = parseInt(req.params.num, 10);
  const postsPerPage = 4;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (isNaN(pageNo) || pageNo <= 0) {
    return res.status(400).json({ error: "Invalid page number" });
  }

  try {
    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found", username: user.username });
    }

    const totalCount = user.bookmarks.length;

    const skip = (pageNo - 1) * postsPerPage;

    const bookmarkPosts = await Promise.all(
      user.bookmarks.slice(skip, skip + postsPerPage).map(async (id) => {
        const post = await PostModel.findOne({ _id: id });
        return post;
      })
    );

    const postPageCount = Math.ceil(totalCount / postsPerPage);

    res
      .status(200)
      .json({ bookmarkPosts, postPageCount, username: user.username });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res
      .status(500)
      .json({ error: "Error fetching posts. Please try again later." });
  }
});

module.exports = router;

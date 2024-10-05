const router = require("express").Router();
const PostModule = require("../schemas/post-schema");
const CategoryModule = require("../schemas/category-schema");
const dayjs = require("dayjs");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, dayjs() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post(
  "/post-blog",
  upload.fields([
    { name: "postImage", maxCount: 1 },
    { name: "featuredImage", maxCount: 1 },
  ]),
  generatePostObj,
  async (req, res) => {
    try {
      if (
        !req.files ||
        !req.files["postImage"] ||
        !req.files["featuredImage"]
      ) {
        return res
          .status(400)
          .send("Both postImage and featuredImage are required.");
      }

      const postImage = req.files["postImage"][0];
      const featuredImage = req.files["featuredImage"][0];

      const resizedPostImageBuffer = await sharp(postImage.path)
        .toFormat("jpg")
        .resize({ width: 1080 })
        .toBuffer();

      await sharp(resizedPostImageBuffer).toFile(
        `./public/images/posts/post-${req.postId}${path.extname(
          postImage.originalname
        )}`
      );

      const resizedFeaturedImageBuffer = await sharp(featuredImage.path)
        .toFormat("jpg")
        .resize({ width: 1080 })
        .toBuffer();

      await sharp(resizedFeaturedImageBuffer).toFile(
        `./public/images/posts/featured-${req.postId}${path.extname(
          featuredImage.originalname
        )}`
      );

      fs.unlinkSync(postImage.path);
      fs.unlinkSync(featuredImage.path);

      res.status(200).send("Files uploaded and resized successfully.");
    } catch (error) {
      console.error("Error processing files:", error);
      res.status(500).send("Error processing files.");
    }
  }
);

async function generatePostObj(req, res, next) {
  const {
    body: { category, title, postContent },
  } = req;

  class PostClass {
    constructor(category, title, postDate, postContent, postQuote) {
      this.category = category;
      this.title = title;
      this.postDate = postDate;
      this.postContent = postContent;
      this.postQuote = postQuote;
      this.comments = [];
      this.likeCount = [];
      this.viewCount = 0;
      this.createdAt = Date.now();
    }
  }

  const date = dayjs().format("MMMM D, YYYY");

  const postQuoteJson = await fetch("https://api.adviceslip.com/advice", {
    cache: "no-cache",
  });
  const postQuote = await postQuoteJson.json();

  const newPost = new PostModule(
    new PostClass(
      category.toLowerCase(),
      title.toLowerCase(),
      date,
      postContent,
      { quote: postQuote.slip.advice, quoter: "Unknown" }
    )
  );

  req.postId = newPost._id;

  try {
    await newPost.save();

    const filter = { name: category.toLowerCase() };

    const categoryS = await CategoryModule.findOne(filter);
    categoryS.posts.push(newPost._id);

    const update = { $set: { posts: categoryS.posts } };

    await CategoryModule.updateOne(filter, update);
  } catch (error) {
    console.error(error);
    res.status(500).json("Error saving new post");
  }

  next();
}

module.exports = router;

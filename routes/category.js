const router = require("express").Router();
const CategorySchema = require("../schemas/category-schema");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const dayjs = require("dayjs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, dayjs() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get("/category-list", async (req, res) => {
  const categories = await CategorySchema.find({});
  const categoryNames = categories.map((category) => category.name);
  res.status(200).json(categoryNames);
});

router.get("/fetch-categories", async (req, res) => {
  try {
    const categories = await CategorySchema.find({});
    const categoryDetails = categories.map((category) => ({
      name: category.name,
      postCount: category.posts.length,
    }));
    res.status(200).json(categoryDetails);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .json({ error: "Error fetching categories. Please try again later." });
  }
});

router.post("/add-category", upload.single("image"), async (req, res) => {
  const {
    body: { name },
  } = req;

  const newCategory = new CategorySchema({
    name,
    posts: [],
  });

  try {
    await newCategory.save();
  } catch (err) {
    console.error(err);
  }
  try {
    const categoryImage = req.file;

    const resizedCategoryImageBuffer = await sharp(categoryImage.path)
      .toFormat("jpg")
      .resize({ width: 1080 })
      .toBuffer();

    await sharp(resizedCategoryImageBuffer).toFile(
      `./public/images/categories/${name}${path.extname(
        categoryImage.originalname
      )}`
    );

    fs.unlinkSync(categoryImage.path);

    res.status(200).send("File uploaded and resized successfully.");
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send("Error processing file.");
  }
});

module.exports = router;

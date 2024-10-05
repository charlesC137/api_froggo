const router = require("express").Router();
const UserModel = require("../schemas/user-schema");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");
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

router.get("/fetch-profile/:id/:username?", async (req, res) => {
  const id = req.params.id || req.session.userId;
  const returnUsername = req.params.username;

  if (!id) {
    return res.status(404).json("No id provided");
  }

  try {
    const user = await UserModel.findOne({ _id: id });

    if (!user) {
      return res.status(404).json("User not found");
    }

    const uid = user._id.toString();

    if (returnUsername) {
      return res.status(200).json(user.username);
    }

    if (uid === req.session.userId) {
      const { password, bookmarks, __v, ...userResponse } = user.toObject();
      return res.status(200).json({ userResponse, isCurrentUser: true });
    } else if (uid === req.params.id) {
      const { password, bookmarks, __v, lastLogin, ...userResponse } =
        user.toObject();
      return res.status(200).json({ userResponse, isCurrentUser: false });
    } else {
      return res.status(500).json("An error has occured. Try again later");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("An error has occured. Try again later");
  }
});

router.get("/fetch-pic/:type/:id", (req, res) => {
  const { type, id } = req.params;

  if (type !== "profile" && type !== "group") {
    return res.status(400).json({ error: "Invalid type parameter" });
  }

  const baseImagePath = path.join(
    __dirname,
    "..",
    "public",
    "images",
    "profiles"
  );
  const fileName = `${id}.jpg`;
  const profilePicPath = path.join(baseImagePath, fileName);
  const defaultPicPath = path.join(
    baseImagePath,
    type === "profile" ? "default.png" : "group-default.png"
  );

  fs.access(profilePicPath, fs.constants.F_OK, (err) => {
    if (err) {
      res.sendFile(defaultPicPath);
    } else {
      res.sendFile(profilePicPath);
    }
  });
});

router.post(
  "/update-profile",
  upload.single("profile-pic"),
  async (req, res, next) => {
    await modifyProfileImg(req, res, "profile", next);
  },
  async (req, res) => {
    const { gender, bio, location } = req.body;
    const id = req.session.userId;
    if (!id) {
      return res.status(401).json("User not authenticated");
    }
    try {
      const user = await UserModel.findOne({ _id: id });

      if (!user) {
        return res.status(404).json("User not found");
      }

      const update = {
        $set: {
          gender,
          bio,
          location,
        },
      };

      try {
        await UserModel.updateOne({ _id: id }, update);
        res.sendStatus(200);
      } catch (error) {
        console.error(error);
        res.status(500).json("Error Updating Profile");
      }
    } catch (error) {
      console.error(error);
      res.status(500).json("Error updating user profile");
    }
  }
);

router.get("/log-out", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out.");
    }
  });
  res.clearCookie("connect.sid");
  res.sendStatus(200);
});

async function modifyProfileImg(req, res, form, next) {
  const userId = req.session.userId;
  const groupId = `${req.session.userId}-${Date.now()}`;
  req.groupId = groupId;

  if (!userId) {
    return res.status(401).json("User not authenticated");
  }

  try {
    if (!req.file) {
      return next();
    }

    const profileImg = req.file;

    const newProfileImgPath =
      form === "profile"
        ? path.join(__dirname, `../public/images/profiles/${userId}.jpg`)
        : path.join(
            __dirname,
            `../public/images/profiles/group-${groupId}.jpg`
          );

    if (fs.existsSync(newProfileImgPath)) {
      fs.unlinkSync(newProfileImgPath);
    }

    const resizedProfileImgBuffer = await sharp(profileImg.path)
      .toFormat("jpg")
      .resize({ width: 320 })
      .toBuffer();

    await sharp(resizedProfileImgBuffer).toFile(newProfileImgPath);

    fs.unlinkSync(profileImg.path);

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json("Error modifying image");
  }
}

module.exports = { router, modifyProfileImg };

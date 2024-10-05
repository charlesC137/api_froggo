const Router = require("express").Router;
const router = Router();
const User = require("../schemas/user-schema");
const { hashPassword } = require("../utils/password-methods");

class UserObj {
  constructor(email, password, username, defaultBio) {
    this.email = email;
    this.password = password;
    this.username = username;
    this.gender = "Other";
    this.location = "";
    this.lastLogin = "";
    this.bookmark = [];
    this.bio = defaultBio;
    this.chatRooms = [];
  }
}

router.get("/sign-up", (req, res) => {
  res.sendStatus(200);
});

router.post("/sign-up", async (req, res) => {
  const {
    body: { emailValue, usernameValue, passwordValue },
  } = req;

  let errorMessage;

  const defaultBio = `Hi there!  I’m excited to join this community and start sharing my thoughts. I’m new here, but I’m looking forward to exploring and contributing to this amazing blog. I’m passionate about a lot and I’m eager to connect with others who share these interests. Feel free to reach out if you want to chat or collaborate on something interesting. Here’s to new beginnings and great conversations!`;

  try {
    const newUser = new User(
      new UserObj(
        emailValue,
        hashPassword(passwordValue),
        usernameValue,
        defaultBio
      )
    );
    await newUser.save();
    res.sendStatus(200);
  } catch (error) {
    if (error.name === "MongoServerError" && error.code === 11000) {
      if (error.keyPattern && error.keyValue) {
        const fieldName = Object.keys(error.keyPattern)[0];
        if (fieldName === "email") {
          errorMessage = "Email already in use";
        } else if (fieldName === "username") {
          errorMessage = "Username already in use";
        } else {
          errorMessage =
            "An error occured. Please refresh or try again later to sign up";
        }
      } else {
        errorMessage =
          "An error occured. Please refresh or try again later to sign up";
      }
    } else {
      errorMessage =
        "An error occured. Please refresh or try again later to sign up";
    }
  }
  res.status(400).json(errorMessage);
});

module.exports = router;

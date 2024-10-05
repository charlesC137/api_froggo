const Router = require("express").Router;
const router = Router();
const UserModel = require("../schemas/user-schema");
const hashMethods = require("../utils/password-methods");
const today = require("dayjs")();

router.get("/log-in", (req, res) => {
  res.sendStatus(200);
});

router.post("/log-in", async (req, res) => {
  const {
    body: { userInputValue, passwordValue },
  } = req;

  let user;
  let errorMessage;

  try {
    user = await UserModel.findOne({
      $or: [{ username: userInputValue }, { email: userInputValue }],
    });

    if (user) {
      if (hashMethods.comparePassword(passwordValue, user.password)) {
        req.session.userId = user._id;
        const loginTime = today.format("D MMMM YYYY HH:mm");

        await UserModel.updateOne(
          { _id: req.session.userId },
          { $set: { lastLogin: loginTime } }
        );
        res.sendStatus(200);
      } else {
        errorMessage = "Incorrect Password";
        res.status(400).json(errorMessage);
      }
    } else {
      errorMessage = "User not found";
      res.status(404).json(errorMessage);
    }
  } catch (err) {
    errorMessage = "Error logging user in. Refresh or try again later";
    res.status(400).json(errorMessage);
  }
});

module.exports = router;

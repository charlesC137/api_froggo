const Router = require("express").Router;
const router = Router();
const AdminModel = require("../schemas/admin-schema");
const hashMethods = require("../utils/password-methods");

router.get("/admin-log-in", (req, res) => {
  res.sendStatus(200);
});

router.post("/admin-log-in", async (req, res) => {
  const {
    body: { userInputValue, passwordValue },
  } = req;

  let user;
  let errorMessage;

  try {
    user = await AdminModel.findOne({
      $or: [{ username: userInputValue }, { email: userInputValue }],
    });

    if (user) {
      if (hashMethods.comparePassword(passwordValue, user.password)) {
        req.session.adminId = user._id;
        res.sendStatus(200);
      } else {
        errorMessage = "Incorrect Password";
        res.status(400).json(errorMessage);
      }
    } else {
      errorMessage = "Admin not found";
      res.status(404).json(errorMessage);
    }
  } catch (err) {
    errorMessage = "Error logging admin in. Refresh or try again later";
    res.status(400).json(errorMessage);
  }
});

module.exports = router;

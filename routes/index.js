const router = require("express").Router();

const logInRouter = require("./log-in");
const signUpRouter = require("./sign-up");
const checkAuthStatusRouter = require("./checkAuthStat");
const addPostRouter = require("./add-post");
const categoryRouter = require("./category");
const adminLoginRouter = require("./admin-login");
const paginationRouter = require("./pagination");
const searchRouter = require("./search");
const postRouter = require("./post");
const profileRouter = require("./profile").router;
const messagingRouter = require("./messaging");

router.use("/api", logInRouter);
router.use("/api", signUpRouter);
router.use("/api", checkAuthStatusRouter);
router.use("/api", addPostRouter);
router.use("/api", categoryRouter);
router.use("/api", adminLoginRouter);
router.use("/api", paginationRouter);
router.use("/api", searchRouter);
router.use("/api", postRouter);
router.use("/api", profileRouter);
router.use("/api", messagingRouter);

module.exports = router;

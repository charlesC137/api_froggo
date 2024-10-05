const router = require("express").Router();

router.get("/check-auth-status", (req, res) => {
  if (req.session.userId) {
    res.status(200).json(req.session.userId);
  } else {
    res.status(200).json(false);
  }
});

router.get("/check-admin-status", (req, res) => {
  if (req.session.adminId) {
    res.status(200).json(req.session.adminId);
  } else {
    res.status(200).json(false);
  }
});

module.exports = router;

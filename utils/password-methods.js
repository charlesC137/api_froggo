const bcrypt = require("bcryptjs");

const saltRounds = 10;

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
}
function comparePassword(plain, hashed) {
  return bcrypt.compareSync(plain, hashed);
}

module.exports = { hashPassword, comparePassword };

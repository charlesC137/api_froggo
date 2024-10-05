const express = require("express");
const app = express();
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const session = require("express-session");
const path = require("path");
const { setupWebSocketServer } = require("./routes/websocket");

require("dotenv").config(); // allows you to use process.env

const routes = require("./routes/index");

const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.options("/api/*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.send();
});

//the above app.use / app.options allow for CORS requests

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 })
  .then(() => console.log("Connected to database"))
  .catch((err) => console.log(`Error: ${err}`));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); //for parsing requests made to the server
app.use(express.json()); // same as above. to be safe use both
app.use(
  session({
    secret: process.env.SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 86400000 * 3, sameSite: "None", secure: false }, //samesite can be lax
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      ttl: 86400000 * 3,
    }),
  })
);
app.use(routes);

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.get("/api/image/:folder/:name", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "images",
      req.params.folder,
      `${req.params.name}.jpg`
    )
  );
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

setupWebSocketServer(
  app.listen(8080, () => {
    console.log(`Socket is listening on port 8080`);
  })
);

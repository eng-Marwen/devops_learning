let express = require("express");
let path = require("path");
let mongoose = require("mongoose");
let bodyParser = require("body-parser");
let app = express();

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

// MongoDB connection
let mongoUrlLocal =
  "mongodb://admin:password@localhost:27017/user_account?authSource=admin";

mongoose
  .connect(mongoUrlLocal, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// User Schema
const userSchema = new mongoose.Schema({
  userid: { type: Number, required: true, unique: true },
  name: String,
  email: String,
  interests: String,
});

const User = mongoose.model("User", userSchema);

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/update-profile", async function (req, res) {
  try {
    let userObj = req.body;
    userObj.userid = 1;

    const user = await User.findOneAndUpdate({ userid: 1 }, userObj, {
      upsert: true,
      new: true,
    });

    console.log("Profile updated successfully");
    res.send(userObj);
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).send({ error: "Database operation failed" });
  }
});

app.get("/get-profile", async function (req, res) {

  try {
    const user = await User.findOne({ userid: 1 });
    console.log("Profile from DB:", user);

    res.send(
      user
        ? user
        : {
            name: "Anna Smith",
            email: "anna.smith@example.com",
            interests: "coding",
          }
    );
  } catch (err) {
    console.error("Query error:", err.message);
    res.send({
      name: "Anna Smith",
      email: "anna.smith@example.com",
      interests: "coding",
    });
  }
});

app.listen(3000, function () {
  console.log("app listening on port 3000!");
});

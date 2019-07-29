require("dotenv").config();
const express = require("express");
const app = express();
const socket = require("socket.io");
const MongoClient = require("mongodb").MongoClient;

MongoClient.connect(process.env.DB_HOST).then(client => {
  const db = client.db(process.env.DB_NAME);
  
}).catch(err => {
  console.log(err);
  throw err;
})

app.use(express.json());

app.get("/", (req, res) => {
  res.send(process.env);
});
app.post("/assistant", (req, res) => {
  res.send(req.body);
});

const server = app.listen(5000, () => {
  console.log("server is running on port");
});
const io = socket(server, {pingTimeout: 30000}); // consider increasing pingTimeout
io.on("connection", socket => {
  console.log("connected "+socket.id);
  io.emit("test", "heyy");
  setTimeout(() => {
    io.emit("test", "10 seconds later");
  }, 10000);
  socket.on("disconnect", () => {
    console.log("disconnected "+socket.id);
  });
});
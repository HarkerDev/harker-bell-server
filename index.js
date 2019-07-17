require("dotenv").config();
const app = require("express")();
const socket = require("socket.io");
const MongoClient = require("mongodb").MongoClient;

console.log("DB_URL: "+process.env.DB_URL);
MongoClient.connect(process.env.DB_URL).then(client => {
  const db = client.db(process.env.DB_NAME);
  
}).catch(err => {
  console.log(err);
  throw err;
})

app.get("/", (req, res) => {
  res.send("YAY IT WORKY");
});
app.post("/assistant", (req, res) => {
  
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
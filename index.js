require("dotenv").config();
const app=require("express")();
const socket=require("socket.io");

app.get("/", (req, res)=>{
  res.send("YAY IT WORKY");
});
const server=app.listen(process.env.PORT, ()=>{
  console.log("server is running on port");
});
const io=socket(server, {pingTimeout: 30000}); // consider increasing pingTimeout
io.on("connection", socket=>{
  console.log("connected "+socket.id);
  io.emit("test", "heyy");
  setTimeout(()=>{
    io.emit("test", "10 seconds later");
  }, 10000);
  socket.on("disconnect", ()=>{
    console.log("disconnected "+socket.id);
  });
});
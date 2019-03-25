const app=require("express")();
const http=require("http").Server(app);
const io=require("socket.io")(http);

app.get("/", (req, res)=>{
  
});
app.listen(5000, ()=>{
  console.log("server is running on port");
});
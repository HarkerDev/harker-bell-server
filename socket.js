const socket = require("socket.io");

/** @type {SocketIO.Server} */
var io;
async function connect(server) {
  try {
    io = socket(server, {
      pingTimeout: 10000, // consider increasing pingTimeout
      pingInterval: 10000,
      origins: [
        "https://harker-bell.netlify.com:443",
        "https://bell.harker.org:443",
        "http://localhost:8080",
        "http://192.168.1.209:8080",
      ]
    });
  } catch (err) {
    throw err;
  }
  return io;
}
function get() {
  return io;
}

module.exports = {get, connect};
const socket = require("socket.io");

/** @type {SocketIO.Server} */
var io;
async function connect(server) {
  try {
    io = socket(server, {
      pingTimeout: 10000, // consider increasing pingTimeout
      pingInterval: 10000,
      origins: [
        "bell.harker.org:443",
        "bell.harker.org:80",
        "*harker-bell.netlify.com:443",
        "*harker-bell.netlify.com:80",
        "localhost:8080",
        "localhost:8081",
        "192.168.1.209:8080",
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
const socket = require("socket.io");

/** @type {SocketIO.Server} */
var io;
async function connect(server) {
  io = socket(server, {
    pingTimeout: 15000, // consider increasing pingTimeout
    pingInterval: 25000,
    origins: [
      "bell.harker.org:443",
      "bell.harker.org:80",
      "harker-bell.netlify.com:443",
      "harker-bell.netlify.com:80",
      "localhost:8080",
      "localhost:8081",
      "192.168.1.209:8080",
      "8080-d496a659-a8ae-4d14-8bd3-fccbb55169c0.ws-us02.gitpod.io:443",
    ]
  });
  return io;
}
function get() {
  return io;
}

module.exports = {get, connect};
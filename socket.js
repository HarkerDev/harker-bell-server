const socket = require("socket.io");

/** @type {SocketIO.Server} */
var io;
async function connect(server) {
  try {
    io = socket(server, {
      pingTimeout: 10000, // consider increasing pingTimeout
      pingInterval: 10000,
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
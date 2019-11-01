require("dotenv").config();
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;

/** @type {mongodb.Db} */
var db;
/** @type {mongodb.MongoClient} */
var client;
async function connect() {
  try {
    client = await MongoClient.connect(process.env.DB_HOST);
    db = client.db(process.env.DB_NAME);
  } catch (err) {
    throw err;
  }
  return db;
}
function get() {
  return db;
}
function getClient() {
  return client;
}

module.exports = {get, getClient, connect};
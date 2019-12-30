require("dotenv").config();
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;

/** @type {mongodb.Db} */
var db;
/** @type {mongodb.MongoClient} */
var client;
async function connect() {
  console.log(process.env.DB_HOST);
  client = await MongoClient.connect(process.env.DB_HOST);
  db = client.db(process.env.DB_NAME);
  return db;
}
function get() {
  return db;
}
function getClient() {
  return client;
}

module.exports = {get, getClient, connect};
const mysql = require('promise-mysql')
const dotenv = require("dotenv") 
dotenv.config()
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_NAME = process.env.DB_NAME

const connection = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
})

function getConnection(){
    return connection
}

module.exports = { getConnection }
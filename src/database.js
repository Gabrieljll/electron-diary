const mysql = require('promise-mysql')

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'clave',
    database: 'electron_diary'
})

function getConnection(){
    return connection
}

module.exports = { getConnection }
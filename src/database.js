const mysql = require('mysql2/promise');
const dotenv = require("dotenv");
dotenv.config();

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

let connection; // Variable para almacenar la conexión

async function crearConexion() {
    if (!connection) {  // Verificar si la conexión ya está creada
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'clave',
            database: 'pombero_alcoholic'
        });
    }
    return connection;
}

async function getConnection() {
    return await crearConexion(); // Asegurarse de esperar la conexión
}

module.exports = { getConnection };

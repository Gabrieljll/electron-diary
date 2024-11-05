const {BrowserWindow, Notification, webContents} = require('electron')
const {getConnection} = require('./database')
const { ipcMain } = require('electron');

async function nuevoProducto(fichaCliente) {
    try{
        const conn = await getConnection();
        fichaCliente.precioProducto = parseFloat(fichaCliente.precioProducto)
        const result = await conn.query('INSERT INTO stock_productos SET ?', fichaCliente)

        new Notification({
            title: 'Agenda Dinámica',
            body: 'Nueva ficha de cliente agendada'
        }).show()

        fichaCliente.id = result.insertId
        return fichaCliente

    } catch (error){
        console.log(error)
    }
}

async function borrarRegistroProducto(id) {
    const conn = await getConnection()
    const result = await conn.query('DELETE FROM stock_productos WHERE id = ?', id)
    return result
}

async function getProductoById(id){
    const conn = await getConnection()
    const result = await conn.query('SELECT * FROM stock_productos WHERE id = ?', id)
    return result[0]
}

async function actualizarProducto(id, ficha){
    const conn = await getConnection()
    const result = await conn.query('UPDATE stock_productos SET ? WHERE id = ?',[ficha, id])
    return result[0]
}

async function getProductos() {
    const conn = await getConnection()
    const fichas = await conn.query('SELECT * FROM stock_productos ORDER BY id DESC')
    return fichas
}

async function getDiasFichas(){
    const conn = await getConnection()
    const fechas = await conn.query('SELECT fecha FROM stock_productos ORDER BY fecha ASC')
    return fechas
}

async function getFichasPorFecha(fecha){
    const conn = await getConnection()
    const result = await conn.query('SELECT * FROM stock_productos WHERE fecha = ?', fecha)
    return result.length

}

let window

function createWindow(){
    window = new BrowserWindow({
        width:800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,

        }
    })

    require("@electron/remote/main").initialize();
    require("@electron/remote/main").enable(window.webContents);0
    window.loadFile('src/ui/index.html')
    window.maximize()
    window.show()
}

module.exports = {
    createWindow,
    nuevoProducto,
    getProductos,
    borrarProducto,
    getProductoById,
    actualizarProducto,
    getDiasFichas,
    getFichasPorFecha
}
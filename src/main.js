const {BrowserWindow, Notification, webContents} = require('electron')
const {getConnection} = require('./database')
const { ipcMain } = require('electron');

async function nuevoProducto(nuevoProducto) {
    try{
        const conn = await getConnection();
        const result = await conn.query('INSERT INTO productos SET ?', nuevoProducto)

        new Notification({
            title: 'Calculadora de precios',
            body: 'Nuevo producto agregado'
        }).show()

        nuevoProducto.id = result.insertId
        return nuevoProducto

    } catch (error){
        console.log(error)
    }
}

async function borrarProducto(id) {
    const conn = await getConnection()
    const result = await conn.query('DELETE FROM productos WHERE id = ?', id)
    return result
}

async function getProductoById(id){
    const conn = await getConnection()
    const result = await conn.query('SELECT * FROM productos WHERE id = ?', id)
    return result[0]
}

async function actualizarProducto(id, producto){
    const conn = await getConnection()
    const result = await conn.query('UPDATE productos SET ? WHERE id = ?',[producto, id])
    return result[0]
}

async function getProductos() {
    const conn = await getConnection()
    const productos = await conn.query('SELECT * FROM productos ORDER BY id DESC')
    return productos
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
}
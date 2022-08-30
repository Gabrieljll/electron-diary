const {BrowserWindow, Notification, webContents} = require('electron')
const {getConnection} = require('./database')
const { ipcMain } = require('electron');

async function nuevaFichaCliente(fichaCliente) {
    try{
        const conn = await getConnection();
        fichaCliente.precioProducto = parseFloat(fichaCliente.precioProducto)
        const result = await conn.query('INSERT INTO fichascliente SET ?', fichaCliente)

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

async function borrarFichaCliente(id) {
    const conn = await getConnection()
    const result = await conn.query('DELETE FROM fichascliente WHERE id = ?', id)    
    return result[0]
}

async function getFichaById(id){
    const conn = await getConnection()
    const result = await conn.query('SELECT * FROM fichascliente WHERE id = ?', id)
    return result[0]
}

async function actualizarFichaCliente(id, ficha){
    const conn = await getConnection()
    const result = await conn.query('UPDATE fichascliente SET ? WHERE id = ?',[ficha, id])
    return result[0]
}

async function getFichasCliente() {
    const conn = await getConnection()
    const fichas = await conn.query('SELECT * FROM fichascliente ORDER BY id DESC')
    return fichas[0]
}

async function getDiasFichas(){
    const conn = await getConnection()
    const fechas = await conn.query('SELECT fecha FROM fichascliente ORDER BY fecha ASC')
    return fechas[0]
}

async function getFichasPorFecha(fecha){
    const conn = await getConnection()
    const result = await conn.query('SELECT * FROM fichascliente WHERE fecha = ?', fecha)
    return result[0].length

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
    nuevaFichaCliente,
    getFichasCliente,
    borrarFichaCliente,
    getFichaById,
    actualizarFichaCliente,
    getDiasFichas,
    getFichasPorFecha
}
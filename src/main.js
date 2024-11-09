const {BrowserWindow, Notification, webContents} = require('electron')
const {getConnection} = require('./database')
const { ipcMain } = require('electron');
async function nuevoProducto(fichaCliente) {
    try{
        const conn = await getConnection();
        fichaCliente.precio = parseFloat(fichaCliente.precio)
        const result = await conn.query('INSERT INTO stock_productos SET ?', fichaCliente)

        new Notification({
            title: 'Pombero Stock',
            body: 'Nuevo Producto Agregado!'
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

async function actualizarProducto(id, producto) {
    const conn = await getConnection();
    const { nombre, precio, descripcion, imagen, cantidad_disponible } = producto;
    
    // Realizamos la consulta de actualización con las propiedades recibidas
    await conn.query(
        `UPDATE stock_productos 
         SET nombre = ?, precio = ?, descripcion = ?, imagen = ?, cantidad_disponible = ? 
         WHERE id = ?`,
        [nombre, precio, descripcion, imagen, cantidad_disponible, id]  // Pasamos los valores en el orden correcto
    );
}

async function actualizarStockProducto(id, datos) {
    const conn = await getConnection();
    await conn.query(
        `UPDATE stock_productos SET cantidad_disponible = ? WHERE id = ?`,
        [datos.cantidad_disponible, id]
    );
}

async function getProductos() {
    const conn = await getConnection()
    const fichas = await conn.query('SELECT * FROM stock_productos ORDER BY id DESC')
    return fichas
}


// Función para obtener ventas por fecha
async function obtenerVentasPorFecha(fecha) {
    const conn = await getConnection();
    
    let rows = await conn.query(`
        SELECT 
            vp.id_orden AS id, 
            vp.nombre_cliente AS cliente, 
            vp.direccion, 
            vp.telefono, 
            vp.total,
            o.cantidad AS cantidad,
            p.nombre AS producto_nombre,
            p.precio AS producto_precio
        FROM venta_producto vp
        LEFT JOIN orden_producto o ON vp.id_orden = o.id_orden
        LEFT JOIN stock_productos p ON o.id_producto = p.id
        WHERE DATE(vp.fecha) = ?
    `, [fecha]);

    return rows.map(row => ({
        id: row.id,
        cliente: row.cliente,
        direccion: row.direccion,
        telefono: row.telefono,
        total: row.total,
        cantidad: row.cantidad,
        producto_nombre: row.producto_nombre,
        producto_precio: row.producto_precio
    }));
}


// Función para crear una nueva orden y obtener su ID
async function crearOrden() {
    const conn = await getConnection();
    const result = await conn.query('INSERT INTO ordenes (fecha) VALUES (NOW())');
    return result.insertId;  // Devuelve el ID de la orden recién creada
}

// Función para agregar productos a una orden y actualizar el stock de cada producto
async function agregarProductoAOrden(idOrden, idProducto, cantidad) {
    const conn = await getConnection();


    // Insertar el producto en la tabla `orden_producto`
    await conn.query(
        `INSERT INTO orden_producto (id_orden, id_producto, cantidad) VALUES (?, ?, ?)`,
        [idOrden, idProducto, cantidad]
    );

    // Actualizar el stock del producto
    await conn.query(
        `UPDATE stock_productos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?`,
        [cantidad, idProducto]
    );
}

// Función para registrar la venta en la tabla `venta_producto`
async function crearVentaProducto({ idOrden, cliente, telefono, direccion, total }) {
    const conn = await getConnection();
    const fecha = new Date(); // Asumimos que la fecha es la fecha actual

    await conn.query(
        'INSERT INTO venta_producto (id_orden, nombre_cliente, telefono, direccion, total, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        [idOrden, cliente, telefono, direccion, total, fecha]
    );
}


// Función para actualizar las compras del cliente en `compras_realizadas`
async function actualizarComprasCliente(nombre_cliente, telefono) {
    const conn = await getConnection();

    // Verificar si el cliente ya existe en `compras_realizadas`
    const [clienteExistente] = await conn.query(
        `SELECT cantidad_compras FROM compras_realizadas WHERE telefono = ?`,
        [telefono]
    );

    if (clienteExistente) {
        // Cliente existe, incrementar la cantidad de compras
        const nuevaCantidad = clienteExistente.cantidad_compras + 1;
        await conn.query(
            `UPDATE compras_realizadas SET cantidad_compras = ? WHERE telefono = ?`,
            [nuevaCantidad, telefono]
        );
    } else {
        // Cliente nuevo, insertar un registro con cantidad_compras = 1
        await conn.query(
            `INSERT INTO compras_realizadas (telefono, nombre_cliente, cantidad_compras) VALUES (?, ?, 1)`,
            [telefono, nombre_cliente]
        );
    }
}

// Función para manejar el flujo completo de una venta
async function registrarVenta({ productos, cliente, telefono, direccion, total }) {
    try {
        // Paso 1: Crear una nueva orden
        const idOrden = await crearOrden();

        // Paso 2: Agregar cada producto a la orden y actualizar el stock
        for (const producto of productos) {
            await agregarProductoAOrden(idOrden, producto.id, producto.cantidad);
        }

        // Paso 3: Registrar la venta en la tabla `venta_producto`
        await crearVentaProducto({
            idOrden,
            cliente,
            telefono,
            direccion,
            total
        });

        // Paso 4: Actualizar la cantidad de compras del cliente
        await actualizarComprasCliente(cliente, telefono);

        // Notificación de éxito
        new Notification({
            title: 'Pombero Stock',
            body: 'Venta registrada exitosamente!'
        }).show();

    } catch (error) {
        console.error("Error al registrar la venta:", error);
    }
}

let window

function createWindow(){
    window = new BrowserWindow({
        width:800,
        height: 600,
        show: false,
        webPreferences: {
            webSecurity: false,
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
    borrarRegistroProducto,
    getProductoById,
    obtenerVentasPorFecha,
    actualizarStockProducto,
    actualizarComprasCliente,
    agregarProductoAOrden,
    crearOrden,
    crearVentaProducto,
    registrarVenta ,
    actualizarProducto
}
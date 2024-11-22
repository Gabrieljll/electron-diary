const { BrowserWindow, Notification, webContents, ipcMain, app } = require('electron');
const { getConnection } = require('./database');
const ExcelJS = require('exceljs');
const path = require('path');

async function generarExcelGananciasDelDia(fecha) {
    const conn = await getConnection();
    const [ventas] = await conn.query(`
        SELECT 
            vp.nombre_cliente AS cliente, 
            vp.direccion, 
            vp.telefono,
            vp.modo_pago AS modo_pago,
            vp.total AS total,
            op.cantidad, 
            sp.nombre AS producto_nombre, 
            sp.precio AS producto_precio
        FROM venta_producto vp
        JOIN orden_producto op ON vp.id_orden = op.id_orden
        JOIN stock_productos sp ON op.id_producto = sp.id
        WHERE DATE(vp.fecha) = ?
    `, [fecha]);

    const ventasArray = Array.isArray(ventas) ? ventas : [ventas];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ganancias del Día');

    worksheet.columns = [
        { header: 'Cliente', key: 'cliente', width: 20 },
        { header: 'Dirección', key: 'direccion', width: 20 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Producto', key: 'producto_nombre', width: 25 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Precio Unitario', key: 'producto_precio', width: 15 },
        { header: 'Método de Pago', key: 'modo_pago', width: 15 },
        { header: 'Total Venta', key: 'total', width: 15 }
    ];

    let totalGanancias = 0;
    ventasArray.forEach(venta => {
        worksheet.addRow({
            cliente: venta.cliente,
            direccion: venta.direccion,
            telefono: venta.telefono,
            producto_nombre: venta.producto_nombre,
            cantidad: venta.cantidad,
            producto_precio: venta.producto_precio,
            modo_pago: venta.modo_pago,
            total: venta.total
        });
        totalGanancias += venta.total;
    });

    worksheet.addRow({});
    worksheet.addRow({ producto_nombre: 'Ganancias Totales', total: totalGanancias });

    const filePath = path.join(app.getPath('desktop'), `ganancias_${fecha}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    
    return filePath;
}


// Registrar el manejador de ipcMain en el proceso principal
ipcMain.handle('descargar-ganancias-dia', async (event, fecha) => {
    const filePath = await generarExcelGananciasDelDia(fecha);
    return filePath;
});


async function generarExcelComprasRealizadas() {
    const conn = await getConnection();
    
    // Consulta para obtener todos los registros de la tabla `compras_realizadas`
    const [compras] = await conn.query(`
        SELECT nombre_cliente, telefono, cantidad_compras 
        FROM compras_realizadas
    `);

    // Verificar si `compras` es un arreglo
    const comprasArray = Array.isArray(compras) ? compras : [compras];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Compras Realizadas');

    // Definir las columnas correspondientes a `compras_realizadas`
    worksheet.columns = [
        { header: 'Nombre del Cliente', key: 'nombre_cliente', width: 20 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Cantidad de Compras', key: 'cantidad_compras', width: 20 }
    ];

    // Agregar filas al archivo Excel
    comprasArray.forEach(compra => {
        worksheet.addRow({
            nombre_cliente: compra.nombre_cliente,
            telefono: compra.telefono,
            cantidad_compras: compra.cantidad_compras
        });
    });

    const filePath = path.join(app.getPath('desktop'), `compras_realizadas_clientes.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    
    return filePath;
}

// Registrar el manejador de ipcMain en el proceso principal
ipcMain.handle('descargar-compras-realizadas', async (event) => {
    const filePath = await generarExcelComprasRealizadas();
    return filePath;
});

async function nuevoProducto(fichaCliente) {
    try {
        const conn = await getConnection();
        fichaCliente.precio = parseFloat(fichaCliente.precio);
        const [result] = await conn.query('INSERT INTO stock_productos SET ?', fichaCliente);

        new Notification({
            title: 'Pombero Stock',
            body: 'Nuevo Producto Agregado!'
        }).show();

        fichaCliente.id = result.insertId;
        return fichaCliente;

    } catch (error) {
        console.log(error);
    }
}

async function borrarRegistroProducto(id) {
    const conn = await getConnection();
    const [result] = await conn.query('DELETE FROM stock_productos WHERE id = ?', [id]);
    return result;
}

async function getProductoById(id) {
    const conn = await getConnection();
    const [result] = await conn.query('SELECT * FROM stock_productos WHERE id = ?', [id]);
    return result;
}

async function actualizarProducto(id, producto) {
    const conn = await getConnection();
    const { nombre, precio, precio_delivery, descripcion, cantidad_disponible } = producto;
    
    await conn.query(
        `UPDATE stock_productos 
         SET nombre = ?, precio = ?, precio_delivery = ?, descripcion = ?, cantidad_disponible = ? 
         WHERE id = ?`,
        [nombre, precio, precio_delivery, descripcion, cantidad_disponible, id]
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
    const conn = await getConnection();
    const [fichas] = await conn.query('SELECT * FROM stock_productos ORDER BY id DESC');
    return fichas;
}

// Función para obtener ventas por fecha
async function obtenerVentasPorFecha(fecha) {
    const conn = await getConnection();
    
    const [rows] = await conn.query(`
        SELECT 
            vp.id_orden AS id, 
            vp.nombre_cliente AS cliente, 
            vp.direccion, 
            vp.telefono,
            vp.modo_pago,
            vp.total,
            o.cantidad AS cantidad,
            p.nombre AS producto_nombre,
            p.precio AS producto_precio,
            TIME(vp.fecha) AS horario
        FROM venta_producto vp
        LEFT JOIN orden_producto o ON vp.id_orden = o.id_orden
        LEFT JOIN stock_productos p ON o.id_producto = p.id
        WHERE DATE(vp.fecha) = ?`,
        [fecha]
    );

    return rows.map(row => ({
        id: row.id,
        cliente: row.cliente,
        direccion: row.direccion,
        telefono: row.telefono,
        modo_pago: row.modo_pago,
        total: row.total,
        cantidad: row.cantidad,
        producto_nombre: row.producto_nombre,
        producto_precio: row.producto_precio,
        horario: row.horario
    }));
}

async function crearOrden() {
    const conn = await getConnection();
    const [result] = await conn.query('INSERT INTO ordenes (fecha) VALUES (NOW())');
    return result.insertId;
}

async function agregarProductoAOrden(idOrden, idProducto, cantidad) {
    const conn = await getConnection();

    await conn.query(
        `INSERT INTO orden_producto (id_orden, id_producto, cantidad) VALUES (?, ?, ?)`,
        [idOrden, idProducto, cantidad]
    );

    await conn.query(
        `UPDATE stock_productos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?`,
        [cantidad, idProducto]
    );
}

async function crearVentaProducto({ idOrden, cliente, telefono, direccion, metodoPago, total }) {
    const conn = await getConnection();

    const sql = `
    INSERT INTO venta_producto (id_orden, nombre_cliente, telefono, direccion, modo_pago, total, fecha) 
    VALUES (?, ?, ?, ?, ?, ?, NOW())`;
    
    await conn.query(sql, [idOrden, cliente, telefono, direccion, metodoPago, total]);
}

async function actualizarComprasCliente(nombre_cliente, telefono) {
    const conn = await getConnection();

    const [resultado] = await conn.query(
        `SELECT cantidad_compras FROM compras_realizadas WHERE telefono = ?`,
        [telefono]
    );

    const clienteExistente = resultado[0]; // Asegura que accedes al primer registro devuelto, si existe

    if (clienteExistente && clienteExistente.cantidad_compras !== null) {
        // Si el cliente existe y la cantidad no es nula
        const nuevaCantidad = (clienteExistente.cantidad_compras || 0) + 1;
        await conn.query(
            `UPDATE compras_realizadas SET cantidad_compras = ? WHERE telefono = ?`,
            [nuevaCantidad, telefono]
        );
    } else {
        // Si el cliente no existe o cantidad_compras es null, crea un nuevo registro con cantidad_compras = 1
        await conn.query(
            `INSERT INTO compras_realizadas (telefono, nombre_cliente, cantidad_compras) VALUES (?, ?, 1)`,
            [telefono, nombre_cliente]
        );
    }
}


async function registrarVenta({ productos, cliente, telefono, direccion, metodoPago, total }) {
    try {
        const idOrden = await crearOrden();

        for (const producto of productos) {
            await agregarProductoAOrden(idOrden, producto.id, producto.cantidad);
        }

        await crearVentaProducto({
            idOrden,
            cliente,
            telefono,
            direccion,
            metodoPago,
            total
        });

        await actualizarComprasCliente(cliente, telefono);

        new Notification({
            title: 'Pombero Stock',
            body: 'Venta registrada exitosamente!'
        }).show();

    } catch (error) {
        console.error("Error al registrar la venta:", error);
    }
}



async function eliminarVenta(idVenta) {
    try{
        const conn = await getConnection();
        await conn.query('DELETE FROM venta_producto WHERE id_orden = ?', [idVenta]);
        await conn.query('DELETE FROM orden_producto WHERE id_orden = ?', [idVenta]);
        await conn.query('DELETE FROM ordenes WHERE id = ?', [idVenta]);

        new Notification({
            title: 'Pombero Ventas',
            body: 'Venta eliminada exitosamente!'
        }).show();
    } catch (error){
        new Notification({
            title: 'Pombero Stock',
            body: 'Ocurrió un error al tratar de eliminar el registro!'
        }).show();
    }
}


let window;

function createWindow() {
    window = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    require("@electron/remote/main").initialize();
    require("@electron/remote/main").enable(window.webContents);
    window.loadFile('src/ui/index.html');
    window.maximize();
    window.show();
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
    registrarVenta,
    actualizarProducto,
    generarExcelGananciasDelDia,
    generarExcelComprasRealizadas,
    eliminarVenta
};

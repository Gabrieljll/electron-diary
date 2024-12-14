const { BrowserWindow, Notification, webContents, ipcMain, app } = require('electron');
const { getConnection } = require('./database');
const ExcelJS = require('exceljs');
const path = require('path');

async function generarExcelGananciasDelDia(fecha) {
    const conn = await getConnection();

    // Consulta ajustada para incluir precios locales y de delivery
    const [ventas] = await conn.query(`
        SELECT 
            vp.id_orden,
            vp.nombre_cliente AS cliente,
            vp.direccion,
            vp.telefono,
            vp.modo_pago,
            vp.total AS total_venta,
            cp.nombre AS combo_nombre,
            IF(vp.direccion = 'local', cp.precio, cp.precio_delivery) AS combo_precio,
            SUM(oc.cantidad) AS combo_cantidad,
            sp.nombre AS producto_nombre,
            IF(vp.direccion = 'local', sp.precio, sp.precio_delivery) AS producto_precio,
            SUM(op.cantidad) AS producto_cantidad
        FROM venta_producto vp
        LEFT JOIN orden_combo oc ON vp.id_orden = oc.id_orden
        LEFT JOIN combo_productos cp ON oc.id_combo = cp.id
        LEFT JOIN orden_producto op ON vp.id_orden = op.id_orden
        LEFT JOIN stock_productos sp ON op.id_producto = sp.id
        WHERE DATE(vp.fecha) = ?
        GROUP BY 
            vp.id_orden, 
            vp.nombre_cliente, 
            vp.direccion, 
            vp.telefono, 
            vp.modo_pago, 
            vp.total, 
            cp.nombre, 
            cp.precio, 
            cp.precio_delivery, 
            sp.nombre, 
            sp.precio, 
            sp.precio_delivery
        ORDER BY vp.id_orden;
    `, [fecha]);

    const ventasArray = Array.isArray(ventas) ? ventas : [ventas];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ganancias del Día');

    worksheet.columns = [
        { header: 'Cliente', key: 'cliente', width: 15 },
        { header: 'Tipo de Venta', key: 'tipo_venta', width: 15 },
        { header: 'Dirección', key: 'direccion', width: 15 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Combos', key: 'combos', width: 30 },
        { header: 'Cantidad de Combos', key: 'cantidad_combos', width: 30 },
        { header: 'Precio Unitario Combos', key: 'precio_combo', width: 30 },
        { header: 'Productos', key: 'productos', width: 30 },
        { header: 'Cantidad de Productos', key: 'cantidad_productos', width: 20 },
        { header: 'Precio Unitario Productos', key: 'precio_producto', width: 25 },
        { header: 'Método de Pago', key: 'modo_pago', width: 15 },
        { header: 'Total Venta', key: 'total_venta', width: 15 }
    ];

    let totalGanancias = 0;

    const ventasAgrupadas = {};
    ventasArray.forEach((venta) => {
        if (!ventasAgrupadas[venta.id_orden]) {
            ventasAgrupadas[venta.id_orden] = {
                id_orden: venta.id_orden,
                cliente: venta.cliente,
                direccion: venta.direccion,
                telefono: venta.telefono,
                modo_pago: venta.modo_pago,
                total_venta: venta.total_venta,
                combos: [],
                productos: [],
            };
        }

        // Agregar el combo si no está ya en la lista
        if (venta.combo_nombre && !ventasAgrupadas[venta.id_orden].combos.some(c => c.nombre === venta.combo_nombre)) {
            ventasAgrupadas[venta.id_orden].combos.push({
                nombre: venta.combo_nombre,
                precio: venta.combo_precio,
                cantidad: venta.combo_cantidad,
            });
        }

        // Agregar el producto si no está ya en la lista
        if (venta.producto_nombre && !ventasAgrupadas[venta.id_orden].productos.some(p => p.nombre === venta.producto_nombre)) {
            ventasAgrupadas[venta.id_orden].productos.push({
                nombre: venta.producto_nombre,
                precio: venta.producto_precio,
                cantidad: venta.producto_cantidad,
            });
        }
    });

    // Convertir a un array final para generar el Excel
    const ventasFinales = Object.values(ventasAgrupadas);
    // Agregar las filas a la hoja de trabajo
    ventasFinales.forEach(venta => {
        // Combos
        let combos = venta.combos.map(combo => combo.nombre).join(' | ');
        let cantidadCombos = venta.combos.map(combo => combo.cantidad).join(' | ');
        let precioCombo = venta.combos.map(combo => `$${combo.precio.toLocaleString()}`).join(' | ');

        // Productos
        let productos = venta.productos.map(producto => producto.nombre).join(' | ');
        let cantidadProductos = venta.productos.map(producto => producto.cantidad).join(' | '); 
        let precioProducto = venta.productos.map(producto => `$${producto.precio.toLocaleString()}`).join(' | ');

        worksheet.addRow({
            cliente: venta.cliente,
            tipo_venta: venta.direccion == 'local' ? 'Local' : "Delivery",
            direccion: venta.direccion,
            telefono: venta.telefono,
            combos: combos,
            cantidad_combos: cantidadCombos,
            precio_combo: precioCombo,
            productos: productos,
            cantidad_productos: cantidadProductos,
            precio_producto: precioProducto,
            modo_pago: venta.modo_pago,
            total_venta: `$${venta.total_venta.toLocaleString()}`
        });

        totalGanancias += parseFloat(venta.total_venta);
    });

    const worksheetResumen = workbook.addWorksheet('Resumen');
    worksheetResumen.addRow(['Total Ganancias del Día', `$${totalGanancias.toLocaleString()}`]);

    // Crear la ruta para guardar el archivo Excel en el escritorio
    const filePath = path.join(app.getPath('desktop'), `ganancias_${fecha}.xlsx`);

    // Guardar el archivo Excel en el escritorio
    await workbook.xlsx.writeFile(filePath);

    console.log(`Archivo Excel generado en: ${filePath}`);
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
    return result[0];
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
            COALESCE(o.cantidad, 0) AS producto_cantidad, -- Cantidad de productos individuales
            p.nombre AS producto_nombre, -- Nombre del producto individual
            p.precio AS producto_precio,
            p.precio_delivery AS producto_precio_delivery, -- Precio delivery del producto
            oc.cantidad AS combo_cantidad,
            c.nombre AS combo_nombre,
            c.precio AS combo_precio,
            c.precio_delivery AS combo_precio_delivery, -- Precio delivery del combo
            cd.id_producto AS producto_en_combo_id,
            sp.nombre AS producto_en_combo_nombre,
            TIME(vp.fecha) AS horario
        FROM venta_producto vp
        LEFT JOIN orden_producto o ON vp.id_orden = o.id_orden
        LEFT JOIN stock_productos p ON o.id_producto = p.id
        LEFT JOIN orden_combo oc ON vp.id_orden = oc.id_orden
        LEFT JOIN combo_productos c ON oc.id_combo = c.id
        LEFT JOIN combo_detalle cd ON c.id = cd.id_combo
        LEFT JOIN stock_productos sp ON cd.id_producto = sp.id
        WHERE DATE(vp.fecha) = ?
        ORDER BY vp.id_orden, oc.id_combo, o.id_producto;
    `, [fecha]);

    const ventasAgrupadas = rows.reduce((acc, row) => {
        // Buscar o inicializar la orden
        if (!acc[row.id]) {
            acc[row.id] = {
                id: row.id,
                cliente: row.cliente,
                direccion: row.direccion,
                telefono: row.telefono,
                modo_pago: row.modo_pago,
                total: row.total,
                horario: row.horario,
                productos: [],
                combos: []
            };
        }
    
        const venta = acc[row.id];
    
        // Procesar combos
        if (row.combo_nombre) {
            let comboExistente = venta.combos.find(c => c.nombre === row.combo_nombre);
            if (!comboExistente) {
                comboExistente = {
                    cantidad: row.combo_cantidad,
                    nombre: row.combo_nombre,
                    precio: row.combo_precio,
                    precio_delivery: row.combo_precio_delivery,
                    productos: []
                };
                venta.combos.push(comboExistente);
            }
    
            // Agregar productos al combo
            if (row.producto_en_combo_nombre) {
                const productoEnComboExistente = comboExistente.productos.find(p => p.nombre === row.producto_en_combo_nombre);
                if (!productoEnComboExistente) {
                    comboExistente.productos.push({
                        nombre: row.producto_en_combo_nombre
                    });
                }
            }
        }
    
        // Procesar productos individuales que no están en combos
        if (row.producto_nombre && !venta.combos.some(combo =>
            combo.productos.some(producto => producto.nombre === row.producto_nombre))) {
            const productoExistente = venta.productos.find(p => p.nombre === row.producto_nombre);
            if (!productoExistente) {
                venta.productos.push({
                    cantidad: row.producto_cantidad,
                    nombre: row.producto_nombre,
                    precio: row.producto_precio,
                    precio_delivery: row.producto_precio_delivery
                });
            }
        }
    
        return acc;
    }, {});

    return Object.values(ventasAgrupadas);
}






// Crear una nueva orden
async function crearOrden() {
    const conn = await getConnection();
    const [result] = await conn.query('INSERT INTO ordenes (fecha) VALUES (NOW())');
    return result.insertId;
}

// Agregar un producto individual a la orden
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

// Crear una nueva venta en la tabla `venta_producto`
async function crearVentaProducto({ idOrden, cliente, telefono, direccion, metodoPago, total, fecha }) {
    const conn = await getConnection();

    const sql = `
    INSERT INTO venta_producto (id_orden, nombre_cliente, telefono, direccion, modo_pago, total, fecha) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    await conn.query(sql, [idOrden, cliente, telefono, direccion, metodoPago, total, fecha]);
}

// Actualizar las compras del cliente
async function actualizarComprasCliente(nombre_cliente, telefono) {
    const conn = await getConnection();

    const [resultado] = await conn.query(
        `SELECT cantidad_compras FROM compras_realizadas WHERE telefono = ?`,
        [telefono]
    );

    const clienteExistente = resultado[0];

    if (clienteExistente && clienteExistente.cantidad_compras !== null) {
        // Incrementar la cantidad de compras si el cliente ya existe
        const nuevaCantidad = (clienteExistente.cantidad_compras || 0) + 1;
        await conn.query(
            `UPDATE compras_realizadas SET cantidad_compras = ? WHERE telefono = ?`,
            [nuevaCantidad, telefono]
        );
    } else {
        // Crear un nuevo registro si el cliente no existe
        await conn.query(
            `INSERT INTO compras_realizadas (telefono, nombre_cliente, cantidad_compras) VALUES (?, ?, 1)`,
            [telefono, nombre_cliente]
        );
    }
}

// Agregar un combo a la orden y manejar sus productos
async function agregarComboAOrden(idOrden, idCombo, cantidadCombo) {
    const conn = await getConnection();

    // Obtener los detalles del combo
    const [detalles] = await conn.query(
        `SELECT id_producto, cantidad FROM combo_detalle WHERE id_combo = ?`,
        [idCombo]
    );

    // Agregar el combo a la orden (opcional, si se desea registrar el combo como tal)
    await conn.query(
        `INSERT INTO orden_combo (id_orden, id_combo, cantidad) VALUES (?, ?, ?)`,
        [idOrden, idCombo, cantidadCombo]
    );

    // Manejar los productos dentro del combo
    for (const detalle of detalles) {
        const cantidadTotal = detalle.cantidad * cantidadCombo;

        // Actualizar el stock de los productos que componen el combo
        await conn.query(
            `UPDATE stock_productos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?`,
            [cantidadTotal, detalle.id_producto]
        );

        // Registrar los productos del combo en la orden
/*         await conn.query(
            `INSERT INTO orden_producto (id_orden, id_producto, cantidad) VALUES (?, ?, ?)`,
            [idOrden, detalle.id_producto, cantidadTotal]
        ); */
    }
}


// Registrar una nueva venta
async function registrarVenta({ productos, cliente, telefono, direccion, metodoPago, total, fecha }) {
    try {
        const idOrden = await crearOrden();

        for (const item of productos) {
            if (item.tipo === 'producto') {
                // Si es un producto, agregarlo directamente a la orden
                await agregarProductoAOrden(idOrden, item.id, item.cantidad);
            } else if (item.tipo === 'combo') {
                // Si es un combo, manejar sus productos y agregarlos a la orden
                await agregarComboAOrden(idOrden, item.id, item.cantidad);
            }
        }

        await crearVentaProducto({
            idOrden,
            cliente,
            telefono,
            direccion,
            metodoPago,
            total,
            fecha
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


//COMBOS***************
async function nuevoCombo(combo, detalles) {
    const conn = await getConnection();

    try {
        await conn.beginTransaction();

        // Insertar en `combo_productos`
        const [result] = await conn.query('INSERT INTO combo_productos (nombre, descripcion, precio, precio_delivery) VALUES (?, ?, ?, ?)', 
            [combo.nombre, combo.descripcion, combo.precio, combo.precio_delivery]
        );
        console.log(result.insertId)
        const idCombo = result.insertId;

        // Insertar detalles en `combo_detalle` y actualizar stock
        for (const detalle of detalles) {
            // Validar stock antes de reducirlo
            const [producto] = await conn.query('SELECT cantidad_disponible FROM stock_productos WHERE id = ?', [detalle.id_producto]);
            if (producto[0].cantidad_disponible < detalle.cantidad) {
                throw new Error(`Stock insuficiente para el producto ID ${detalle.id_producto}`);
            }

            await conn.query(
                'INSERT INTO combo_detalle (id_combo, id_producto, cantidad) VALUES (?, ?, ?)',
                [idCombo, detalle.id_producto, detalle.cantidad]
            );

            // Reducir el stock
            await conn.query(
                'UPDATE stock_productos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?',
                [detalle.cantidad, detalle.id_producto]
            );
        }

        await conn.commit();

        new Notification({
            title: 'Pombero Stock',
            body: 'Nuevo Combo Agregado!'
        }).show();

        return { idCombo, ...combo, detalles };

    } catch (error) {
        await conn.rollback();
        console.error("Error al crear el combo:", error);
        throw error;
    }
}


async function getCombos() {
    const conn = await getConnection();

    // Obtener todos los combos
    const [combos] = await conn.query('SELECT id, nombre, descripcion, precio, precio_delivery FROM combo_productos ORDER BY id DESC');

    // Obtener los detalles de todos los combos
    const [detalles] = await conn.query(`
        SELECT cd.id_combo, cd.id_producto, cd.cantidad, sp.nombre AS producto_nombre 
        FROM combo_detalle cd 
        JOIN stock_productos sp ON cd.id_producto = sp.id
    `);

    // Agrupar los detalles por combo
    const detallesMap = detalles.reduce((acc, detalle) => {
        if (!acc[detalle.id_combo]) acc[detalle.id_combo] = [];
        acc[detalle.id_combo].push(detalle);
        return acc;
    }, {});

    // Mapear los detalles a sus combos correspondientes
    return combos.map(combo => ({
        ...combo,
        detalles: detallesMap[combo.id] || []
    }));
}


async function getComboById(idCombo) {
    const conn = await getConnection();

    // Obtener el combo
    const [combo] = await conn.query('SELECT id, nombre, descripcion, precio, precio_delivery FROM combo_productos WHERE id = ?', [idCombo]);
    if (!combo.length) return null;

    // Obtener los detalles del combo
    const [detalles] = await conn.query(`
        SELECT cd.id_producto, cd.cantidad, sp.nombre AS producto_nombre 
        FROM combo_detalle cd 
        JOIN stock_productos sp ON cd.id_producto = sp.id 
        WHERE cd.id_combo = ?
    `, [idCombo]);

    return { ...combo[0], detalles };
}


async function actualizarCombo(idCombo, combo, detalles) {
    const conn = await getConnection();

    try {
        await conn.beginTransaction();

        // Actualizar combo
        await conn.query(
            'UPDATE combo_productos SET nombre = ?, descripcion = ?, precio = ?, precio_delivery = ? WHERE id = ?',
            [combo.nombre, combo.descripcion, combo.precio, combo.precio_delivery, idCombo]
        );

        // Revertir stock de los detalles originales
        const [detallesOriginales] = await conn.query('SELECT * FROM combo_detalle WHERE id_combo = ?', [idCombo]);
        for (const detalle of detallesOriginales) {
            await conn.query(
                'UPDATE stock_productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
                [detalle.cantidad, detalle.id_producto]
            );
        }

        // Eliminar detalles originales
        await conn.query('DELETE FROM combo_detalle WHERE id_combo = ?', [idCombo]);

        // Insertar nuevos detalles y actualizar stock
        for (const detalle of detalles) {
            const [producto] = await conn.query('SELECT cantidad_disponible FROM stock_productos WHERE id = ?', [detalle.id_producto]);
            if (producto[0].cantidad_disponible < detalle.cantidad) {
                throw new Error(`Stock insuficiente para el producto ID ${detalle.id_producto}`);
            }

            await conn.query(
                'INSERT INTO combo_detalle (id_combo, id_producto, cantidad) VALUES (?, ?, ?)',
                [idCombo, detalle.id_producto, detalle.cantidad]
            );

            await conn.query(
                'UPDATE stock_productos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?',
                [detalle.cantidad, detalle.id_producto]
            );
        }

        await conn.commit();

        new Notification({
            title: 'Pombero Stock',
            body: 'Combo Actualizado!'
        }).show();

    } catch (error) {
        await conn.rollback();
        console.error("Error al actualizar el combo:", error);
        throw error;
    }
}


async function borrarCombo(idCombo) {
    const conn = await getConnection();

    try {
        await conn.beginTransaction();

        // Revertir stock de los productos en el combo
        const [detalles] = await conn.query('SELECT * FROM combo_detalle WHERE id_combo = ?', [idCombo]);
        for (const detalle of detalles) {
            await conn.query(
                'UPDATE stock_productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
                [detalle.cantidad, detalle.id_producto]
            );
        }

        // Eliminar detalles y el combo
        await conn.query('DELETE FROM combo_detalle WHERE id_combo = ?', [idCombo]);
        await conn.query('DELETE FROM combo_productos WHERE id = ?', [idCombo]);

        await conn.commit();

        new Notification({
            title: 'Pombero Stock',
            body: 'Combo Eliminado!'
        }).show();

    } catch (error) {
        await conn.rollback();
        console.error("Error al eliminar el combo:", error);
        throw error;
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
    eliminarVenta,
    nuevoCombo,
    getCombos,
    getComboById,
    actualizarCombo,
    borrarCombo
};

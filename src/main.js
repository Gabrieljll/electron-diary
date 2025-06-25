const { BrowserWindow, Notification, webContents, ipcMain, app } = require('electron');
const { getConnection } = require('./database');
const ExcelJS = require('exceljs');
const path = require('path');


// En main.js
async function generarExcelStockProductos() {
    const conn = await getConnection();
    
    const [productos] = await conn.query(`
        SELECT id, nombre, precio, descripcion, 
               cantidad_disponible, precio_delivery,
               (precio * cantidad_disponible) as valor_total,
               (precio_delivery * cantidad_disponible) as valor_total_delivery
        FROM stock_productos
        ORDER BY nombre
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock');

    // Estilos
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } },
        alignment: { vertical: 'middle', horizontal: 'center' }
    };

    // Columnas con estilos
    worksheet.columns = [
        { header: 'ID', key: 'id', width: 8, style: { alignment: { horizontal: 'center' } } },
        { header: 'Producto', key: 'nombre', width: 30 },
        { header: 'Precio Local', key: 'precio', width: 15, style: { numFmt: '$#,##0.00' } },
        { header: 'Precio Delivery', key: 'precio_delivery', width: 15, style: { numFmt: '$#,##0.00' } },
        { header: 'Stock', key: 'cantidad_disponible', width: 10, style: { alignment: { horizontal: 'center' } } },
        { header: 'Valor Total Local', key: 'valor_total', width: 18, style: { numFmt: '$#,##0.00' } },
        { header: 'Valor Total Delivery', key: 'valor_total_delivery', width: 20, style: { numFmt: '$#,##0.00' } },
        { header: 'Descripción', key: 'descripcion', width: 40 }
    ];

    // Aplicar estilo a la cabecera
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
        cell.style = headerStyle;
    });

    // Agregar datos
    productos.forEach(p => {
        worksheet.addRow({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio,
            precio_delivery: p.precio_delivery,
            cantidad_disponible: p.cantidad_disponible,
            valor_total: p.valor_total,
            valor_total_delivery: p.valor_total_delivery,
            descripcion: p.descripcion || ''
        });
    });

    // Congelar la primera fila (cabecera)
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Autoajustar columnas
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const length = cell.value ? cell.value.toString().length : 0;
            if (length > maxLength) maxLength = length;
        });
        column.width = Math.min(Math.max(maxLength + 2, column.header.length + 2), 50);
    });


    const filePath = path.join(app.getPath('desktop'), `Stock_Productos_${formatDate(new Date())}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    
    return filePath;
}

function formatDate(date) {
    return date.toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
}

// Registrar el manejador en ipcMain
ipcMain.handle('descargar-stock-productos', async () => {
    return await generarExcelStockProductos();
});

async function generarExcelGananciasDelDia(fecha) {
    const conn = await getConnection();

    // Consulta ajustada para incluir el costo de envío
    const [ventas] = await conn.query(`
        SELECT 
            vp.id_orden,
            vp.nombre_cliente AS cliente,
            vp.direccion,
            vp.telefono,
            vp.modo_pago,
            vp.total AS total_venta,
            vp.costo_envio,
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
            vp.costo_envio, 
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
        { header: 'Nombre Cliente', key: 'cliente', width: 20 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Dirección', key: 'direccion', width: 20 },
        { header: 'Pedido', key: 'pedido', width: 30 },
        { header: 'Unidades', key: 'unidades', width: 15 },
        { header: 'Como Abono', key: 'abono', width: 15 },
        { header: 'Envio', key: 'envio', width: 15 },
        { header: 'Total', key: 'total', width: 15 }
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
                costo_envio: venta.costo_envio,
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
        let isFirstRow = true;

        // Combos
        venta.combos.forEach(combo => {
            const row = {
                cliente: isFirstRow ? venta.cliente : '',
                telefono: isFirstRow ? venta.telefono : '',
                direccion: isFirstRow ? venta.direccion : '',
                pedido: combo.nombre,
                unidades: combo.cantidad,
                abono: isFirstRow ? venta.modo_pago : '',
                envio: isFirstRow ? `$${venta.costo_envio.toLocaleString()}` : '',
                total: isFirstRow ? `$${venta.total_venta.toLocaleString()}` : ''
            };
            worksheet.addRow(row);
            isFirstRow = false;
        });

        // Productos
        venta.productos.forEach(producto => {
            const row = {
                cliente: isFirstRow ? venta.cliente : '',
                telefono: isFirstRow ? venta.telefono : '',
                direccion: isFirstRow ? venta.direccion : '',
                pedido: producto.nombre,
                unidades: producto.cantidad,
                abono: isFirstRow ? venta.modo_pago : '',
                envio: isFirstRow ? `$${venta.costo_envio.toLocaleString()}` : '',
                total: isFirstRow ? `$${venta.total_venta.toLocaleString()}` : ''
            };
            worksheet.addRow(row);
            isFirstRow = false;
        });

        totalGanancias += parseFloat(venta.total_venta);
    });

    const worksheetResumen = workbook.addWorksheet('Resumen');
    worksheetResumen.addRow(['Total Ganancias del Día', `$${totalGanancias.toLocaleString()}`]);

    // Crear la ruta para guardar el archivo Excel en el escritorio
    const filePath = path.join(app.getPath('desktop'), `ganancias_${fecha}.xlsx`);

    // Guardar el archivo Excel en el escritorio
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
    
    try {
        // Eliminar los registros relacionados de `orden_producto`
        await conn.query('DELETE FROM orden_producto WHERE id_producto = ?', [id]);

        // Eliminar el producto de `stock_productos`
        const [result] = await conn.query('DELETE FROM stock_productos WHERE id = ?', [id]);

        return result;
    } catch (error) {
        console.error('Error al borrar el producto:', error);
        throw error;
    }
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
            vp.recargo
            vp.id_descuento,
            d.nombre AS nombre_descuento,
            d.porcentaje_descuento,
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
        LEFT JOIN descuentos d ON vp.id_descuento = d.id
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
                nombre_descuento: row.nombre_descuento,
                porcentaje_descuento: row.porcentaje_descuento,
                total: row.total,
                recargo: row.recargo,
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

// Función actualizada para crear una venta con soporte para descuentos
async function crearVentaProducto({ 
    idOrden, 
    cliente, 
    telefono, 
    direccion, 
    costoEnvio, 
    metodoPago, 
    total, 
    fecha, 
    id_descuento = null  // Nuevo parámetro con valor por defecto
}) {
    const conn = await getConnection();

    try {
        // Verificar si el descuento existe si se proporciona un ID
        if (id_descuento) {
            const [descuento] = await conn.query(
                'SELECT id FROM descuentos WHERE id = ?', 
                [id_descuento]
            );
            
            if (descuento.length === 0) {
                console.warn(`Descuento con ID ${id_descuento} no encontrado, procediendo sin descuento`);
                id_descuento = null;
            }
        }
        let recargoPorMetodoPago = null
        if (metodoPago === "credito" || metodoPago === "debito"){
            const [recargo] = await conn.query(
                'SELECT * FROM recargos WHERE metodo_pago = ?', 
                [metodoPago]
            );
            if(recargo.length !== 0){
                recargoPorMetodoPago = recargo[0].porcentaje_recargo
            }
        }

        console.log(recargoPorMetodoPago)

        const sql = `
        INSERT INTO venta_producto 
        (id_orden, nombre_cliente, telefono, direccion, costo_envio, modo_pago, total, fecha, id_descuento, recargo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const [result] = await conn.query(sql, [
            idOrden, 
            cliente, 
            telefono, 
            direccion, 
            costoEnvio, 
            metodoPago, 
            total, 
            fecha,
            id_descuento,
            recargoPorMetodoPago
        ]);

        return result.insertId;
        
    } catch (error) {
        console.error('Error en crearVentaProducto:', error);
        throw error;
    }
}

// Actualizar las compras del cliente
async function actualizarComprasCliente(nombre_cliente, telefono) {
    const conn = await getConnection();

    const [resultado] = await conn.query(
        `SELECT cantidad_compras FROM compras_realizadas WHERE nombre_cliente = ? AND telefono = ?`,
        [nombre_cliente, telefono]
    );

    const clienteExistente = resultado[0];

    if (clienteExistente && clienteExistente.cantidad_compras !== null) {
        // Incrementar la cantidad de compras si el cliente ya existe
        const nuevaCantidad = (clienteExistente.cantidad_compras || 0) + 1;
        await conn.query(
            `UPDATE compras_realizadas SET cantidad_compras = ? WHERE nombre_cliente = ? AND telefono = ?`,
            [nuevaCantidad, nombre_cliente, telefono]
        );
    } else {
        // Crear un nuevo registro si el cliente no existe
        await conn.query(
            `INSERT INTO compras_realizadas (telefono, nombre_cliente, cantidad_compras) VALUES (?, ?, 1)`,
            [telefono, nombre_cliente]
        );
    }
}

async function agregarComboAOrden(idOrden, idCombo, cantidadCombo) {
    const conn = await getConnection();

    // Obtener los detalles del combo
    const [detalles] = await conn.query(
        `SELECT id_producto, cantidad FROM combo_detalle WHERE id_combo = ?`,
        [idCombo]
    );

    // Agregar el combo a la orden
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
    }
}


// Registrar una nueva venta
async function registrarVenta({ productos, cliente, telefono, direccion, costoEnvio, metodoPago, total, fecha, descuento }) {
    try {
        const idOrden = await crearOrden();

        
        let totalFinal = total;

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
            costoEnvio,
            metodoPago,
            total: totalFinal,
            fecha,
            id_descuento: descuento?.id || null
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
        const [result] = await conn.query(
            'INSERT INTO combo_productos (nombre, descripcion, precio, precio_delivery) VALUES (?, ?, ?, ?)',
            [combo.nombre, combo.descripcion, combo.precio, combo.precio_delivery]
        );
        const idCombo = result.insertId;

        // Insertar detalles en `combo_detalle`
        for (const detalle of detalles) {
            await conn.query(
                'INSERT INTO combo_detalle (id_combo, id_producto, cantidad) VALUES (?, ?, ?)',
                [idCombo, detalle.id_producto, detalle.cantidad]
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

        // Eliminar detalles originales
        await conn.query('DELETE FROM combo_detalle WHERE id_combo = ?', [idCombo]);

        // Insertar nuevos detalles
        for (const detalle of detalles) {
            await conn.query(
                'INSERT INTO combo_detalle (id_combo, id_producto, cantidad) VALUES (?, ?, ?)',
                [idCombo, detalle.id_producto, detalle.cantidad]
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

        // Eliminar registros relacionados en `orden_combo`
        await conn.query('DELETE FROM orden_combo WHERE id_combo = ?', [idCombo]);

        // Eliminar detalles del combo
        await conn.query('DELETE FROM combo_detalle WHERE id_combo = ?', [idCombo]);

        // Eliminar el combo en sí
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


async function buscarClientesByNombre(parteNombre){
    const conn = await getConnection();

    // Consulta para encontrar clientes cuyo nombre coincida parcialmente con el texto ingresado
    const [resultado] = await conn.query(
        `SELECT nombre_cliente, telefono FROM compras_realizadas WHERE nombre_cliente LIKE ?`,
        [`%${parteNombre}%`] // El porcentaje (%) permite buscar coincidencias parciales
    );

    return resultado;
}

async function getVentasPorMesAnio(anio, mes, tipo = 'total') {
    const conn = await getConnection();
    
    try {
        const fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;

        let query = `
            SELECT 
                vp.id_orden AS id,
                vp.nombre_cliente AS cliente,
                vp.id_descuento,
                d.nombre AS nombre_descuento,
                d.porcentaje_descuento,
                vp.direccion,
                vp.telefono,
                vp.modo_pago,
                vp.total,
                DATE(vp.fecha) AS fecha,
                TIME(vp.fecha) AS horario
            FROM venta_producto vp
            LEFT JOIN descuentos d ON vp.id_descuento = d.id
            WHERE DATE(vp.fecha) BETWEEN ? AND ?
        `;

        const params = [fechaInicio, fechaFin];
        
        if (tipo === 'local') {
            query += ` AND vp.direccion = 'local'`;
        } else if (tipo === 'delivery') {
            query += ` AND vp.direccion != 'local'`;
        }

        query += ` ORDER BY vp.fecha`;

        const [ventas] = await conn.query(query, params);

        return {
            ventas,
            cantidad: ventas.length,
            total: ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0)
        };

    } catch (error) {
        console.error("Error en getVentasPorMesAnio:", error);
        throw error;
    }
}

// Función para obtener recargos desde la base de datos
async function obtenerRecargos() {
    try {
        const conn = await getConnection();
        const [rows] = await conn.query('SELECT * FROM recargos');
        
        // Convertir a objeto { credito: X, debito: Y }
        const recargos = {
            credito: rows.find(r => r.metodo_pago === 'credito')?.porcentaje_recargo || 0,
            debito: rows.find(r => r.metodo_pago === 'debito')?.porcentaje_recargo || 0
        };
        
        return recargos;
    } catch (error) {
        console.error('Error al obtener recargos:', error);
        return { credito: 0, debito: 0 }; // Valores por defecto
    }
}

// Función para guardar recargos
async function guardarRecargos(credito, debito) {
    try {
        const conn = await getConnection();
        
        await conn.query(
            'UPDATE recargos SET porcentaje_recargo = ? WHERE metodo_pago = ?',
            [credito, 'credito']
        );
        
        await conn.query(
            'UPDATE recargos SET porcentaje_recargo = ? WHERE metodo_pago = ?',
            [debito, 'debito']
        );
        
        return true;
    } catch (error) {
        console.error('Error al guardar recargos:', error);
        return false;
    }
}


async function buscarDescuentosPorNombre(nombre) {
    const conn = await getConnection();
    const [rows] = await conn.query(
        'SELECT * FROM descuentos WHERE nombre LIKE ?',
        [`%${nombre}%`]
    );
    return rows;
}


// Obtener todos los descuentos
async function obtenerDescuentos() {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM descuentos ORDER BY nombre');
    return rows;
}

async function crearDescuento(nombre, porcentaje) {
    const conn = await getConnection();
    
    // Validación adicional por si acaso
    if (typeof porcentaje !== 'number' || isNaN(porcentaje)) {
        throw new Error('Porcentaje inválido');
    }
    
    const [result] = await conn.query(
        'INSERT INTO descuentos (nombre, porcentaje_descuento) VALUES (?, ?)',
        [nombre, porcentaje]
    );
    
    return result;
}

// Actualizar descuento existente
async function actualizarDescuento(id, nombre, porcentaje) {
    const conn = await getConnection();
    await conn.query(
        'UPDATE descuentos SET nombre = ?, porcentaje_descuento = ? WHERE id = ?',
        [nombre, porcentaje, id]
    );
}

// Eliminar descuento
async function eliminarDescuento(id) {
    const conn = await getConnection();
    await conn.query('DELETE FROM descuentos WHERE id = ?', [id]);
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
    obtenerRecargos,
    guardarRecargos,
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
    borrarCombo,
    buscarClientesByNombre,
    getVentasPorMesAnio,
    obtenerDescuentos,
    crearDescuento,
    actualizarDescuento,
    eliminarDescuento,
    buscarDescuentosPorNombre
};

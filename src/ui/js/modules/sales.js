const { ipcRenderer } = require('electron');

let productosSeleccionados = [];
let recargosActuales = { credito: 0, debito: 0 };

async function registrarNuevaVenta() {
    const fechaVentaInput = document.getElementById('fechaVenta');
    const fechaVentaSeleccionada = fechaVentaInput.value;
    const fechaActual = new Date();

    const formatearFechaLocal = (fecha) => {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const hora = String(fecha.getHours()).padStart(2, '0');
        const minutos = String(fecha.getMinutes()).padStart(2, '0');
        const segundos = String(fecha.getSeconds()).padStart(2, '0');
        return `${anio}-${mes}-${dia} ${hora}:${minutos}:${segundos}`;
    };

    let fechaFinal;
    if (fechaVentaSeleccionada) {
        const hoyFormateado = fechaActual.toISOString().slice(0, 10);
        fechaFinal = (fechaVentaSeleccionada === hoyFormateado)
            ? formatearFechaLocal(fechaActual)
            : `${fechaVentaSeleccionada} 23:59:00`;
    } else {
        fechaFinal = formatearFechaLocal(fechaActual);
    }

    const cliente = document.getElementById('nombreCliente').value;
    const telefono = document.getElementById('telefono').value;
    const direccion = document.getElementById('direccion').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const costoEnvio = parseFloat(document.getElementById('costoEnvio').value) || 0;
    const totalConRecargo = parseFloat(document.getElementById('totalConEnvio').textContent.replace('$', '')) || 0;

    const { credito, debito } = await obtenerRecargosActuales();
    let totalSinRecargo = totalConRecargo;
    let montoRecargo = 0;
    let porcentajeRecargo = 0;

    if (metodoPago === 'credito') {
        porcentajeRecargo = credito;
        totalSinRecargo = totalConRecargo / (1 + (credito / 100));
        montoRecargo = totalConRecargo - totalSinRecargo;
    } else if (metodoPago === 'debito') {
        porcentajeRecargo = debito;
        totalSinRecargo = totalConRecargo / (1 + (debito / 100));
        montoRecargo = totalConRecargo - totalSinRecargo;
    }

    const items = productosSeleccionados.map(item => ({
        id: item.id,
        tipo: item.tipo,
        cantidad: item.cantidad
    }));

    if (!cliente || productosSeleccionados.length === 0) {
        Swal.fire('Error', 'Completa todos los campos y selecciona productos/combos.', 'error');
        return;
    }
    if (!direccion || isNaN(costoEnvio)) {
        Swal.fire('Error', 'Ingresa una dirección y costo de envío válidos.', 'error');
        return;
    }

    for (const item of items) {
        if (item.tipo === 'producto') {
            const producto = await ipcRenderer.invoke('producto:obtener-por-id', item.id);
            if (producto.cantidad_disponible < item.cantidad) {
                Swal.fire('Error', `Stock insuficiente para ${producto.nombre}.`, 'error');
                return;
            }
        } else if (item.tipo === 'combo') {
            const combo = await ipcRenderer.invoke('combo:obtener-por-id', item.id);
            for (const detalle of combo.detalles) {
                const producto = await ipcRenderer.invoke('producto:obtener-por-id', detalle.id_producto);
                if (producto.cantidad_disponible < detalle.cantidad * item.cantidad) {
                    Swal.fire('Error', `Stock insuficiente para ${producto.nombre} en combo ${combo.nombre}.`, 'error');
                    return;
                }
            }
        }
    }

    try {
        await ipcRenderer.invoke('venta:registrar', {
            productos: items,
            cliente,
            telefono,
            direccion,
            costoEnvio,
            metodoPago,
            total: totalConRecargo,
            fecha: fechaFinal
        });

        Swal.fire({
            title: 'Venta registrada',
            html: `${montoRecargo > 0 ? `Recargo (${porcentajeRecargo}%): $${montoRecargo.toFixed(2)}<br>` : ''}Total: $${totalConRecargo.toFixed(2)}`,
            icon: 'success'
        });

        limpiarFormularioVenta();

        await cargarVentasPorFecha(fechaVentaSeleccionada);
    } catch (error) {
        console.error('Error al registrar la venta:', error);
        Swal.fire('Error', 'No se pudo registrar la venta.', 'error');
    }
}


async function cargarVentasPorFecha(fecha) {
    const ventas = await ipcRenderer.invoke('venta:obtener-por-fecha', fecha);
    const listaVentas = document.getElementById('listaVentasRealizadas');
    listaVentas.innerHTML = '';

    ventas.forEach(venta => {
        const horaYMinutos = venta.horario.split(':').slice(0, 2).join(':');

        const productosHTML = venta.productos.map(producto => {
            const precio = venta.direccion === 'local' ? producto.precio : producto.precio_delivery;
            return `
                <li class="list-group-item">
                    ${producto.cantidad || 1} x ${producto.nombre} - $${precio?.toFixed(2) || '0.00'}
                </li>`;
        }).join('');

        const combosHTML = venta.combos.map(combo => {
            const precio = venta.direccion === 'local' ? combo.precio : combo.precio_delivery;
            return `
                <li class="list-group-item">
                    ${combo.cantidad} x ${combo.nombre} - $${(combo.cantidad * precio).toFixed(2)}
                    <br>
                    <small>Incluye: ${combo.productos.map(p => p.nombre).join(', ')}</small>
                </li>`;
        }).join('');

        const ventaItem = document.createElement('li');
        ventaItem.classList.add('list-group-item');

        ventaItem.innerHTML = `
            <div class="divDetalleVentasYBotones">
                <div style="width: 50%">
                    <strong>Hora:</strong> ${horaYMinutos} <br>
                    <strong>Cliente:</strong> ${venta.cliente} <br>
                    <strong>Dirección:</strong> ${venta.direccion} <br>
                    <strong>Teléfono:</strong> ${venta.telefono} <br>
                    <strong>Pagado con:</strong> ${venta.modo_pago} <br>
                    <strong>Total:</strong> $${venta.total.toFixed(2)}
                </div>
                <div class="divBotonesDetalleVentas" style="width: 50%">
                    <div>
                        <button class="btn btn-danger btn-sm mt-1 btn-borrarVenta" onclick="eliminarVenta(${venta.id})">Eliminar</button>
                    </div>
                    <div style="margin-top: 30%;">
                        <button class="btn btn-link btn-sm mt-1 btn-verDetalle" onclick="toggleDetalleVenta(${venta.id})">Ver Detalle</button>
                    </div>
                </div>
            </div>
            <div id="detalleVenta${venta.id}" class="detalle-venta mt-2" style="display: none;">
                <ul class="list-group list-group-flush">
                    ${productosHTML}
                    ${combosHTML}
                </ul>
            </div>
        `;

        listaVentas.appendChild(ventaItem);
    });
}

async function eliminarVenta(idVenta) {
    const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará la venta permanentemente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
        await ipcRenderer.invoke('venta:eliminar', idVenta);
        Swal.fire('Eliminado', 'La venta fue eliminada correctamente.', 'success');
        const fechaSeleccionada = document.getElementById('fechaVentas').value;
        await cargarVentasPorFecha(fechaSeleccionada);
    } catch (error) {
        console.error('Error al eliminar la venta:', error);
        Swal.fire('Error', 'No se pudo eliminar la venta.', 'error');
    }
}

async function obtenerRecargosActuales() {
    try {
        const recargos = await ipcRenderer.invoke('config:obtener-recargos');
        return {
            credito: recargos?.credito || 0,
            debito: recargos?.debito || 0
        };
    } catch (error) {
        console.error('Error al obtener recargos:', error);
        return { credito: 0, debito: 0 };
    }
}

async function calcularTotalConRecargo() {
    if (recargosActuales.credito === 0 && recargosActuales.debito === 0) {
        const { credito, debito } = await obtenerRecargosActuales();
        recargosActuales.credito = credito;
        recargosActuales.debito = debito;
    }

    const metodoPago = document.getElementById('metodoPago').value;
    const totalSinRecargo = parseFloat(document.getElementById('totalConEnvio').textContent.replace('$', '')) || 0;
    let totalConRecargo = totalSinRecargo;
    const desglose = document.getElementById('desgloseRecargo');

    if (metodoPago === 'credito' || metodoPago === 'debito') {
        const porcentaje = metodoPago === 'credito' ? recargosActuales.credito : recargosActuales.debito;
        const recargo = totalSinRecargo * (porcentaje / 100);
        totalConRecargo = totalSinRecargo + recargo;

        document.getElementById('subtotal').textContent = `$${totalSinRecargo.toFixed(2)}`;
        document.getElementById('montoRecargo').textContent = `$${recargo.toFixed(2)}`;
        document.getElementById('porcentajeRecargo').textContent = porcentaje;
        document.getElementById('totalFinal').textContent = `$${totalConRecargo.toFixed(2)}`;
        desglose.style.display = 'block';
    } else {
        desglose.style.display = 'none';
    }

    document.getElementById('totalConEnvio').textContent = `$${totalConRecargo.toFixed(2)}`;
    return totalConRecargo;
}


function limpiarFormularioVenta() {
    document.getElementById('nombreCliente').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('direccion').value = 'local';
    document.getElementById('direccion').disabled = true;
    document.getElementById('costoEnvio').value = 0;
    document.getElementById('costoEnvio').disabled = true;
    document.getElementById('cantidadProducto').value = '';
    document.getElementById('metodoPago').value = 'efectivo';
    document.getElementById('desgloseRecargo').style.display = 'none';
    productosSeleccionados = [];
    actualizarResumenVenta();
    actualizarTotalConEnvio();
}

function actualizarTotalConEnvio() {
    const costoEnvio = parseFloat(document.getElementById('costoEnvio').value) || 0;
    const totalProductos = calcularTotalProductos();
    const totalConEnvio = totalProductos + costoEnvio;
    document.getElementById('totalConEnvio').textContent = `$${totalConEnvio.toFixed(2)}`;
    calcularTotalConRecargo();
}

function calcularTotalProductos() {
    return productosSeleccionados.reduce((total, p) => total + (p.precio * p.cantidad), 0);
}

function quitarProducto(index) {
    productosSeleccionados.splice(index, 1);
    actualizarResumenVenta();
    actualizarTotalConEnvio();
}

// ... (código anterior ya refactorizado)

async function mostrarVentas(tipo) {
    try {
        const fechaSeleccionada = document.getElementById('fechaVentas').value;
        const ventasDelDia = await ipcRenderer.invoke('venta:obtener-por-fecha', fechaSeleccionada);

        let ventasFiltradas = [];
        let titulo = '';

        switch (tipo.toLowerCase()) {
            case 'total':
                ventasFiltradas = [...ventasDelDia];
                titulo = `Todas las ventas (${formatearFecha(fechaSeleccionada)})`;
                break;
            case 'local':
                ventasFiltradas = ventasDelDia.filter(v => v.direccion && v.direccion.toLowerCase() === 'local');
                titulo = `Ventas en local (${formatearFecha(fechaSeleccionada)})`;
                break;
            case 'delivery':
                ventasFiltradas = ventasDelDia.filter(v => !v.direccion || v.direccion.toLowerCase() !== 'local');
                titulo = `Ventas por delivery (${formatearFecha(fechaSeleccionada)})`;
                break;
        }

        const mediosPagoDisponibles = [...new Set(ventasDelDia.map(v => {
            if (!v.modo_pago) return null;
            const modo = v.modo_pago.toLowerCase();
            return modo === 'efectivo_y_otro' ? 'efectivo' : modo;
        }))].filter(Boolean);

        mediosPagoDisponibles.sort((a, b) => ['efectivo', 'debito', 'credito', 'transferencia'].indexOf(a) - ['efectivo', 'debito', 'credito', 'transferencia'].indexOf(b));

        let htmlDropdown = '';
        if (mediosPagoDisponibles.length > 0) {
            htmlDropdown = `
                <div style="margin: 15px 0;">
                    <label for="medioPagoSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Filtrar por medio de pago:</label>
                    <select id="medioPagoSelect" onchange="filtrarVentasPorPago('${tipo}', this.value)"
                        style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="">Todos los medios de pago</option>
                        ${mediosPagoDisponibles.map(medio => `<option value="${medio}">${medio}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        mostrarDatosVentas(ventasFiltradas, titulo, htmlDropdown, fechaSeleccionada);
    } catch (error) {
        console.error('Error en mostrarVentas:', error);
        Swal.fire('Error', 'No se pudieron cargar las ventas.', 'error');
    }
}

async function filtrarVentasPorPago(tipo, medioPago) {
    const fechaSeleccionada = document.getElementById('fechaVentas').value;
    const ventasDelDia = await ipcRenderer.invoke('venta:obtener-por-fecha', fechaSeleccionada);

    let ventasFiltradas = ventasDelDia;
    if (tipo === 'local') ventasFiltradas = ventasDelDia.filter(v => v.direccion === 'local');
    else if (tipo === 'delivery') ventasFiltradas = ventasDelDia.filter(v => v.direccion !== 'local');

    if (medioPago) {
        const mp = medioPago.toLowerCase();
        ventasFiltradas = ventasFiltradas.filter(v => {
            if (!v.modo_pago) return false;
            const modo = v.modo_pago.toLowerCase();
            return mp === 'efectivo' ? ['efectivo', 'efectivo_y_otro'].includes(modo) : modo === mp;
        });
    }

    const titulo = `${tipo === 'local' ? 'Ventas en local' : tipo === 'delivery' ? 'Ventas por delivery' : 'Todas las ventas'} (${formatearFecha(fechaSeleccionada)})` + (medioPago ? ` - Medio: ${medioPago}` : '');
    mostrarDatosVentas(ventasFiltradas, titulo, '', fechaSeleccionada);
}

async function abrirModalVentasMes() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth() + 1;

    const { value: formValues } = await Swal.fire({
        title: 'Seleccionar mes y año',
        html: `
            <select id="mesVentas">${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1 === mes ? 'selected' : ''}>${i+1}</option>`).join('')}</select>
            <select id="anioVentas">${[anio - 1, anio, anio + 1].map(y => `<option value="${y}" ${y === anio ? 'selected' : ''}>${y}</option>`).join('')}</select>`
        ,
        preConfirm: () => ({
            mes: document.getElementById('mesVentas').value,
            anio: document.getElementById('anioVentas').value
        })
    });

    if (!formValues) return;

    const datos = await ipcRenderer.invoke('venta:obtener-por-mes-anio', parseInt(formValues.anio), parseInt(formValues.mes), 'total');
    if (!datos || datos.ventas.length === 0) {
        return Swal.fire('Sin datos', 'No se encontraron ventas para ese mes.', 'info');
    }

    const total = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(datos.total);

    Swal.fire({
        title: `Resumen de ${formValues.mes}/${formValues.anio}`,
        html: `<p><strong>Cantidad:</strong> ${datos.cantidad}</p><p><strong>Total:</strong> ${total}</p>`,
        icon: 'info'
    });
}

async function cargarDatosVentas(tipo, periodo, fecha = null) {
    if (periodo === 'mes') {
        const [anio, mes] = fecha.split('-');
        return await ipcRenderer.invoke('venta:obtener-por-mes-anio', parseInt(anio), parseInt(mes), tipo);
    } else {
        const ventas = await ipcRenderer.invoke('venta:obtener-por-fecha', fecha);
        const filtradas = tipo === 'local' ? ventas.filter(v => v.direccion === 'local')
                            : tipo === 'delivery' ? ventas.filter(v => v.direccion !== 'local')
                            : ventas;
        return {
            ventas: filtradas,
            cantidad: filtradas.length,
            monto_total: filtradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0)
        };
    }
}

function formatearFecha(fechaISO) {
    const [año, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${año}`;
}

function mostrarDatosVentas(ventasFiltradas, titulo, htmlDropdown, fechaSeleccionada) {
    const total = ventasFiltradas.reduce((sum, venta) => sum + (Number(venta.total) || 0), 0);
    const totalFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS'
    }).format(total);

    Swal.fire({
        title: titulo,
        html: `
            <div style="text-align: left;">
                ${htmlDropdown}
                <p><strong>Cantidad:</strong> ${ventasFiltradas.length}</p>
                <p><strong>Total:</strong> ${totalFormateado}</p>
                <p><strong>Fecha:</strong> ${formatearFecha(fechaSeleccionada)}</p>
                ${ventasFiltradas.length > 0 ? `<p><strong>Promedio:</strong> ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(total / ventasFiltradas.length)}</p>` : ''}
            </div>`
        ,
        icon: 'info'
    });
}


module.exports = {
    registrarNuevaVenta,
    cargarVentasPorFecha,
    eliminarVenta,
    obtenerRecargosActuales,
    calcularTotalConRecargo,
    actualizarTotalConEnvio,
    quitarProducto,
    mostrarVentas,
    filtrarVentasPorPago,
    abrirModalVentasMes,
    cargarDatosVentas
};
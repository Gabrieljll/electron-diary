// =======================================================
// DEPENDENCIAS EXTERNAS
// =======================================================

// =======================================================
// IMPORTACIÓN DE MÓDULOS
// =======================================================

// =======================================================
// CONFIGURACIÓN DE FUNCIONES GLOBALES
// =======================================================
window.solicitarContrasena = window.electron.solicitarContrasena;
window.cargarProductos = window.electron.cargarProductos;
window.agregarProductoVenta = window.electron.agregarProductoVenta;
window.agregarNuevoProducto =window.electron.agregarNuevoProducto;
window.editarProducto =window.electron.editarProducto;
window.borrarProducto =window.electron.borrarProducto;
window.fichaClienteEditada =window.electron.fichaClienteEditada;
window.abrirModalAgregarCombo =window.electron.abrirModalAgregarCombo;
window.agregarNuevoCombo =window.electron.agregarNuevoCombo;
window.editarCombo =window.electron.editarCombo;
window.eliminarCombo =window.electron.eliminarCombo;
window.registrarNuevaVenta =window.electron.registrarNuevaVenta;
window.cargarVentasPorFecha =window.electron.cargarVentasPorFecha;
window.eliminarVenta =window.electron.eliminarVenta;
window.mostrarVista =window.electron.mostrarVista;
window.toggleDetalleVenta =window.electron.toggleDetalleVenta;
window.abrirModalAgregarProducto =window.electron.abrirModalAgregarProducto;
window.abrirModalConfigurarRecargos =window.electron.abrirModalConfigurarRecargos;
window.abrirModalConfigurarDescuentos =window.electron.abrirModalConfigurarDescuentos;
window.quitarProducto =window.electron.quitarProducto;
window.actualizarTipoVenta =window.electron.actualizarTipoVenta;
window.actualizarTotalConEnvio =window.electron.actualizarTotalConEnvio;
window.mostrarVentas =window.electron.mostrarVentas;
window.filtrarVentasPorPago =window.electron.filtrarVentasPorPago;
window.abrirModalVentasMes =window.electron.abrirModalVentasMes;
window.descargarExcelComprasRealizadas =window.electron.descargarExcelComprasRealizadas;
window.descargarGananciasDelDia =window.electron.descargarGananciasDelDia;
window.filtrarPorTexto =window.electron.filtrarPorTexto;
window.filtrarPorTextoCombo =window.electron.filtrarPorTextoCombo;
window.filtrarPorFecha =window.electron.filtrarPorFecha;
window.limpiarFiltro =window.electron.limpiarFiltro;
window.filtroFecha =window.electron.filtroFecha;

// =======================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// =======================================================
function configurarEventListeners() {
    document.getElementById('cantidadProducto').addEventListener('input', utils.validarStock);

    document.getElementById("filtroTexto").addEventListener("input", products.filtrarPorTexto);
    document.getElementById("filtroTextoCombo").addEventListener("input", combos.filtrarPorTextoCombo);

    ['metodoPago', 'costoEnvio'].forEach(id => {
        document.getElementById(id).addEventListener('change', sales.actualizarTotalConEnvio);
    });

    document.getElementById('fechaVentas').addEventListener('change', async (event) => {
        const nuevaFecha = event.target.value;
        document.getElementById("fechaVenta").value = nuevaFecha;
        await Promise.all([
            sales.cargarVentasPorFecha(nuevaFecha),
            sales.actualizarValoresVentas(nuevaFecha)
        ]);
    });

    document.getElementById('fechaVenta').addEventListener('change', async (event) => {
        const nuevaFecha = event.target.value;
        document.getElementById('fechaVentas').value = nuevaFecha;
        await Promise.all([
            sales.cargarVentasPorFecha(nuevaFecha),
            sales.actualizarValoresVentas(nuevaFecha)
        ]);
    });

    document.getElementById('nombreCliente').addEventListener('input', async function () {
        const nombreCliente = this.value.trim();
        const listaSugerencias = document.getElementById('clienteSugerencias');

        if (nombreCliente.length > 0) {
            const clientes = await ipcRenderer.invoke('cliente:buscar-por-nombre', nombreCliente);
            listaSugerencias.innerHTML = '';

            if (clientes.length > 0) {
                listaSugerencias.style.display = 'block';
                clientes.forEach(cliente => {
                    const item = document.createElement('li');
                    item.classList.add('list-group-item');
                    item.textContent = cliente.nombre_cliente;
                    item.addEventListener('click', function () {
                        document.getElementById('nombreCliente').value = cliente.nombre_cliente;
                        document.getElementById('telefono').value = cliente.telefono;
                        listaSugerencias.style.display = 'none';
                    });
                    listaSugerencias.appendChild(item);
                });
            } else {
                listaSugerencias.style.display = 'none';
            }
        } else {
            listaSugerencias.style.display = 'none';
        }
    });

    document.addEventListener('click', function (e) {
        const listaSugerencias = document.getElementById('clienteSugerencias');
        const inputNombre = document.getElementById('nombreCliente');
        if (!inputNombre.contains(e.target) && !listaSugerencias.contains(e.target)) {
            listaSugerencias.style.display = 'none';
        }
    });
}

// =======================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =======================================================
async function inicializarAplicacion() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaVenta').value = hoy;
    document.getElementById('fechaVentas').value = hoy;

    await Promise.all([
        products.cargarProductos(),
        sales.cargarVentasPorFecha(hoy),
        sales.actualizarValoresVentas(hoy)
    ]);

    ui.actualizarTipoVenta();
    setInterval(() => sales.actualizarValoresVentas(hoy), 300000);

    return true;
}

// =======================================================
// INICIO DE LA APLICACIÓN
// =======================================================
document.addEventListener("DOMContentLoaded", async () => {
    configurarEventListeners();
    await inicializarAplicacion();
    utils.init();
});


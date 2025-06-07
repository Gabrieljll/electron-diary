const { contextBridge, ipcRenderer } = require('electron');
const auth = require('./modules/auth.js');
const products = require('./modules/products.js');
const sales = require('./modules/sales.js');
const combos = require('./modules/combos.js');
const ui = require('./modules/ui.js');
const utils = require('./modules/utils.js');

// Exponer el API principal
contextBridge.exposeInMainWorld('electronAPI', {
  // Productos
  getProductos: () => ipcRenderer.invoke('get-productos'),
  nuevoProducto: (producto) => ipcRenderer.invoke('nuevo-producto', producto),
  borrarProducto: (id) => ipcRenderer.invoke('borrar-producto', id),
  actualizarProducto: (id, producto) => ipcRenderer.invoke('actualizar-producto', id, producto),
  getProductoPorId: (id) => ipcRenderer.invoke('producto:obtener-por-id', id),


  // Ventas
  registrarVenta: (ventaData) => ipcRenderer.invoke('registrar-venta', ventaData),
  obtenerVentasPorFecha: (fecha) => ipcRenderer.invoke('obtener-ventas-por-fecha', fecha),
  eliminarVenta: (idVenta) => ipcRenderer.invoke('eliminar-venta', idVenta),
  descargarGananciasDia: (fecha) => ipcRenderer.invoke('descargar-ganancias-dia', fecha),

  // Combos
  getCombos: () => ipcRenderer.invoke('get-combos'),
  nuevoCombo: (combo, detalles) => ipcRenderer.invoke('nuevo-combo', combo, detalles),

  // Notificaciones
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
});

//A ESTA PARTE FALTA REVISARR LAS FUNCIONES QUE FALTAN O BIEN REVISAR QUE LAS FUNCIONES EXISTAN DENTRO DE LOS ARCHIVOS DE LOS QUE SALEN.
contextBridge.exposeInMainWorld('electron', {
  solicitarContrasena: auth.solicitarContrasena,
  cargarProductos: products.cargarProductos,
  agregarProductoVenta: products.agregarProductoVenta,
  agregarNuevoProducto: products.agregarNuevoProducto,
  editarProducto: products.editarProducto,
  borrarProducto: products.borrarProducto,
  fichaClienteEditada: products.fichaClienteEditada,
  abrirModalAgregarCombo: combos.abrirModalAgregarCombo,
  agregarNuevoCombo: combos.agregarNuevoCombo,
  editarCombo: combos.editarCombo,
  eliminarCombo: combos.eliminarCombo,
  registrarNuevaVenta: sales.registrarNuevaVenta,
  cargarVentasPorFecha: sales.cargarVentasPorFecha,
  eliminarVenta: sales.eliminarVenta,
  mostrarVista: ui.mostrarVista,
  toggleDetalleVenta: ui.toggleDetalleVenta,
  abrirModalAgregarProducto: ui.abrirModalAgregarProducto,
  abrirModalConfigurarRecargos: ui.abrirModalConfigurarRecargos,
  abrirModalConfigurarDescuentos: ui.abrirModalConfigurarDescuentos,
  quitarProducto: sales.quitarProducto,
  actualizarTipoVenta: ui.actualizarTipoVenta,
  actualizarTotalConEnvio: sales.actualizarTotalConEnvio,
  mostrarVentas: sales.mostrarVentas,
  filtrarVentasPorPago: sales.filtrarVentasPorPago,
  abrirModalVentasMes: sales.abrirModalVentasMes,
  descargarExcelComprasRealizadas: sales.descargarExcelComprasRealizadas,
  descargarGananciasDelDia: sales.descargarGananciasDelDia,
  filtrarPorTexto: products.filtrarPorTexto,
  filtrarPorTextoCombo: combos.filtrarPorTextoCombo,
  filtrarPorFecha: products.filtrarPorFecha,
  limpiarFiltro: products.limpiarFiltro,
  filtroFecha: products.filtroFecha
});


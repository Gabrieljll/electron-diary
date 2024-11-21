const Swal = require('sweetalert2');
const remote = require("@electron/remote");
const main = remote.require('./main');
const fs = require('fs');
const { nativeImage } = require('electron');
const path = require('path');
const { ipcRenderer } = require('electron');


// Variables y constantes iniciales
let arrayProductos = [];
let filtroFecha = false;
let fechaFiltroSeleccionada = '';
let filtroTexto = '';

// Obtiene el contenedor de la tabla
const divFichas = document.getElementById('fichas');

// Configuración de la contraseña
const CONTRASENA = "pombero91124";

// Función para solicitar contraseña
async function solicitarContrasena() {
    const { value: password } = await Swal.fire({
        title: 'Autenticación requerida',
        input: 'password',
        inputLabel: 'Ingresa la contraseña para continuar',
        inputPlaceholder: 'Contraseña',
        inputAttributes: {
            maxlength: 20,
            autocapitalize: 'off',
            autocorrect: 'off'
        },
        showCancelButton: true
    });

    return password === CONTRASENA;
}


async function descargarExcelComprasRealizadas(){
    try {
        const filePath = await ipcRenderer.invoke('descargar-compras-realizadas');
        const link = document.createElement('a');
        link.href = `file://${filePath}`;
        link.download = `compras_realizadas_clientes.xlsx`;
        link.click();
    } catch (error) {
        console.error("Error al descargar el archivo:", error);
    } 
}

async function descargarGananciasDelDia() {
    const tieneAcceso = await solicitarContrasena();
    if (!tieneAcceso) {
        Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
        return;
    }

    const fecha = document.getElementById('fechaVentas').value;
    if (!fecha) {
        alert("Por favor, seleccione una fecha.");
        return;
    }

    try {
        const filePath = await ipcRenderer.invoke('descargar-ganancias-dia', fecha);
        const link = document.createElement('a');
        link.href = `file://${filePath}`;
        link.download = `ganancias_${fecha}.xlsx`;
        link.click();
    } catch (error) {
        console.error("Error al descargar el archivo:", error);
    }
}

async function cargarProductos() {
    const productos = await main.getProductos();
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const inputProducto = document.getElementById('inputProducto');
    const dropdownProductos = document.getElementById('dropdownProductos');

    // Función para mostrar y filtrar los productos
    inputProducto.addEventListener('input', () => {
        const searchTerm = inputProducto.value.toLowerCase();
        const filteredProductos = productos.filter(p => p.nombre.toLowerCase().includes(searchTerm));
        
        dropdownProductos.innerHTML = filteredProductos.map(p => `
            <li><a href="#" class="dropdown-item" data-id="${p.id}" data-stock="${p.cantidad_disponible}" data-precio="${p.precio}">
                ${p.nombre}
            </a></li>
        `).join('');

        dropdownProductos.style.display = filteredProductos.length ? 'block' : 'none';
    });

    // Selección de producto al hacer clic en una opción
    dropdownProductos.addEventListener('click', (event) => {
        const selectedProduct = event.target.closest('.dropdown-item');
        if (selectedProduct) {
            inputProducto.value = selectedProduct.textContent;
            inputProducto.dataset.productId = selectedProduct.getAttribute('data-id');
            inputProducto.dataset.stock = selectedProduct.getAttribute('data-stock');
            inputProducto.dataset.precio = selectedProduct.getAttribute('data-precio');
            dropdownProductos.style.display = 'none';
        }
    });

    // Cierra el dropdown si el usuario hace clic fuera de él
    document.addEventListener('click', (event) => {
        if (!dropdownProductos.contains(event.target) && event.target !== inputProducto) {
            dropdownProductos.style.display = 'none';
        }
    });
}

//document.getElementById('selectProducto').addEventListener('change', validarStock);
document.getElementById('cantidadProducto').addEventListener('input', validarStock);

function validarStock() {
    const selectProducto = document.getElementById('selectProducto');
    const inputCantidad = document.getElementById('cantidadProducto');

    const selectedOption = selectProducto.options[selectProducto.selectedIndex];
    const stockDisponible = parseInt(selectedOption.getAttribute('data-stock'));
    const cantidadSeleccionada = parseInt(inputCantidad.value);

    if (cantidadSeleccionada > stockDisponible) {
        Swal.fire('Stock insuficiente', `No hay suficiente stock para "${selectedOption.text}". Quedan ${stockDisponible} unidades.`, 'warning');
        inputCantidad.value = stockDisponible; // Ajustar a la cantidad máxima
    }
}

cargarProductos();

let productosSeleccionados = [];


// Actualizar stock en el frontend antes de agregar un producto
async function obtenerStockActualizado(idProducto) {
    const productoActualizado = await main.getProductoById(idProducto); // Obtén el producto específico desde la BD
    return productoActualizado.cantidad_disponible;
}

async function agregarProductoVenta() {
    // Referencias a elementos correctos en tu estructura actual
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    const agregarBtn = document.querySelector('button[onclick="agregarProductoVenta()"]');

    // Obtener datos del producto seleccionado desde los atributos del input
    const idProducto = inputProducto.dataset.productId; // ID del producto seleccionado
    const nombreProducto = inputProducto.value; // Nombre del producto
    const precioProducto = parseFloat(inputProducto.dataset.precio); // Precio del producto
    const cantidad = parseInt(inputCantidad.value, 10); // Cantidad ingresada

    // Verificar que el producto haya sido seleccionado y los datos sean válidos
    if (!idProducto || !nombreProducto) {
        Swal.fire('Error', 'Selecciona un producto válido del dropdown.', 'error');
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        Swal.fire('Error', 'Ingresa una cantidad válida.', 'error');
        return;
    }

    // Deshabilitar el botón mientras se valida el stock
    agregarBtn.disabled = true;

    // Obtener el stock más reciente
    const stockDisponible = await obtenerStockActualizado(idProducto);

    // Validar stock
    if (cantidad > stockDisponible) {
        Swal.fire('Stock insuficiente', `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible} unidades.`, 'warning');
        agregarBtn.disabled = false;
        return;
    }

    // Busca si el producto ya está en la lista de productos seleccionados
    const productoExistente = productosSeleccionados.find(p => p.id === idProducto);

    if (productoExistente) {
        // Si el producto ya está en la lista, suma la cantidad nueva
        const nuevaCantidadTotal = productoExistente.cantidad + cantidad;

        if (nuevaCantidadTotal > stockDisponible) {
            Swal.fire('Stock insuficiente', `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible - productoExistente.cantidad} unidades adicionales disponibles.`, 'warning');
            agregarBtn.disabled = false;
            return;
        }

        productoExistente.cantidad = nuevaCantidadTotal;
    } else {
        // Si no está en la lista, agregar el producto
        productosSeleccionados.push({
            id: idProducto,
            nombre: nombreProducto,
            cantidad,
            precio: precioProducto
        });
    }

    // Limpieza de campos
    inputProducto.value = '';
    inputProducto.dataset.productId = '';
    inputProducto.dataset.stock = '';
    inputProducto.dataset.precio = '';
    inputCantidad.value = '';

    // Habilitar el botón nuevamente
    agregarBtn.disabled = false;

    // Actualizar el resumen de productos
    actualizarResumenVenta();
}


function actualizarResumenVenta() {
    const listaResumen = document.getElementById('listaResumen');
    listaResumen.innerHTML = '';

    productosSeleccionados.forEach((producto, index) => {
        const item = document.createElement('li');
        item.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
        
        item.textContent = `${producto.cantidad} - ${producto.nombre} ($${producto.precio.toFixed(2)} c/u)`;
        
        const botonEliminar = document.createElement('button');
        botonEliminar.classList.add('btn', 'btn-light', 'btn-md', 'm-2', 'quitarProducto');
        botonEliminar.innerHTML = 'x';
        botonEliminar.onclick = () => quitarProducto(index);

        item.appendChild(botonEliminar);
        listaResumen.appendChild(item);
    });

    actualizarTotalConEnvio();
}

function quitarProducto(index) {
    productosSeleccionados.splice(index, 1);
    actualizarResumenVenta();
}

function calcularTotalProductos() {
    return productosSeleccionados.reduce((total, producto) => total + (producto.precio * producto.cantidad), 0);
}

function actualizarTotalConEnvio() {
    const costoEnvio = parseFloat(document.getElementById('costoEnvio').value) || 0;
    const totalProductos = calcularTotalProductos();
    const totalConEnvio = totalProductos + costoEnvio;

    document.getElementById('totalConEnvio').textContent = `$${totalConEnvio.toFixed(2)}`;
}

async function registrarNuevaVenta() {
    const cliente = document.getElementById('nombreCliente').value;
    const telefono = document.getElementById('telefono').value;
    const direccion = document.getElementById('direccion').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const total = parseFloat(document.getElementById('totalConEnvio').textContent.replace('$', ''));
    const productos = productosSeleccionados.map(producto => ({
        id: producto.id,
        cantidad: producto.cantidad
    }));

    // Validar que haya un cliente y productos seleccionados
    if (!cliente || productosSeleccionados.length === 0) {
        Swal.fire('Error', 'Por favor, completa todos los campos y selecciona al menos un producto.', 'error');
        return;
    }
    if (!direccion) {
        Swal.fire('Error', 'Por favor ingresa una dirección válida.', 'error');
        return;
    }

    // Verificar que haya suficiente stock para cada producto
    for (const producto of productos) {
        const stockProducto = await main.getProductoById(producto.id); // Obtener producto desde el backend
        if (stockProducto.cantidad_disponible < producto.cantidad) {
            Swal.fire('Error', `No hay suficiente stock para el producto ${stockProducto.nombre}. Solo hay ${stockProducto.cantidad_disponible} unidades disponibles.`, 'error');
            return;
        }
    }

    try {
        await main.registrarVenta({
            productos,
            cliente,
            telefono,
            direccion,
            metodoPago,
            total
        });

        Swal.fire('Venta registrada', 'La venta se ha registrado correctamente y el stock ha sido actualizado.', 'success');

        // Limpiar el formulario y la lista de productos seleccionados
        document.getElementById('nombreCliente').value = '';
        document.getElementById('telefono').value = '';
        document.getElementById('direccion').value = '';
        document.getElementById('cantidadProducto').value = '';
        document.getElementById('metodoPago').value = '';
        document.getElementById('costoEnvio').value = '';
        productosSeleccionados = [];

        actualizarResumenVenta();
        // ** Actualizar la lista de ventas después de registrar la venta **
        const fechaHoy = new Date();
        const fechaFormateada = fechaHoy.getFullYear() + '-' 
        + (fechaHoy.getMonth() + 1).toString().padStart(2, '0') + '-' 
        + fechaHoy.getDate().toString().padStart(2, '0');
        await cargarVentasPorFecha(fechaFormateada); // Actualiza la lista con la fecha de hoy
        await actualizarProductos()
            
    } catch (error) {
        console.error('Error al registrar la venta:', error);
        Swal.fire('Error', 'Hubo un problema al registrar la venta. Inténtalo nuevamente.', 'error');
    }
}




async function mostrarVista(vista) {
    const divVentas = document.getElementById('divVentas');
    const divStock = document.getElementById('divStock');
    const ventasButton = document.querySelector('.nav-buttons:nth-child(1)');
    const stockButton = document.querySelector('.nav-buttons:nth-child(2)');
    
    if (vista === 'ventas') {
        window.location.reload()
        divVentas.style.display = 'flex';
        divStock.style.display = 'none';
        ventasButton.classList.add('active');
        stockButton.classList.remove('active');
        await actualizarProductos();
    } else if (vista === 'stock') {
        const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        }

        divVentas.style.display = 'none';
        divStock.style.display = 'block';
        await actualizarProductos();
        ventasButton.classList.remove('active');
        stockButton.classList.add('active');
    }
}



// Al cargar la página, obtener ventas del día actual
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaVentas').value = hoy;
    cargarVentasPorFecha(hoy);
});

// Función para cargar las ventas según la fecha seleccionada
async function cargarVentasPorFecha(fecha = null) {
    const fechaSeleccionada = fecha || document.getElementById('fechaVentas').value;
    const ventas = await main.obtenerVentasPorFecha(fechaSeleccionada);

    const ventasAgrupadas = ventas.reduce((acc, venta) => {
        if (!acc[venta.id]) {
            acc[venta.id] = {
                ...venta,
                productos: []
            };
        }
        acc[venta.id].productos.push({
            cantidad: venta.cantidad,
            nombre: venta.producto_nombre,
            precio: venta.producto_precio
        });
        return acc;
    }, {});

    const listaVentas = document.getElementById('listaVentasRealizadas');
    listaVentas.innerHTML = '';

    Object.values(ventasAgrupadas).forEach(venta => {
        console.log(venta)
        const ventaItem = document.createElement('li');
        ventaItem.classList.add('list-group-item');
        
        ventaItem.innerHTML = `
            <div class="divDetalleVentasYBotones">
                <div style="width: 50%">
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
                    ${venta.productos.map(producto => `
                        <li class="list-group-item">
                            ${producto.cantidad} x ${producto.nombre} - $${producto.precio}
                        </li>`).join('')}
                </ul>
            </div>
        `;

        listaVentas.appendChild(ventaItem);
    });
}

async function eliminarVenta(idVenta) {
    const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción eliminará la venta permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) {
        return;
    }

    try {
        await main.eliminarVenta(idVenta); // Método para eliminar venta en el backend
        Swal.fire('Eliminado', 'La venta ha sido eliminada correctamente.', 'success');
        
        // Recargar la lista de ventas
        const fechaSeleccionada = document.getElementById('fechaVentas').value;
        await cargarVentasPorFecha(fechaSeleccionada);
    } catch (error) {
        console.error("Error al eliminar la venta:", error);
        Swal.fire('Error', 'No se pudo eliminar la venta. Intenta nuevamente.', 'error');
    }
}
// Función para mostrar/ocultar el detalle de productos de una venta
function toggleDetalleVenta(ventaId) {
    const detalleDiv = document.getElementById(`detalleVenta${ventaId}`);
    detalleDiv.style.display = detalleDiv.style.display === 'none' ? 'block' : 'none';
}


// Función para abrir el modal de agregar producto
function abrirModalAgregarProducto() {
    Swal.fire({
        html: `
        <h1 class="tituloModal">Nuevo Producto</h1>
        <hr>
        <div class="modalAgregar col-md-12 p-4 my-auto">
            <form id="formulario_producto">
                <div class="form-group">
                    <label class="mt-2" for="nombre"><h5>Nombre</h5></label>
                    <input type="text" id="nombre" placeholder="Nombre" class="form-control" required>
                </div>
                <div class="form-group">
                    <label class="mt-2" for="precio"><h5>Precio</h5></label>
                    <input type="number" id="precio" placeholder="Precio" class="form-control" required>
                </div>
                <div class="form-group">
                    <label class="mt-2" for="descripcion"><h5>Descripción</h5></label>
                    <input type="text" id="descripcion" placeholder="Descripción" class="form-control">
                </div>
                <div class="form-group">
                    <label class="mt-2" for="cantidad"><h5>Cantidad</h5></label>
                    <input type="number" id="cantidad" placeholder="Cantidad" class="form-control" required>
                </div>
                <button type="button" onclick="agregarNuevoProducto()" class="btn btn-success mt-1">Guardar</button>
            </form>
        </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
    });
}

// Agrega un nuevo producto
// Function to add a new product
async function agregarNuevoProducto() {
    const nombreProducto = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const descripcion = document.getElementById('descripcion').value;
    const cantidad = document.getElementById('cantidad').value;

    if (nombreProducto && precio && cantidad) {
        const nuevoProducto = { nombre: nombreProducto, precio: precio, descripcion: descripcion, cantidad_disponible: cantidad };
        await main.nuevoProducto(nuevoProducto);
        Swal.close();
        await actualizarProductos();
    } else {
        Swal.fire('Error', 'Por favor, completa todos los campos requeridos', 'error');
    }
}

// Actualiza la lista de productos aplicando filtros de texto y fecha
async function actualizarProductos() {
    const productos = await main.getProductos();

    // Filtra por texto y fecha
    const productosFiltrados = productos.filter(p => {
        const coincideTexto = filtroTexto
            ? p.nombre.toLowerCase().includes(filtroTexto.toLowerCase())
            : true;
        const coincideFecha = filtroFecha
            ? p.fecha === fechaFiltroSeleccionada
            : true;
        return coincideTexto && coincideFecha;
    });

    renderListaProductos(productosFiltrados);
}

// Renderiza la lista de productos en la tabla
// Adjust render function to handle missing images
function renderListaProductos(productos) {
    divFichas.innerHTML = `
        <table class="table table-striped table-bordered">
            <thead class="thead-dark">
                <tr>
                    <th>Id</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Descripción</th>
                    <th>Cantidad Disponible</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${productos.map(p => `
                    <tr>
                        <td>${p.id}</td>
                        <td>${p.nombre}</td>
                        <td>${p.precio}</td>
                        <td>${p.descripcion}</td>
                        <td>${p.cantidad_disponible}</td>
                        <td>
                            <button onclick="editarProducto(${p.id})" class="btn btn-primary btn-sm">EDITAR</button>
                            <button onclick="borrarProducto(${p.id})" class="btn btn-danger btn-sm">BORRAR</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
}

// Función para filtrar productos por texto
function filtrarPorTexto(event) {
    filtroTexto = event.target.value;
    actualizarProductos();
}

// Configura el filtro de fecha
function filtrarPorFecha(fecha) {
    filtroFecha = true;
    fechaFiltroSeleccionada = fecha;
    actualizarProductos();
}

// Limpia todos los filtros
function limpiarFiltro() {
    filtroTexto = '';
    filtroFecha = false;
    fechaFiltroSeleccionada = '';
    actualizarProductos();
}

async function editarProducto(idProducto){      
    const productoDevuelto = await main.getProductoById(idProducto)
    Swal.fire({
        html:`
        <h1 class="tituloModal">Editar Producto</h1>
        <hr>
        <div id="modal_${productoDevuelto.id}" class="modalEditar" class="col-md-12 p-4 my-auto">
        <div action="" id="formulario_producto_edit">
            <div class="form-group">
                <label class="mt-2" for=""><h5>Nombre</h5></label>
                <input type="text" id="nombreProducto_edit" placeholder="Nombre del producto" class="form-control" value="${productoDevuelto.nombre}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5>Precio</h5></label>
                <input type="number" id="precio_edit" placeholder="Precio" class="form-control" value="${productoDevuelto.precio}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5>descripcion</h5></label>
                <input type="text" id="descripcion_edit" placeholder="Descripción" class="form-control" value="${productoDevuelto.descripcion}" autofocus required="false">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5>Cantidad</h5></label>
                <input type="number" id="cantidad_edit" placeholder="Cantidad" class="form-control" value="${productoDevuelto.cantidad_disponible}" autofocus required="true">
            </div>
            <button onclick="fichaClienteEditada(${productoDevuelto.id})" class="btn btn-success mt-1">
                EDITAR
            </button>
        </div>                
    </div>
    `
        ,          
        showCloseButton: true,
        showCancelButton: false,
        showConfirmButton: false,
        focusConfirm: false
    })
    
}

async function fichaClienteEditada(idProductoEditado) {
    const nombreProducto_edit = document.getElementById('nombreProducto_edit').value;
    const precio_edit = document.getElementById('precio_edit').value;
    const descripcion_edit = document.getElementById('descripcion_edit').value;
    const cantidad_edit = document.getElementById('cantidad_edit').value;

    const productoEditado = {
        nombre: nombreProducto_edit,
        precio: precio_edit,
        descripcion: descripcion_edit,
        cantidad_disponible: cantidad_edit
    };

    await main.actualizarProducto(idProductoEditado, productoEditado);    
    Swal.close();
    await actualizarProductos();
}

function validarCamposFormulario(nombreProducto, precio, descripcion, cantidad){
    if( nombreProducto.value != '' && precio.value != '' && cantidad.value != '' ){
        return true
    } else {
        return false;
    }
}

async function borrarProducto(id){
    Swal.fire({
        title: '¿Desea eliminar esta ficha?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'rgb(91 191 175',
        cancelButtonColor: 'rgb(255 85 85)',
        confirmButtonText: 'Si, borrar',
        cancelButtonText: 'Cancelar'
      }).then(async (result) => {
        if (result.isConfirmed) {
          Swal.fire(
            'Listo!',
            'La ficha fue borrada.',
            'success'
          )
          await main.borrarRegistroProducto(id)
          await actualizarProductos()
        }
      })
    return
}

// Inicialización de eventos y datos
document.getElementById("filtroTexto").addEventListener("input", filtrarPorTexto);
async function init() {
    await actualizarProductos();
}
init();

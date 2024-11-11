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
let nombreImagenGuardada = '';

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
    const productos = await main.getProductos(); // Llama a la función que obtiene los productos desde la base de datos
    const selectProducto = document.getElementById('selectProducto');
    
    // Cargar opciones de productos
    selectProducto.innerHTML = productos.map(p => `<option value="${p.id}" data-stock="${p.cantidad_disponible}" data-precio="${p.precio}">${p.nombre}</option>`).join('');
}

document.getElementById('selectProducto').addEventListener('change', validarStock);
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

function agregarProductoVenta() {
    const selectProducto = document.getElementById('selectProducto');
    const inputCantidad = document.getElementById('cantidadProducto');

    const idProducto = selectProducto.value;
    const nombreProducto = selectProducto.options[selectProducto.selectedIndex].text;
    const precioProducto = parseFloat(selectProducto.options[selectProducto.selectedIndex].getAttribute('data-precio'));
    const cantidad = parseInt(inputCantidad.value);
    const stockDisponible = parseInt(selectProducto.options[selectProducto.selectedIndex].getAttribute('data-stock'));

    if (cantidad <= 0 || isNaN(cantidad)) {
        Swal.fire('Error', 'Ingresa una cantidad válida.', 'error');
        return;
    }

    // Busca si el producto ya está en la lista de productos seleccionados
    const productoExistente = productosSeleccionados.find(p => p.id === idProducto);

    if (productoExistente) {
        // Si el producto ya está en la lista, calcula la cantidad total con la nueva
        const nuevaCantidadTotal = productoExistente.cantidad + cantidad;

        if (nuevaCantidadTotal > stockDisponible) {
            Swal.fire('Stock insuficiente', `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible - productoExistente.cantidad} unidades adicionales disponibles.`, 'warning');
            return;
        }

        // Si hay suficiente stock, incrementa la cantidad del producto existente
        productoExistente.cantidad = nuevaCantidadTotal;
    } else {
        // Si el producto no está en la lista, valida el stock y agrégalo
        if (cantidad > stockDisponible) {
            Swal.fire('Stock insuficiente', `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible} unidades.`, 'warning');
            return;
        }

        productosSeleccionados.push({ id: idProducto, nombre: nombreProducto, cantidad, precio: precioProducto });
    }

    // Actualizar el resumen de venta y limpiar el campo de cantidad
    actualizarResumenVenta();
    inputCantidad.value = '';
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

    try {
        // Llamar a la función `registrarVenta` en `main.js`
        await main.registrarVenta({
            productos,
            cliente,
            telefono,
            direccion,
            total
        });

        Swal.fire('Venta registrada', 'La venta se ha registrado correctamente y el stock ha sido actualizado.', 'success');

        // Limpiar el formulario y la lista de productos seleccionados
        document.getElementById('nombreCliente').value = '';
        document.getElementById('telefono').value = '';
        document.getElementById('direccion').value = '';
        document.getElementById('cantidadProducto').value = '';
        document.getElementById('costoEnvio').value = '';
        productosSeleccionados = [];

        actualizarResumenVenta();
        // ** Actualizar la lista de ventas después de registrar la venta **
        const fechaHoy = new Date().toISOString().split('T')[0];
        await cargarVentasPorFecha(fechaHoy); // Actualiza la lista con la fecha de hoy
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
        divVentas.style.display = 'flex';
        divStock.style.display = 'none';
        ventasButton.classList.add('active');
        stockButton.classList.remove('active');
    } else if (vista === 'stock') {
        const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        }

        divVentas.style.display = 'none';
        divStock.style.display = 'block';
        actualizarProductos();
        ventasButton.classList.remove('active');
        stockButton.classList.add('active');
    }
}


/* async function agregarNuevaVenta() {
    const cliente = document.getElementById('nombreCliente').value;
    const resumenProductos = document.getElementById('listaResumen'); // Contenedor del resumen de productos
    const productosSeleccionados = [];

    // Comprobar que el resumen tenga productos listados
    if (!cliente || resumenProductos.children.length === 0) {
        Swal.fire('Error', 'Por favor, completa todos los campos requeridos y asegúrate de seleccionar al menos un producto.', 'error');
        return;
    }

    // Obtener productos y cantidades desde el resumen
    resumenProductos.querySelectorAll('.resumen-item').forEach(item => {
        const idProducto = item.dataset.productoId;
        const cantidad = parseInt(item.dataset.cantidad);

        productosSeleccionados.push({ id: idProducto, cantidad: cantidad });
    });

    // Descontar stock y guardar la venta
    for (const producto of productosSeleccionados) {
        const { id, cantidad } = producto;

        // Obtén el producto de la base de datos y verifica el stock
        const productoDB = await main.getProductoById(id);
        if (productoDB.cantidad_disponible < cantidad) {
            Swal.fire('Error', `Stock insuficiente para el producto ${productoDB.nombre}.`, 'error');
            return;
        }

        // Descontar cantidad y actualizar en la base de datos
        const nuevaCantidad = productoDB.cantidad_disponible - cantidad;
        await main.actualizarProducto(id, { cantidad_disponible: nuevaCantidad });
    }

    // Guardar información de la venta en la base de datos
    await main.nuevaVenta({ cliente, productos: productosSeleccionados });
    Swal.fire('Venta registrada', 'La venta se ha registrado correctamente.', 'success');

    // Limpiar formulario y resumen de productos
    document.getElementById('nombreCliente').value = '';
    resumenProductos.innerHTML = '';
} */


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
        const ventaItem = document.createElement('li');
        ventaItem.classList.add('list-group-item');
        
        ventaItem.innerHTML = `
            <strong>Cliente:</strong> ${venta.cliente} <br>
            <strong>Dirección:</strong> ${venta.direccion} <br>
            <strong>Teléfono:</strong> ${venta.telefono} <br>
            <strong>Total:</strong> $${venta.total.toFixed(2)}
            <button class="btn btn-link btn-sm mt-1 btn-verDetalle" onclick="toggleDetalleVenta(${venta.id})">Ver Detalle</button>
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
                    <label class="mt-2" for="imagen"><h5>Imagen</h5></label>
                    <input type="file" id="imagen" accept="image/*" onchange="cargarImagen(event, 'imagen')" class="form-control" required>
                    <img id="preview" src="" alt="Vista previa de la imagen seleccionada" class="mt-2">
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
    const imagen = document.getElementById('imagen').getAttribute('value'); // Retrieve the stored image name
    const cantidad = document.getElementById('cantidad').value;

    if (nombreProducto && precio && imagen && cantidad) {
        const nuevoProducto = { nombre: nombreProducto, precio: precio, descripcion: descripcion, imagen: imagen, cantidad_disponible: cantidad };
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
                    <th>Imagen</th>
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
                        <td>
                            <img src="img/productos/${p.imagen || 'default.png'}" width="50" 
                                onerror="this.src='img/productos/default.png';">
                        </td>
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
                <label class="mt-2" for=""><h5>Imagen</h5></label>
                <input type="file" id="imagen_edit" accept="image/*" onchange="cargarImagen(event, 'imagen_edit')" class="form-control" value="${productoDevuelto.imagen}" autofocus required="true">
                <img id="preview" src="img/productos/${productoDevuelto.imagen}" alt="Vista previa de la imagen seleccionada">

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

    // Utilizar el nombre de la imagen actualizada o existente
    const productoEditado = {
        nombre: nombreProducto_edit,
        precio: precio_edit,
        descripcion: descripcion_edit,
        imagen: nombreImagenGuardada || document.getElementById('imagen_edit').getAttribute('value'),
        cantidad_disponible: cantidad_edit
    };

    await main.actualizarProducto(idProductoEditado, productoEditado);    
    Swal.close();
    await actualizarProductos();
}

function validarCamposFormulario(nombreProducto, precio, descripcion, imagen, cantidad){
    if( nombreProducto.value != '' && precio.value != '' && imagen.value != '' && cantidad.value != '' ){
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




function cargarImagen(event, imagenId) {
    const file = event.target.files[0];
    if (file) {
        const imagePath = path.join(__dirname, 'img/productos', file.name);

        // Cargar la imagen
        const image = nativeImage.createFromPath(imagePath);
        if (!image.isEmpty()) {
            document.getElementById('preview').src = image.toDataURL();

            // Verificar si el elemento con ID `imagenId` existe
            const imagenElement = document.getElementById(imagenId);
            if (imagenElement) {
                imagenElement.setAttribute('value', file.name);
            } else {
                console.error(`Elemento con ID ${imagenId} no encontrado.`);
            }
        } else {
            console.error('No se pudo cargar la imagen.');
        }
    }
}


// Inicialización de eventos y datos
document.getElementById("filtroTexto").addEventListener("input", filtrarPorTexto);
async function init() {
    await actualizarProductos();
}
init();

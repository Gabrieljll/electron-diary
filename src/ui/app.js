const Swal = require('sweetalert2');
const remote = require("@electron/remote");
const main = remote.require('./main');
const fs = require('fs');
const { nativeImage } = require('electron');
const path = require('path');
// Variables y constantes iniciales
let arrayProductos = [];
let filtroFecha = false;
let fechaFiltroSeleccionada = '';
let filtroTexto = '';
let nombreImagenGuardada = '';

// Obtiene el contenedor de la tabla
const divFichas = document.getElementById('fichas');

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

const Swal = require('sweetalert2');
const remote = require("@electron/remote");
const main = remote.require('./main');
const fs = require('fs');
const path = require('path');

// Variables y constantes iniciales
let arrayProductos = [];
let filtroFecha = false;
let fechaFiltroSeleccionada = '';
let filtroTexto = '';

// Obtiene el contenedor de la tabla
const divFichas = document.getElementById('fichas');

// Función para abrir el modal de agregar producto
function abrirModalAgregarProducto() {
    Swal.fire({
        html: `
        <h1 class="tituloModal">Nuevo Producto</h1>
        <hr>
        <form id="formulario_producto">
            <input type="text" id="nombre" placeholder="Nombre" class="form-control" required>
            <input type="number" id="precio" placeholder="Precio" class="form-control" required>
            <input type="text" id="descripcion" placeholder="Descripción" class="form-control">
            <input type="file" id="imagen" accept="image/*" onchange="cargarImagen(event)" required>
            <img id="preview" src="" alt="Vista previa de la imagen seleccionada">
            <input type="number" id="cantidad" placeholder="Cantidad" class="form-control" required>
            <button type="button" onclick="agregarNuevoProducto()" class="btn btn-success mt-1">Guardar</button>
        </form>`,
        showCloseButton: true,
        showConfirmButton: false
    });
}

// Agrega un nuevo producto
async function agregarNuevoProducto() {
    const nombreProducto = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const descripcion = document.getElementById('descripcion').value;
    const imagen = document.getElementById('imagen').value;
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
                        <td><img src="${p.imagen}" width="50"></td>
                        <td>${p.cantidad}</td>
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
                <input type="file" id="imagen_edit" accept="image/*" onchange="cargarImagen(event)" class="form-control" value="${productoDevuelto.imagen}" autofocus required="true">
                <img id="preview" src="" alt="Vista previa de la imagen seleccionada">

            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5>Cantidad</h5></label>
                <input type="number" id="cantidad_edit" placeholder="Cantidad" class="form-control" value="${productoDevuelto.cantidad}" autofocus required="true">
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

async function fichaClienteEditada(idProductoEditado){

    const nombreProducto_edit = document.getElementById('nombreProducto_edit')
    const precio_edit = document.getElementById('precio_edit')
    const descripcion_edit = document.getElementById('descripcion_edit')
    const imagen_edit = document.getElementById('imagen_edit')
    const cantidad_edit = document.getElementById('cantidad_edit')

    if(validarCamposFormulario(nombreProducto_edit, precio_edit, descripcion_edit, imagen_edit, cantidad_edit)){
        const productoEditado = {
            nombre: nombreProducto_edit.value,
            precio: precio_edit.value,
            descripcion: descripcion_edit.value,
            imagen: imagen_edit.value,
            cantidad_disponible: cantidad_edit.value,
        }
        await main.actualizarProducto(idProductoEditado, productoEditado)    
        Swal.close()
        await actualizarProductos()
    }
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
          await getProductosAux()
        }
      })
    return
}




function cargarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        // Previsualizar la imagen seleccionada
        const preview = document.getElementById('preview');
        preview.src = URL.createObjectURL(file);

        // Definir el directorio de destino y la ruta del archivo
        const destino = path.join('./img/productos', file.name);

        // Copiar el archivo al directorio especificado
        fs.copyFile(file.path, destino, (err) => {
            if (err) {
                console.error('Error al guardar la imagen:', err);
            } else {
                console.log('Imagen guardada en:', destino);
            }
        });
    }
}


// Inicialización de eventos y datos
document.getElementById("filtroTexto").addEventListener("input", filtrarPorTexto);
async function init() {
    await actualizarProductos();
}
init();

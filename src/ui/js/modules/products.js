const { ipcRenderer } = require('electron');

let arrayProductos = [];
let filtroTexto = '';
let filtroFecha = false;
let fechaFiltroSeleccionada = '';

async function cargarProductos() {
    const inputProducto = document.getElementById('inputProducto');
    const dropdownProductos = document.getElementById('dropdownProductos');
    const tipoVentaSelect = document.getElementById('tipoVenta');
    const productosSeleccionadosContainer = document.getElementById('productosSeleccionados');

    if (!inputProducto || !dropdownProductos || !tipoVentaSelect || !productosSeleccionadosContainer) {
        console.error('Faltan elementos necesarios en el DOM. Verifica el HTML.');
        return;
    }

    let productos = [];
    let combos = [];
    try {
        productos = await window.electronAPI.getProductos();
        combos = await window.electronAPI.getCombos();

        if (!Array.isArray(productos) || !Array.isArray(combos)) {
            throw new Error('Los datos obtenidos no son válidos.');
        }
    } catch (error) {
        console.error('Error al cargar los productos y combos:', error.message);
        return;
    }

    productos.forEach(producto => {
        if (!producto.nombre || !producto.id || !producto.precio || !producto.precio_delivery) {
            console.warn('Faltan datos en el producto:', producto);
        }
    });

    combos.forEach(combo => {
        if (!combo.nombre || !combo.id || !combo.precio || !combo.precio_delivery) {
            console.warn('Faltan datos en el combo:', combo);
        }
    });

    const items = [
        ...productos.map(p => ({
            tipo: 'producto',
            id: p.id,
            nombre: p.nombre,
            stock: p.cantidad_disponible,
            precioLocal: p.precio,
            precioDelivery: p.precio_delivery,
        })),
        ...combos.map(c => ({
            tipo: 'combo',
            id: c.id,
            nombre: `Combo: ${c.nombre}`,
            stock: 'N/A',
            precioLocal: c.precio,
            precioDelivery: c.precio_delivery,
        })),
    ];

    items.sort((a, b) => a.nombre.localeCompare(b.nombre));

    inputProducto.addEventListener('input', () => {
        const searchTerm = inputProducto.value.toLowerCase();
        const filteredItems = items.filter(item => item.nombre.toLowerCase().includes(searchTerm));

        dropdownProductos.innerHTML = filteredItems.map(item => `
            <li>
                <a href="#" 
                   class="dropdown-item" 
                   data-id="${item.id}" 
                   data-tipo="${item.tipo}" 
                   data-stock="${item.stock}" 
                   data-precio-local="${item.precioLocal}" 
                   data-precio-delivery="${item.precioDelivery}">
                   ${item.nombre}
                </a>
            </li>
        `).join('');

        dropdownProductos.style.display = filteredItems.length ? 'block' : 'none';
    });

    dropdownProductos.addEventListener('click', (event) => {
        const selectedItem = event.target.closest('.dropdown-item');
        if (!selectedItem) return;

        const id = selectedItem.getAttribute('data-id');
        const tipo = selectedItem.getAttribute('data-tipo');
        const stock = selectedItem.getAttribute('data-stock');
        const precioLocal = selectedItem.getAttribute('data-precio-local');
        const precioDelivery = selectedItem.getAttribute('data-precio-delivery');
        const nombre = selectedItem.textContent.trim();

        inputProducto.value = nombre;
        inputProducto.dataset.productId = id;
        inputProducto.dataset.tipo = tipo;
        inputProducto.dataset.stock = stock;

        const tipoVenta = tipoVentaSelect.value;
        const precioSeleccionado = tipoVenta === 'delivery' ? precioDelivery : precioLocal;
        inputProducto.dataset.precio = precioSeleccionado;

        dropdownProductos.style.display = 'none';
        actualizarPrecioSeleccionado(id, precioSeleccionado);
    });

    document.addEventListener('click', (event) => {
        if (!dropdownProductos.contains(event.target) && event.target !== inputProducto) {
            dropdownProductos.style.display = 'none';
        }
    });

    tipoVentaSelect.addEventListener('change', () => {
        const tipoVenta = tipoVentaSelect.value;
        const precioTipo = tipoVenta === 'delivery' ? 'data-precio-delivery' : 'data-precio-local';

        const itemsEnDropdown = dropdownProductos.querySelectorAll('.dropdown-item');
        itemsEnDropdown.forEach(item => {
            const nuevoPrecio = item.getAttribute(precioTipo);
            if (nuevoPrecio) {
                const precioElemento = item.querySelector('.precioProducto');
                if (precioElemento) {
                    precioElemento.textContent = `$${nuevoPrecio}`;
                }
            }
        });

        actualizarPreciosSeleccionados();
    });

    console.log('Productos y combos cargados correctamente.');
}

async function agregarProductoVenta() {
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    const agregarBtn = document.querySelector('button[onclick="agregarProductoVenta()"]');
    
    const idProducto = inputProducto.dataset.productId;
    const tipo = inputProducto.dataset.tipo;
    const nombreProducto = inputProducto.value;
    const precioProducto = parseFloat(inputProducto.dataset.precio);
    const cantidad = parseInt(inputCantidad.value, 10);

    if (!idProducto || !nombreProducto) {
        Swal.fire('Error', 'Selecciona un producto o combo válido del dropdown.', 'error');
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        Swal.fire('Error', 'Ingresa una cantidad válida.', 'error');
        return;
    }

    const tipoVenta = document.getElementById('tipoVenta').value;
    agregarBtn.disabled = true;

    try {
        const stockDisponible = await obtenerStockActualizado(idProducto, tipo);

        if (cantidad > stockDisponible) {
            Swal.fire(
                'Stock insuficiente',
                `No hay suficiente stock para "${nombreProducto}". Quedan ${Math.floor(stockDisponible)} unidades.`,
                'warning'
            );
            agregarBtn.disabled = false;
            return;
        }

        const productoExistente = productosSeleccionados.find(p => p.id === idProducto && p.tipo === tipo);

        if (productoExistente) {
            const nuevaCantidadTotal = productoExistente.cantidad + cantidad;

            if (nuevaCantidadTotal > stockDisponible) {
                Swal.fire(
                    'Stock insuficiente',
                    `No hay suficiente stock para "${nombreProducto}". Quedan ${Math.floor(stockDisponible - productoExistente.cantidad)} unidades adicionales disponibles.`,
                    'warning'
                );
                agregarBtn.disabled = false;
                return;
            }

            productoExistente.cantidad = nuevaCantidadTotal;
        } else {
            productosSeleccionados.push({
                id: idProducto,
                tipo,
                nombre: nombreProducto,
                cantidad,
                precio: precioProducto
            });
        }

        inputProducto.value = '';
        inputProducto.dataset.productId = '';
        inputProducto.dataset.tipo = '';
        inputProducto.dataset.stock = '';
        inputProducto.dataset.precioLocal = '';
        inputProducto.dataset.precioDelivery = '';
        inputCantidad.value = '';

        actualizarResumenVenta();
        actualizarTotalConEnvio()
    } catch (error) {
        console.error('Error al agregar producto/combo a la venta:', error);
        Swal.fire('Error', 'Hubo un problema al agregar el producto/combo a la venta.', 'error');
    } finally {
        agregarBtn.disabled = false;
    }
}

async function agregarNuevoProducto() {
    const nombreProducto = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const precioDelivery = document.getElementById('precioDelivery').value;
    const descripcion = document.getElementById('descripcion').value;
    const cantidad = document.getElementById('cantidad').value;

    if (nombreProducto && precio && cantidad) {
        const nuevoProducto = { 
            nombre: nombreProducto, 
            precio: precio, 
            precio_delivery: precioDelivery, 
            descripcion: descripcion, 
            cantidad_disponible: cantidad 
        };
        
        await window.electronAPI.nuevoProducto(nuevoProducto);
        Swal.close();
        await actualizarProductos();
    } else {
        Swal.fire('Error', 'Por favor, completa todos los campos requeridos', 'error');
    }
}

async function actualizarProductos() {
    const productos = await window.electronAPI.getProductos();

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

async function editarProducto(idProducto) {
    const productoDevuelto = await window.electronAPI.getProductoPorId(idProducto);
    
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
                <label class="mt-2" for=""><h5>Precio Delivery</h5></label>
                <input type="number" id="precio_delivery_edit" placeholder="Precio" class="form-control" value="${productoDevuelto.precio_delivery}" autofocus required="true">
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
    `,
        showCloseButton: true,
        showCancelButton: false,
        showConfirmButton: false,
        focusConfirm: false
    });
}

async function borrarProducto(id) {
    Swal.fire({
        title: '¿Desea eliminar este producto?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'rgb(91 191 175',
        cancelButtonColor: 'rgb(255 85 85)',
        confirmButtonText: 'Si, borrar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await window.electronAPI.borrarProducto(id);
            Swal.fire('Listo!', 'El producto fue borrado.', 'success');
            await actualizarProductos();
        }
    });
}

function renderListaProductos(productos) {
    divFichas.innerHTML = `
        <table class="table table-striped table-bordered">
            <thead class="thead-dark">
                <tr>
                    <th>Id</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Precio Delivery</th>
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
                        <td>${p.precio_delivery}</td>
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

async function fichaClienteEditada(idProductoEditado) {
    const nombreProducto_edit = document.getElementById('nombreProducto_edit').value;
    const precio_edit = document.getElementById('precio_edit').value;
    const precio_delivery_edit = document.getElementById('precio_delivery_edit').value;
    const descripcion_edit = document.getElementById('descripcion_edit').value;
    const cantidad_edit = document.getElementById('cantidad_edit').value;

    const productoEditado = {
        nombre: nombreProducto_edit,
        precio: precio_edit,
        precio_delivery: precio_delivery_edit,
        descripcion: descripcion_edit,
        cantidad_disponible: cantidad_edit
    };

    await window.electronAPI.actualizarProducto(idProductoEditado, productoEditado);
    Swal.close();
    await actualizarProductos();
}

function validarCamposFormulario(nombreProducto, precio, descripcion, cantidad) {
    return nombreProducto.value != '' && precio.value != '' && cantidad.value != '';
}

function filtrarPorTexto(event) {
    filtroTexto = event.target.value;
    actualizarProductos();
}

function filtrarPorFecha(fecha) {
    filtroFecha = true;
    fechaFiltroSeleccionada = fecha;
    actualizarProductos();
}

function limpiarFiltro() {
    filtroTexto = '';
    filtroFecha = false;
    fechaFiltroSeleccionada = '';
    actualizarProductos();
}

// Función auxiliar para obtener stock actualizado
async function obtenerStockActualizado(id, tipo) {
    if (tipo === 'producto') {
        const producto = await window.electronAPI.getProductoPorId(id);
        return producto.cantidad_disponible;
    } else if (tipo === 'combo') {
        // Para combos, asumimos que siempre hay stock disponible
        return Infinity;
    }
    return 0;
}

module.exports = { 
    arrayProductos,
    cargarProductos,
    agregarProductoVenta,
    agregarNuevoProducto,
    actualizarProductos,
    editarProducto,
    borrarProducto,
    renderListaProductos,
    fichaClienteEditada,
    validarCamposFormulario,
    filtrarPorTexto,
    filtrarPorFecha,
    limpiarFiltro,
    filtroTexto,
    filtroFecha,
    fechaFiltroSeleccionada
};
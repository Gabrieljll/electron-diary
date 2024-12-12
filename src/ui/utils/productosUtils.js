// =======================================================
// FUNCIONES PARA PRODUCTOS
// =======================================================
async function cargarProductos() {
    const inputProducto = document.getElementById('inputProducto');
    const dropdownProductos = document.getElementById('dropdownProductos');
    const tipoVentaSelect = document.getElementById('tipoVenta');
    const productosSeleccionadosContainer = document.getElementById('productosSeleccionados');

    // Validar que los elementos DOM necesarios existan
    if (!inputProducto || !dropdownProductos || !tipoVentaSelect || !productosSeleccionadosContainer) {
        console.error('Faltan elementos necesarios en el DOM. Verifica el HTML.');
        return;
    }

    // Obtener productos y validar datos
    let productos = [];
    try {
        productos = await main.getProductos();
        if (!Array.isArray(productos)) {
            throw new Error('Los productos obtenidos no son válidos.');
        }
    } catch (error) {
        console.error('Error al cargar los productos:', error.message);
        return;
    }

    productos.forEach(producto => {
        if (!producto.nombre || !producto.id || !producto.precio || !producto.precio_delivery) {
            console.warn('Faltan datos en el producto:', producto);
        }
    });

    // Ordenar productos por nombre
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Mostrar y filtrar productos en el dropdown
    inputProducto.addEventListener('input', () => {
        const searchTerm = inputProducto.value.toLowerCase();
        const filteredProductos = productos.filter(p => p.nombre.toLowerCase().includes(searchTerm));

        dropdownProductos.innerHTML = filteredProductos.map(p => `
            <li>
                <a href="#" 
                   class="dropdown-item" 
                   data-id="${p.id}" 
                   data-stock="${p.cantidad_disponible}" 
                   data-precio-local="${p.precio}" 
                   data-precio-delivery="${p.precio_delivery}">
                   ${p.nombre}
                </a>
            </li>
        `).join('');

        dropdownProductos.style.display = filteredProductos.length ? 'block' : 'none';
    });

    // Manejar la selección de productos desde el dropdown
    dropdownProductos.addEventListener('click', (event) => {
        const selectedProduct = event.target.closest('.dropdown-item');
        if (!selectedProduct) return;

        const idProducto = selectedProduct.getAttribute('data-id');
        const stockProducto = selectedProduct.getAttribute('data-stock');
        const precioLocal = selectedProduct.getAttribute('data-precio-local');
        const precioDelivery = selectedProduct.getAttribute('data-precio-delivery');
        const nombreProducto = selectedProduct.textContent.trim();

        // Configuramos el input de producto con los datos seleccionados
        inputProducto.value = nombreProducto;
        inputProducto.dataset.productId = idProducto;
        inputProducto.dataset.stock = stockProducto;

        // Ajustamos el precio según el tipo de venta
        const tipoVenta = tipoVentaSelect.value;
        const precioSeleccionado = tipoVenta === 'delivery' ? precioDelivery : precioLocal;
        inputProducto.dataset.precio = precioSeleccionado;

        // Ocultamos el dropdown después de la selección
        dropdownProductos.style.display = 'none';

        // Actualizar el precio en el resumen de productos seleccionados
        actualizarPrecioSeleccionado(idProducto, precioSeleccionado);
    });

    // Cerrar el dropdown al hacer clic fuera de él
    document.addEventListener('click', (event) => {
        if (!dropdownProductos.contains(event.target) && event.target !== inputProducto) {
            dropdownProductos.style.display = 'none';
        }
    });

    // Cambiar precios según el tipo de venta seleccionado
    tipoVentaSelect.addEventListener('change', () => {
        const tipoVenta = tipoVentaSelect.value;
        const precioTipo = tipoVenta === 'delivery' ? 'data-precio-delivery' : 'data-precio-local';

        // Actualizar precios de los productos en el dropdown
        const productosEnDropdown = dropdownProductos.querySelectorAll('.dropdown-item');
        productosEnDropdown.forEach(producto => {
            const nuevoPrecio = producto.getAttribute(precioTipo);
            if (nuevoPrecio) {
                const precioElemento = producto.querySelector('.precioProducto');
                if (precioElemento) {
                    precioElemento.textContent = `$${nuevoPrecio}`;
                }
            }
        });

        // También actualizar los productos seleccionados en la lista de productos
        actualizarPreciosSeleccionados();
    });

    console.log('Productos cargados y configurados correctamente.');
}

async function agregarProductoVenta() {
    // Referencias a elementos correctos en tu estructura actual
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    const agregarBtn = document.querySelector('button[onclick="agregarProductoVenta()"]');
    console.log("agregando producto");
    console.log(inputProducto.dataset);

    // Obtener datos del producto seleccionado desde los atributos del input
    const idProducto = inputProducto.dataset.productId; // ID del producto seleccionado
    const nombreProducto = inputProducto.value; // Nombre del producto
    const precioProducto = parseFloat(inputProducto.dataset.precio); // Precio del producto para "local"
    const precioProductoDelivery = parseFloat(inputProducto.dataset.precioDelivery); // Precio del producto para "delivery"
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

    // Obtener el tipo de venta seleccionado
    const tipoVenta = document.getElementById('tipoVenta').value;

    // Establecer el precio según el tipo de venta
    //const precioProducto = tipoVenta === 'delivery' ? precioProductoDelivery : precioProductoLocal;

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
        // Si no está en la lista, agregar el producto con el precio ajustado
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
    inputProducto.dataset.precioLocal = '';
    inputProducto.dataset.precioDelivery = '';
    inputCantidad.value = '';

    // Habilitar el botón nuevamente
    agregarBtn.disabled = false;

    // Actualizar el resumen de productos
    actualizarResumenVenta();
}

// Agrega un nuevo producto
async function agregarNuevoProducto() {
    const nombreProducto = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const precioDelivery = document.getElementById('precioDelivery').value;
    const descripcion = document.getElementById('descripcion').value;
    const cantidad = document.getElementById('cantidad').value;

    if (nombreProducto && precio && cantidad) {
        const nuevoProducto = { nombre: nombreProducto, precio: precio, precio_delivery: precioDelivery, descripcion: descripcion, cantidad_disponible: cantidad };
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
    `
        ,          
        showCloseButton: true,
        showCancelButton: false,
        showConfirmButton: false,
        focusConfirm: false
    })
    
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

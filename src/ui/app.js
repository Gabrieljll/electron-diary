// =======================================================
// IMPORTACIONES Y CONFIGURACIONES INICIALES
// =======================================================
const Swal = require('sweetalert2');
const remote = require("@electron/remote");
const main = remote.require('./main');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

// Variables y constantes iniciales
let arrayProductos = [];
let filtroFecha = false;
let fechaFiltroSeleccionada = '';
let filtroTexto = '';
let filtroTextoCombo = '';
let productosSeleccionados = [];
let recargosActuales = { credito: 0, debito: 0 };
let descuentosDisponibles = [];




// Obtiene el contenedor de la tabla
const divFichas = document.getElementById('fichas');

// Obtiene el contenedor de la tabla
const divListaCombos = document.getElementById('divListaCombos');

// Configuración de la contraseña
const CONTRASENA = "pombero91124";


// =======================================================
// FUNCIONES DE AUTENTICACIÓN
// =======================================================
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

    // Obtener productos y combos
    let productos = [];
    let combos = [];
    try {
        productos = await main.getProductos();
        combos = await main.getCombos();

        if (!Array.isArray(productos) || !Array.isArray(combos)) {
            throw new Error('Los datos obtenidos no son válidos.');
        }
    } catch (error) {
        console.error('Error al cargar los productos y combos:', error.message);
        return;
    }

    // Validar datos de productos y combos
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

    // Combinar productos y combos, asignándoles una etiqueta para diferenciarlos
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

    // Ordenar productos y combos por nombre
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Mostrar y filtrar productos y combos en el dropdown
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

    // Manejar la selección de productos o combos desde el dropdown
    dropdownProductos.addEventListener('click', (event) => {
        const selectedItem = event.target.closest('.dropdown-item');
        if (!selectedItem) return;

        const id = selectedItem.getAttribute('data-id');
        const tipo = selectedItem.getAttribute('data-tipo');
        const stock = selectedItem.getAttribute('data-stock');
        const precioLocal = selectedItem.getAttribute('data-precio-local');
        const precioDelivery = selectedItem.getAttribute('data-precio-delivery');
        const nombre = selectedItem.textContent.trim();

        // Configuramos el input de producto con los datos seleccionados
        inputProducto.value = nombre;
        inputProducto.dataset.productId = id;
        inputProducto.dataset.tipo = tipo;
        inputProducto.dataset.stock = stock;

        // Ajustamos el precio según el tipo de venta
        const tipoVenta = tipoVentaSelect.value;
        const precioSeleccionado = tipoVenta === 'delivery' ? precioDelivery : precioLocal;
        inputProducto.dataset.precio = precioSeleccionado;

        // Ocultamos el dropdown después de la selección
        dropdownProductos.style.display = 'none';

        // Actualizar el precio en el resumen de productos seleccionados
        actualizarPrecioSeleccionado(id, precioSeleccionado);
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

        // También actualizar los productos seleccionados en la lista de productos
        actualizarPreciosSeleccionados();
    });

    console.log('Productos y combos cargados correctamente.');
}


async function agregarProductoVenta() {
    // Referencias a elementos correctos en tu estructura actual
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    const agregarBtn = document.querySelector('button[onclick="agregarProductoVenta()"]');
    console.log("agregando producto/combo");
    console.log(inputProducto.dataset);

    // Obtener datos del producto o combo seleccionado desde los atributos del input
    const idProducto = inputProducto.dataset.productId; // ID del producto o combo seleccionado
    const tipo = inputProducto.dataset.tipo; // Tipo: producto o combo
    const nombreProducto = inputProducto.value; // Nombre del producto o combo
    const precioProducto = parseFloat(inputProducto.dataset.precio); // Precio seleccionado
    const cantidad = parseInt(inputCantidad.value, 10); // Cantidad ingresada

    // Verificar que el producto o combo haya sido seleccionado y los datos sean válidos
    if (!idProducto || !nombreProducto) {
        Swal.fire('Error', 'Selecciona un producto o combo válido del dropdown.', 'error');
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        Swal.fire('Error', 'Ingresa una cantidad válida.', 'error');
        return;
    }

    // Obtener el tipo de venta seleccionado
    const tipoVenta = document.getElementById('tipoVenta').value;

    // Deshabilitar el botón mientras se valida el stock
    agregarBtn.disabled = true;

    try {
        // Obtener el stock más reciente
        const stockDisponible = await obtenerStockActualizado(idProducto, tipo);

        // Validar stock
        if (cantidad > stockDisponible) {
            Swal.fire(
                'Stock insuficiente',
                `No hay suficiente stock para "${nombreProducto}". Quedan ${Math.floor(stockDisponible)} unidades.`,
                'warning'
            );
            agregarBtn.disabled = false;
            return;
        }

        // Busca si el producto/combo ya está en la lista de productos seleccionados
        const productoExistente = productosSeleccionados.find(p => p.id === idProducto && p.tipo === tipo);

        if (productoExistente) {
            // Si ya está en la lista, suma la cantidad nueva
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
            // Si no está en la lista, agregarlo con el precio ajustado
            productosSeleccionados.push({
                id: idProducto,
                tipo,
                nombre: nombreProducto,
                cantidad,
                precio: precioProducto
            });
        }

        // Limpieza de campos
        inputProducto.value = '';
        inputProducto.dataset.productId = '';
        inputProducto.dataset.tipo = '';
        inputProducto.dataset.stock = '';
        inputProducto.dataset.precioLocal = '';
        inputProducto.dataset.precioDelivery = '';
        inputCantidad.value = '';

        // Actualizar el resumen de productos
        actualizarResumenVenta();
        actualizarTotalConEnvio()
    } catch (error) {
        console.error('Error al agregar producto/combo a la venta:', error);
        Swal.fire('Error', 'Hubo un problema al agregar el producto/combo a la venta.', 'error');
    } finally {
        // Habilitar el botón nuevamente
        agregarBtn.disabled = false;
    }
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
        title: '¿Desea eliminar este producto?',
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
            'El producto fue borrado.',
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


// =======================================================
// FUNCIONES PARA COMBOS
// =======================================================
function abrirModalAgregarCombo() {
    main.getProductos().then((productos) => {
        let productosFiltrados = [...productos];
        const seleccionados = new Map(); // Mapa para guardar selección y cantidad

        const renderProductos = () => {
            return productosFiltrados.map(p => {
                const seleccionado = seleccionados.has(p.id);
                const cantidad = seleccionado ? seleccionados.get(p.id).cantidad : '';
                const cantidadInputStyle = seleccionado ? 'display: block;' : 'display: none;';

                return `
                    <div class="list-group-item">
                        <input type="checkbox" class="form-check-input me-2 producto-checkbox" 
                            data-id="${p.id}" 
                            data-nombre="${p.nombre}" 
                            data-stock="${p.cantidad_disponible}" 
                            ${seleccionado ? 'checked' : ''}>
                        <label class="form-check-label">
                            ${p.nombre} (Stock: ${p.cantidad_disponible})
                        </label>
                        <input type="number" class="form-control form-control-sm mt-2 cantidad-producto" 
                            placeholder="Cantidad" 
                            min="1" 
                            max="${p.cantidad_disponible}" 
                            style="${cantidadInputStyle}" 
                            value="${cantidad}">
                    </div>
                `;
            }).join('');
        };

        Swal.fire({
            html: `
                <h1 class="tituloModal">Nuevo Combo</h1>
                <hr>
                <div class="modalAgregar col-md-12 p-4 my-auto">
                    <form id="formulario_combo">
                        <div class="form-group">
                            <label class="mt-2" for="comboNombre"><h5>Nombre</h5></label>
                            <input type="text" id="comboNombre" placeholder="Nombre del combo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboDescripcion"><h5>Descripción</h5></label>
                            <textarea id="comboDescripcion" placeholder="Descripción del combo" class="form-control" rows="3" required></textarea>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboPrecio"><h5>Precio</h5></label>
                            <input type="number" id="comboPrecio" placeholder="Precio del combo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboPrecioDelivery"><h5>Precio Delivery</h5></label>
                            <input type="number" id="comboPrecioDelivery" placeholder="Precio delivery" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2"><h5>Filtrar Productos</h5></label>
                            <input type="text" id="filtroProductos" placeholder="Buscar productos..." class="form-control">
                        </div>
                        <div class="form-group">
                            <div id="productosSeleccionables" class="list-group">
                                ${renderProductos()}
                            </div>
                        </div>
                    </form>
                </div>
                <button type="button" id="guardarComboBtn" class="btn btn-success mt-3">Guardar Combo</button>
            `,
            showCloseButton: true,
            showConfirmButton: false,
        });

        // Filtro dinámico para productos
        const filtroInput = document.getElementById('filtroProductos');
        const productosSeleccionables = document.getElementById('productosSeleccionables');
        filtroInput.addEventListener('input', () => {
            const filtro = filtroInput.value.toLowerCase();
            productosFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(filtro));
            productosSeleccionables.innerHTML = renderProductos();

            agregarEventListenersProductos(); // Volver a agregar listeners
        });

        const agregarEventListenersProductos = () => {
            const checkboxes = document.querySelectorAll('.producto-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (event) => {
                    const id = parseInt(event.target.dataset.id);
                    const cantidadInput = event.target.closest('.list-group-item').querySelector('.cantidad-producto');
                    
                    if (event.target.checked) {
                        cantidadInput.style.display = 'block';
                        cantidadInput.value = seleccionados.get(id)?.cantidad || 1;
                        seleccionados.set(id, { nombre: event.target.dataset.nombre, cantidad: parseInt(cantidadInput.value) });
                    } else {
                        cantidadInput.style.display = 'none';
                        seleccionados.delete(id);
                    }
                });
            });

            const cantidadInputs = document.querySelectorAll('.cantidad-producto');
            cantidadInputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const id = parseInt(event.target.closest('.list-group-item').querySelector('.producto-checkbox').dataset.id);
                    const cantidad = parseInt(event.target.value);

                    if (!isNaN(cantidad) && cantidad > 0) {
                        if (seleccionados.has(id)) {
                            seleccionados.set(id, { ...seleccionados.get(id), cantidad });
                        }
                    }
                });
            });
        };

        agregarEventListenersProductos(); // Agregar listeners iniciales

        // Guardar el combo
        document.getElementById('guardarComboBtn').addEventListener('click', async () => {
            const nombre = document.getElementById('comboNombre').value.trim();
            const descripcion = document.getElementById('comboDescripcion').value.trim();
            const precio = parseFloat(document.getElementById('comboPrecio').value);
            const precioDelivery = parseFloat(document.getElementById('comboPrecioDelivery').value);

            if (!nombre || !descripcion || isNaN(precio) || isNaN(precioDelivery)) {
                Swal.fire('Error', 'Por favor, complete todos los campos del formulario.', 'error');
                return;
            }

            const detalles = Array.from(seleccionados.values()).map(s => ({
                id_producto: productos.find(p => p.nombre === s.nombre).id,
                cantidad: s.cantidad
            }));

            if (detalles.length === 0) {
                Swal.fire('Error', 'Debe seleccionar al menos un producto para el combo.', 'error');
                return;
            }

            // Llamar al backend para guardar el combo
            try {
                await main.nuevoCombo(
                    { nombre, descripcion, precio, precio_delivery: precioDelivery },
                    detalles
                );

                Swal.fire('Éxito', '¡El combo ha sido agregado correctamente!', 'success');
                await actualizarCombos();
            } catch (error) {
                console.error('Error al guardar el combo:', error);
                Swal.fire('Error', 'Hubo un problema al guardar el combo.', 'error');
            }
        });
    }).catch((error) => {
        console.error('Error al cargar productos:', error);
        Swal.fire('Error', 'Hubo un problema al cargar los productos.', 'error');
    });
}


async function agregarNuevoCombo() {
    const nombreCombo = document.getElementById('nombreCombo').value;
    const precio = parseFloat(document.getElementById('precioCombo').value);
    const descripcion = document.getElementById('descripcionCombo').value;
    const productosIncluidos = [...document.querySelectorAll('.producto-en-combo')].map(producto => ({
        id_producto: producto.getAttribute('data-id'),
        cantidad: parseInt(producto.getAttribute('data-cantidad'), 10)
    }));

    if (!nombreCombo || isNaN(precio) || productosIncluidos.length === 0) {
        Swal.fire('Error', 'Por favor, completa todos los campos requeridos y selecciona al menos un producto.', 'error');
        return;
    }

    try {
        await main.nuevoCombo({ nombre: nombreCombo, precio, descripcion, productos: productosIncluidos });
        Swal.fire('Éxito', 'El combo se ha creado correctamente.', 'success');
        await actualizarCombos();
    } catch (error) {
        console.error('Error al crear el combo:', error);
        Swal.fire('Error', 'Hubo un problema al crear el combo.', 'error');
    }
}


async function actualizarCombos() {
    const combos = await main.getCombos();

    // Filtra por texto y fecha
    const combosFiltrados = combos.filter(p => {
        const coincideTexto = filtroTextoCombo
            ? p.nombre.toLowerCase().includes(filtroTextoCombo.toLowerCase())
            : true;
        const coincideFecha = filtroFecha
            ? p.fecha === fechaFiltroSeleccionada
            : true;
        return coincideTexto && coincideFecha;
    });
    renderListaCombos(combosFiltrados);
}

function renderListaCombos(combos) {
    divListaCombos.innerHTML = `
        <table class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Precio Delivery</th>
                    <th>Descripción</th>
                    <th>Productos</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${combos.map(combo => `
                    <tr>
                        <td>${combo.nombre}</td>
                        <td>${combo.precio}</td>
                        <td>${combo.precio_delivery}</td>
                        <td>${combo.descripcion}</td>
                        <td>${combo.detalles.map(p => `${p.producto_nombre} (${p.cantidad})`).join(', ')}</td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="editarCombo(${combo.id})">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="eliminarCombo(${combo.id})">Eliminar</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
}

async function editarCombo(idCombo) {
    try {
        const combo = await main.getComboById(idCombo);
        if (!combo) {
            Swal.fire('Error', 'No se encontró el combo especificado.', 'error');
            return;
        }

        const productos = await main.getProductos();
        let productosFiltrados = [...productos];
        const seleccionados = new Map();

        // Inicializar seleccionados con los productos actuales del combo
        combo.detalles.forEach(detalle => {
            seleccionados.set(detalle.id_producto, {
                nombre: detalle.producto_nombre,
                cantidad: detalle.cantidad
            });
        });

        const renderProductos = () => {
            return productosFiltrados.map(p => {
                const seleccionado = seleccionados.has(p.id);
                const cantidad = seleccionado ? seleccionados.get(p.id).cantidad : '';
                const cantidadInputStyle = seleccionado ? 'display: block;' : 'display: none;';

                return `
                    <div class="list-group-item">
                        <input type="checkbox" class="form-check-input me-2 producto-checkbox" 
                            data-id="${p.id}" 
                            data-nombre="${p.nombre}" 
                            data-stock="${p.cantidad_disponible}" 
                            ${seleccionado ? 'checked' : ''}>
                        <label class="form-check-label">
                            ${p.nombre} (Stock: ${p.cantidad_disponible})
                        </label>
                        <input type="number" class="form-control form-control-sm mt-2 cantidad-producto" 
                            placeholder="Cantidad" 
                            min="1" 
                            max="${p.cantidad_disponible}" 
                            style="${cantidadInputStyle}" 
                            value="${cantidad}">
                    </div>
                `;
            }).join('');
        };

        Swal.fire({
            html: `
                <h1 class="tituloModal">Editar Combo</h1>
                <hr>
                <div class="modalAgregar col-md-12 p-4 my-auto">
                    <form id="formulario_combo">
                        <div class="form-group">
                            <label class="mt-2" for="comboNombre"><h5>Nombre</h5></label>
                            <input type="text" id="comboNombre" placeholder="Nombre del combo" class="form-control" value="${combo.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboDescripcion"><h5>Descripción</h5></label>
                            <textarea id="comboDescripcion" placeholder="Descripción del combo" class="form-control" rows="3" required>${combo.descripcion}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboPrecio"><h5>Precio</h5></label>
                            <input type="number" id="comboPrecio" placeholder="Precio del combo" class="form-control" value="${combo.precio}" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2" for="comboPrecioDelivery"><h5>Precio Delivery</h5></label>
                            <input type="number" id="comboPrecioDelivery" placeholder="Precio delivery" class="form-control" value="${combo.precio_delivery}" required>
                        </div>
                        <div class="form-group">
                            <label class="mt-2"><h5>Filtrar Productos</h5></label>
                            <input type="text" id="filtroProductos" placeholder="Buscar productos..." class="form-control">
                        </div>
                        <div class="form-group">
                            <div id="productosSeleccionables" class="list-group">
                                ${renderProductos()}
                            </div>
                        </div>
                    </form>
                </div>
                <button type="button" id="guardarComboBtn" class="btn btn-success mt-3">Guardar Cambios</button>
            `,
            showCloseButton: true,
            showConfirmButton: false,
        });

        const filtroInput = document.getElementById('filtroProductos');
        const productosSeleccionables = document.getElementById('productosSeleccionables');

        filtroInput.addEventListener('input', () => {
            const filtro = filtroInput.value.toLowerCase();
            productosFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(filtro));
            productosSeleccionables.innerHTML = renderProductos();

            agregarEventListenersProductos();
        });

        const agregarEventListenersProductos = () => {
            const checkboxes = document.querySelectorAll('.producto-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (event) => {
                    const id = parseInt(event.target.dataset.id);
                    const cantidadInput = event.target.closest('.list-group-item').querySelector('.cantidad-producto');

                    if (event.target.checked) {
                        cantidadInput.style.display = 'block';
                        cantidadInput.value = seleccionados.get(id)?.cantidad || 1;
                        seleccionados.set(id, { nombre: event.target.dataset.nombre, cantidad: parseInt(cantidadInput.value) });
                    } else {
                        cantidadInput.style.display = 'none';
                        seleccionados.delete(id);
                    }
                });
            });

            const cantidadInputs = document.querySelectorAll('.cantidad-producto');
            cantidadInputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const id = parseInt(event.target.closest('.list-group-item').querySelector('.producto-checkbox').dataset.id);
                    const cantidad = parseInt(event.target.value);

                    if (!isNaN(cantidad) && cantidad > 0) {
                        if (seleccionados.has(id)) {
                            seleccionados.set(id, { ...seleccionados.get(id), cantidad });
                        }
                    }
                });
            });
        };

        agregarEventListenersProductos();

        document.getElementById('guardarComboBtn').addEventListener('click', async () => {
            const nombre = document.getElementById('comboNombre').value.trim();
            const descripcion = document.getElementById('comboDescripcion').value.trim();
            const precio = parseFloat(document.getElementById('comboPrecio').value);
            const precioDelivery = parseFloat(document.getElementById('comboPrecioDelivery').value);

            if (!nombre || !descripcion || isNaN(precio) || isNaN(precioDelivery)) {
                Swal.fire('Error', 'Por favor, complete todos los campos del formulario.', 'error');
                return;
            }

            const detalles = Array.from(seleccionados.values()).map(s => ({
                id_producto: productos.find(p => p.nombre === s.nombre).id,
                cantidad: s.cantidad
            }));

            if (detalles.length === 0) {
                Swal.fire('Error', 'Debe seleccionar al menos un producto para el combo.', 'error');
                return;
            }

            try {
                await main.actualizarCombo(
                    idCombo,
                    { nombre, descripcion, precio, precio_delivery: precioDelivery },
                    detalles
                );

                const combosActualizados = await main.getCombos();
                actualizarVistaCombos(combosActualizados);

                Swal.fire('Éxito', '¡El combo ha sido actualizado correctamente!', 'success');
            } catch (error) {
                console.error('Error al actualizar el combo:', error);
                Swal.fire('Error', 'Hubo un problema al actualizar el combo.', 'error');
            }
        });
    } catch (error) {
        console.error('Error al cargar datos del combo:', error);
        Swal.fire('Error', 'Hubo un problema al cargar los datos del combo.', 'error');
    }
}


function actualizarVistaCombos(combos) {
    renderListaCombos(combos)
}

    
async function eliminarCombo(id){
    Swal.fire({
        title: '¿Desea eliminar este combo?',
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
            'El combo fue borrado.',
            'success'
          )
          await main.borrarCombo(id)
          await actualizarCombos();
        }
      })
    return
}

// =======================================================
// FUNCIONES PARA VENTAS
// =======================================================
async function registrarNuevaVenta() {
    const fechaVentaInput = document.getElementById('fechaVenta');
    const fechaVentaSeleccionada = fechaVentaInput.value;
    const fechaActual = new Date();

    // Formatear fecha y hora
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
    
    // Obtener recargos actuales
    const { credito, debito } = await obtenerRecargosActuales();
    // Calcular total sin recargo (base para comisiones)
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
        tipo: item.tipo, // "producto" o "combo"
        cantidad: item.cantidad
    }));

    // Validaciones
    if (!cliente || productosSeleccionados.length === 0) {
        Swal.fire('Error', 'Por favor, completa todos los campos y selecciona al menos un producto o combo.', 'error');
        return;
    }
    if (!direccion) {
        Swal.fire('Error', 'Por favor ingresa una dirección válida.', 'error');
        return;
    }
    if (isNaN(costoEnvio)) {
        Swal.fire('Error', 'Por favor ingresa un costo de envío válido.', 'error');
        return;
    }

    // Verificar stock para productos y combos
    for (const item of items) {
        if (item.tipo === 'producto') {
            const producto = await main.getProductoById(item.id);
            if (producto.cantidad_disponible < item.cantidad) {
                Swal.fire('Error', `No hay suficiente stock para el producto ${producto.nombre}. Solo hay ${producto.cantidad_disponible} unidades disponibles.`, 'error');
                return;
            }
        } else if (item.tipo === 'combo') {
            const combo = await main.getComboById(item.id);
            for (const detalle of combo.detalles) {
                const producto = await main.getProductoById(detalle.id_producto);
                const stockNecesario = detalle.cantidad * item.cantidad;
                if (producto.cantidad_disponible < stockNecesario) {
                    Swal.fire('Error', `No hay suficiente stock para el producto ${producto.nombre} en el combo ${combo.nombre}. Solo hay ${producto.cantidad_disponible} unidades disponibles.`, 'error');
                    return;
                }
            }
        }
    }

    const descuento = descuentoSeleccionado ? {
        id: descuentoSeleccionado.id,
        nombre: descuentoSeleccionado.nombre,
        porcentaje: descuentoSeleccionado.porcentaje
    } : null;

    try {
        await main.registrarVenta({
            productos: items,
            cliente,
            telefono,
            direccion,
            costoEnvio,
            metodoPago,
            total: totalConRecargo,
            fecha: fechaFinal,
            descuento
        });

        Swal.fire({
            title: 'Venta registrada',
            html: `La venta se ha registrado correctamente.<br>
                  ${montoRecargo > 0 ? `Recargo aplicado (${porcentajeRecargo}%): $${montoRecargo.toFixed(2)}<br>` : ''}
                  Total: $${totalConRecargo.toFixed(2)}`,
            icon: 'success'
        });

        // Limpiar formulario y productos seleccionados
        document.getElementById('nombreCliente').value = '';
        document.getElementById('telefono').value = '';
        document.getElementById('tipoVenta').value = 'local';
        document.getElementById('direccion').value = 'local';
        document.getElementById('direccion').disabled = true;
        document.getElementById('costoEnvio').value = 0;
        document.getElementById('costoEnvio').disabled = true;
        document.getElementById('cantidadProducto').value = '';
        document.getElementById('metodoPago').value = 'efectivo'; // Resetear a efectivo
        document.getElementById('desgloseRecargo').style.display = 'none';
        productosSeleccionados = [];

        actualizarResumenVenta();

        // Actualizar la lista de ventas y productos
        await actualizarProductos();
        await cargarVentasPorFecha(fechaVentaSeleccionada);
    } catch (error) {
        console.error('Error al registrar la venta:', error);
        Swal.fire('Error', 'Hubo un problema al registrar la venta. Inténtalo nuevamente.', 'error');
    }
}

// Función auxiliar para obtener recargos actuales
async function obtenerRecargosActuales() {
    try {
        // 1. Obtener datos del backend
        const recargos = await main.obtenerRecargos();
        
        // 2. Validar y retornar con valores por defecto
        return {
            credito: recargos?.credito || 0,  // Si recargos.credito es undefined/null, usa 0
            debito: recargos?.debito || 0     // Si recargos.debito es undefined/null, usa 0
        };
        
    } catch (error) {
        console.error('Error al obtener recargos:', error);
        return { credito: 0, debito: 0 }; // Retorno seguro en caso de error
    }
}

async function cargarVentasPorFecha(fecha = null) {
    const fechaSeleccionada = fecha || document.getElementById('fechaVentas').value;
    const ventas = await main.obtenerVentasPorFecha(fechaSeleccionada);
    const listaVentas = document.getElementById('listaVentasRealizadas');
    listaVentas.innerHTML = ''; // Limpiar la lista de ventas

    // Iterar sobre las ventas
    ventas.forEach(venta => {
        const horaYMinutos = venta.horario.split(':').slice(0, 2).join(':'); // Extrae solo HH:MM

        // Crear el HTML para los productos independientes
        const productosHTML = venta.productos.map(producto => {
            const precio = venta.direccion === 'local' ? producto.precio : producto.precio_delivery;
            return `
                <li class="list-group-item">
                    ${producto.cantidad || 1} x ${producto.nombre} - $${precio?.toFixed(2) || '0.00'}
                </li>`;
        }).join('');

        // Crear el HTML para los combos
        const combosHTML = venta.combos.map(combo => {
            const precio = venta.direccion === 'local' ? combo.precio : combo.precio_delivery;
            return `
                <li class="list-group-item">
                    ${combo.cantidad} x ${combo.nombre} - $${(combo.cantidad * precio).toFixed(2)}
                    <br>
                    <small>Incluye: ${combo.productos.map(p => p.nombre).join(', ')}</small>
                </li>`;
        }).join('');

        // Crear el elemento de la venta
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

// =======================================================
// FUNCIONES PARA GESTIÓN DE VISTAS
// =======================================================
async function mostrarVista(vista) {
    const divVentas = document.getElementById('divVentas');
    const divBotonesVentas = document.getElementById('botonesDetalleVentas')
    const divConfiguraciones = document.getElementById('divConfiguraciones')
    const divStock = document.getElementById('divStock');
    const divCombos = document.getElementById('divCombos'); // Nueva vista
    const ventasButton = document.querySelector('.nav-buttons:nth-child(1)');
    const stockButton = document.querySelector('.nav-buttons:nth-child(2)');
    const combosButton = document.querySelector('.nav-buttons:nth-child(3)'); // Nuevo botón

    if (vista === 'ventas') {
        window.location.reload();
        divVentas.style.display = 'flex';
        divBotonesVentas.style.display = 'flex'
        divStock.style.display = 'none';
        divCombos.style.display = 'none';
        divConfiguraciones.style.display = 'none';
        ventasButton.classList.add('active');
        stockButton.classList.remove('active');
        combosButton.classList.remove('active');
        await actualizarProductos();
        await cargarVentasPorFecha();
    } else if (vista === 'stock') {
/*         const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        } */

        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none'
        divStock.style.display = 'block';
        divCombos.style.display = 'none';
        divConfiguraciones.style.display = 'none';
        await actualizarProductos();
        ventasButton.classList.remove('active');
        stockButton.classList.add('active');
        combosButton.classList.remove('active');
    } else if (vista === 'combos') {
/*         const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        } */

        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none';
        divStock.style.display = 'none';
        divConfiguraciones. style.display = 'none';
        divCombos.style.display = 'block';
        await actualizarCombos();
        ventasButton.classList.remove('active');
        stockButton.classList.remove('active');
        combosButton.classList.add('active');
    } else if (vista === 'configuracion') {
        await cargarDescuentos();
        divConfiguraciones. style.display = 'block';
        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none';
        divStock.style.display = 'none';
        divCombos.style.display = 'none';
    }
}


// =======================================================
// FUNCIONES DE VALIDACIÓN Y UTILIDAD
// =======================================================
function validarStock() {
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    
    // Verificar si los elementos existen
    if (!inputProducto) {
        console.error('No se encontró el elemento inputProducto en el DOM.');
        return;
    }
    if (!inputCantidad) {
        console.error('No se encontró el elemento cantidadProducto en el DOM.');
        return;
    }

    // Obtener el ID del producto y el precio desde los atributos del input
    const idProducto = inputProducto.dataset.productId;
    const nombreProducto = inputProducto.value; // El texto que se muestra en el input
    const stockDisponible = parseInt(inputProducto.dataset.stock); // Stock disponible desde el dataset
    const cantidadSeleccionada = parseInt(inputCantidad.value);

    if (!idProducto || !nombreProducto) {
        console.error('No se seleccionó un producto válido.');
        return;
    }

    // Validar la cantidad seleccionada
    if (cantidadSeleccionada > stockDisponible) {
        Swal.fire(
            'Stock insuficiente',
            `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible} unidades.`,
            'warning'
        );
        inputCantidad.value = stockDisponible; // Ajustar la cantidad al stock disponible
    }
}

function actualizarResumenVenta() {
    const listaResumen = document.getElementById('listaResumen');
    listaResumen.innerHTML = ''; // Limpiar el resumen actual

    productosSeleccionados.forEach((producto, index) => {
        // Crear un nuevo elemento de lista para cada producto
        const productoElemento = document.createElement('li');
        productoElemento.classList.add('list-group-item');

        // Crear el contenido del producto
        productoElemento.innerHTML = `
            <span>${producto.nombre} - ${producto.cantidad} x $${producto.precio}</span>
        `;

        const botonEliminar = document.createElement('button');
        botonEliminar.classList.add('btn', 'btn-light', 'btn-md', 'm-2', 'quitarProducto');
        botonEliminar.innerHTML = 'x';
        botonEliminar.onclick = () => quitarProducto(index);

        productoElemento.appendChild(botonEliminar);
        // Agregar el nuevo producto a la lista
        listaResumen.appendChild(productoElemento);
    });

    // Actualizar el total (si es necesario)
    const total = productosSeleccionados.reduce((acc, producto) => acc + (producto.precio * producto.cantidad), 0);
    document.getElementById('totalConEnvio').textContent = `$${total.toFixed(2)}`;
    actualizarTotalConEnvio()
}

// Función para actualizar los precios de todos los productos seleccionados
function actualizarPreciosSeleccionados() {
    const tipoVentaSelect = document.getElementById('tipoVenta');
    const tipoVenta = tipoVentaSelect.value;
    const precioTipo = tipoVenta === 'delivery' ? 'data-precio-delivery' : 'data-precio-local';

    const productosSeleccionados = document.querySelectorAll('.producto-seleccionado');
    productosSeleccionados.forEach(producto => {
        const nuevoPrecio = producto.getAttribute(precioTipo);
        if (nuevoPrecio) {
            const precioElemento = producto.querySelector('.precioProducto');
            if (precioElemento) {
                precioElemento.textContent = `$${nuevoPrecio}`;
            }
        }
    });
}

// Función para actualizar el precio de un producto específico en los productos seleccionados
function actualizarPrecioSeleccionado(idProducto, precioSeleccionado) {
    const productosSeleccionados = document.querySelectorAll('.producto-seleccionado');
    productosSeleccionados.forEach(producto => {
        if (producto.getAttribute('data-id') === idProducto) {
            const precioElemento = producto.querySelector('.precioProducto');
            if (precioElemento) {
                precioElemento.textContent = `$${precioSeleccionado}`;
            }
        }
    });
}


//document.getElementById('inputProducto').addEventListener('change', validarStock);
document.getElementById('cantidadProducto').addEventListener('input', validarStock);

cargarProductos();

// Actualizar stock en el frontend antes de agregar un producto o combo
async function obtenerStockActualizado(id, tipo) {
    if (tipo === 'producto') {
        // Obtener el producto específico desde la BD
        const productoActualizado = await main.getProductoById(id);
        return productoActualizado.cantidad_disponible;
    } else if (tipo === 'combo') {
        // Obtener el combo y calcular el stock mínimo de los productos que lo componen
        const combo = await main.getComboById(id);
        if (!combo || !combo.detalles) {
            throw new Error('El combo no contiene detalles válidos.');
        }

        // El stock del combo es el mínimo stock posible entre sus productos
        return Math.min(
            ...combo.detalles.map(detalle => {
                const producto = detalle;
                return producto.cantidad_disponible / detalle.cantidad;
            })
        );
    } else {
        throw new Error('Tipo desconocido al intentar obtener el stock.');
    }
}



// Función para actualizar el tipo de venta
function actualizarTipoVenta() {
    const tipoVenta = document.getElementById("tipoVenta").value;
    const costoEnvio = document.getElementById("costoEnvio");
    const direccion = document.getElementById("direccion")
    const productos = document.getElementById("productosSeleccionados").children;

    if (tipoVenta === "local") {
        // Desactivar y poner en 0 el campo de costo de envío
        costoEnvio.disabled = true;
        costoEnvio.value = 0;
        direccion.value = "local"
        direccion.disabled = true
        // Cambiar el precio de los productos a precio_local
        actualizarPreciosProductos("precio");
    } else if (tipoVenta === "delivery") {
        // Activar el campo de costo de envío
        costoEnvio.value = ""
        costoEnvio.disabled = false;
        direccion.value = ""
        direccion.disabled = false

        // Cambiar el precio de los productos a precio_delivery
        actualizarPreciosProductos("precio_delivery");
    }
}

async function actualizarPreciosProductos(precioTipo) {
    const productosSeleccionados = document.getElementById("productosSeleccionados").children;

    Array.from(productosSeleccionados).forEach(async producto => {
        const productoId = producto.getAttribute("data-id");
        // Aquí debes hacer una consulta para obtener el precio de cada producto (local o delivery)
        // Vamos a simularlo con una llamada AJAX o alguna lógica similar:
        await main.getProductoById(productoId).then(productoData => {
            const precio = productoData[precioTipo];  // Obtener el precio adecuado

            // Verificar si el elemento con la clase .precioProducto existe
            const precioElemento = producto.querySelector(".precioProducto");
            if (precioElemento) {
                precioElemento.textContent = "$" + precio;
            } else {
                console.warn("No se encontró el elemento con la clase .precioProducto para el producto con ID:", productoId);
            }
        });
    });
}


function quitarProducto(index) {
    productosSeleccionados.splice(index, 1);
    actualizarResumenVenta();
    actualizarTotalConEnvio()
}

function calcularTotalProductos() {
    return productosSeleccionados.reduce((total, producto) => total + (producto.precio * producto.cantidad), 0);
}

function actualizarTotalConEnvio() {
    const costoEnvio = parseFloat(document.getElementById('costoEnvio').value) || 0;
    const totalProductos = calcularTotalProductos();
    const totalConEnvio = totalProductos + costoEnvio;
    document.getElementById('totalConEnvio').textContent = `$${totalConEnvio.toFixed(2)}`;
    calcularTotalConRecargo()
}

// Llamar a la función cuando se carga la página
document.addEventListener("DOMContentLoaded", () => {
    // Llamar a la función para que se aplique la lógica inicial
    actualizarTipoVenta();
});


document.addEventListener('DOMContentLoaded', () => {
    const fechaVentaInput = document.getElementById('fechaVenta');
    if (fechaVentaInput) {
        const hoy = new Date().toISOString().split('T')[0];
        fechaVentaInput.value = hoy;
    }

    const fechaVentasInput = document.getElementById('fechaVentas');
    if (fechaVentasInput) {
        const hoy = new Date().toISOString().split('T')[0];
        fechaVentasInput.value = hoy;
    }
    cargarVentasPorFecha();
});


function toggleDetalleVenta(idVenta) {
    const detalleVenta = document.getElementById(`detalleVenta${idVenta}`);
    if (!detalleVenta) {
        console.error(`No se encontró el detalle para la venta con id: ${idVenta}`);
        return;
    }

    // Alternar visibilidad
    const isVisible = detalleVenta.style.display === 'block';
    detalleVenta.style.display = isVisible ? 'none' : 'block';
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
                    <label for="precioDelivery"><h5>Precio Delivery</h5></label>
                    <input type="number" id="precioDelivery" class="form-control" required>
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

// Función para filtrar productos por texto
function filtrarPorTexto(event) {
    filtroTexto = event.target.value;
    actualizarProductos();
}

function filtrarPorTextoCombo(event) {
    filtroTextoCombo = event.target.value;
    actualizarCombos();
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
    filtroTextoCombo = '';
    filtroFecha = false;
    fechaFiltroSeleccionada = '';
    actualizarProductos();
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

// Inicialización de eventos y datos
document.getElementById("filtroTexto").addEventListener("input", filtrarPorTexto);
async function init() {
    await actualizarProductos();
}
// Inicialización de eventos y datos
document.getElementById("filtroTextoCombo").addEventListener("input", filtrarPorTextoCombo);
async function init() {
    await actualizarProductos();
}


// =======================================================
// FUNCIONES PARA DESCARGA DE EXCEL
// =======================================================
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
/*     const tieneAcceso = await solicitarContrasena();
    if (!tieneAcceso) {
        Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
        return;
    } */

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

document.getElementById('nombreCliente').addEventListener('input', async function() {
    const nombreCliente = this.value.trim();

    if (nombreCliente.length > 0) {
        // Obtener clientes que coincidan con la entrada
        const clientes = await main.buscarClientesByNombre(nombreCliente);

        // Limpiar lista de sugerencias antes de mostrar nuevas
        const listaSugerencias = document.getElementById('clienteSugerencias');
        listaSugerencias.innerHTML = '';

        if (clientes.length > 0) {
            listaSugerencias.style.display = 'block'; // Mostrar sugerencias
            clientes.forEach(cliente => {
                const item = document.createElement('li');
                item.classList.add('list-group-item');
                item.textContent = cliente.nombre_cliente;

                // Al hacer clic en un item, completar el campo de texto con el nombre y teléfono
                item.addEventListener('click', function() {
                    document.getElementById('nombreCliente').value = cliente.nombre_cliente;
                    document.getElementById('telefono').value = cliente.telefono; // Completar el teléfono
                    listaSugerencias.style.display = 'none'; // Ocultar las sugerencias al hacer clic
                });

                listaSugerencias.appendChild(item);
            });
        } else {
            listaSugerencias.style.display = 'none'; // Ocultar sugerencias si no hay resultados
        }
    } else {
        document.getElementById('clienteSugerencias').style.display = 'none'; // Ocultar sugerencias si el campo está vacío
    }
});

// Para ocultar la lista de sugerencias si el usuario hace clic fuera del campo
document.addEventListener('click', function(e) {
    const listaSugerencias = document.getElementById('clienteSugerencias');
    const inputNombre = document.getElementById('nombreCliente');
    if (!inputNombre.contains(e.target) && !listaSugerencias.contains(e.target)) {
        listaSugerencias.style.display = 'none'; // Ocultar sugerencias si se hace clic fuera
    }
});

// Configuración del event listener para el cambio de fecha
document.getElementById('fechaVentas').addEventListener('change', async (event) => {
    const nuevaFecha = event.target.value;
    const fechaVentas = document.getElementById('fechaVentas');
    document.getElementById("fechaVenta").value = nuevaFecha
    if (fechaVentas) {
        fechaVentas.value = nuevaFecha;
    }
            await Promise.all([
            cargarVentasPorFecha(nuevaFecha),
            actualizarValoresVentas(nuevaFecha)
        ]);
});

document.getElementById('fechaVenta').addEventListener('change', async (event) => {
    const nuevaFecha = event.target.value;
    const fechaVentas = document.getElementById('fechaVentas');
    if (fechaVentas) {
        fechaVentas.value = nuevaFecha;
    }
            await Promise.all([
            cargarVentasPorFecha(nuevaFecha),
            actualizarValoresVentas(nuevaFecha)
        ]);
});

// Función para obtener la fecha actual del input
function obtenerFechaSeleccionada() {
    return document.getElementById('fechaVentas').value;
}


// Función para cargar los datos de ventas desde el backend
async function cargarDatosVentas(tipo, periodo) {
    try {
        // Aquí harías la llamada a tu backend
        // Ejemplo con fetch:
        const response = await fetch(`/api/ventas?tipo=${tipo}&periodo=${periodo}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al cargar datos de ventas:', error);
        return null;
    }
}

// Función para actualizar los contadores de ventas
async function actualizarValoresVentas(fecha = null) {
    try {
        const fechaSeleccionada = fecha || obtenerFechaSeleccionada();
        const ventasDelDia = await main.obtenerVentasPorFecha(fechaSeleccionada);
        
        // Calcular resúmenes
        const totalVentas = ventasDelDia.length;
        const ventasLocal = ventasDelDia.filter(v => v.direccion === 'local').length;
        const ventasDelivery = ventasDelDia.filter(v => v.direccion !== 'local').length;
        
        // Actualizar los botones
        document.getElementById('ventas-dia-total').textContent = totalVentas;
        document.getElementById('ventas-dia-local').textContent = ventasLocal;
        document.getElementById('ventas-dia-delivery').textContent = ventasDelivery;
        
    } catch (error) {
        console.error('Error al actualizar contadores:', error);
        document.getElementById('ventas-dia-total').textContent = 'Error';
        document.getElementById('ventas-dia-local').textContent = 'Error';
        document.getElementById('ventas-dia-delivery').textContent = 'Error';
    }
}

async function mostrarVentas(tipo) {
    try {
        const fechaSeleccionada = obtenerFechaSeleccionada();
        const ventasDelDia = await main.obtenerVentasPorFecha(fechaSeleccionada);

        let ventasFiltradas = [];
        let titulo = '';
        
        switch(tipo.toLowerCase()) {
            case 'total':
                ventasFiltradas = [...ventasDelDia];
                titulo = `Todas las ventas (${formatearFecha(fechaSeleccionada)})`;
                break;
                
            case 'local':
                ventasFiltradas = ventasDelDia.filter(v => {
                    return v.direccion && v.direccion.toLowerCase() === 'local';
                });
                titulo = `Ventas en local (${formatearFecha(fechaSeleccionada)})`;
                break;
                
            case 'delivery':
                ventasFiltradas = ventasDelDia.filter(v => {
                    return !v.direccion || v.direccion.toLowerCase() !== 'local';
                });
                titulo = `Ventas por delivery (${formatearFecha(fechaSeleccionada)})`;
                break;
                
            default:
                throw new Error(`Tipo de venta no reconocido: ${tipo}`);
        }

        // Obtener medios de pago disponibles
        const mediosPagoDisponibles = [...new Set(ventasDelDia.map(v => {
            if (!v.modo_pago) return null;
            const modo = v.modo_pago.toLowerCase();
            return modo === 'efectivo_y_otro' ? 'efectivo' : modo;
        }))].filter(m => m && m !== 'desconocido');

        // Ordenar los medios de pago
        const ordenMediosPago = ['efectivo', 'debito', 'credito', 'transferencia'];
        mediosPagoDisponibles.sort((a, b) => {
            return ordenMediosPago.indexOf(a) - ordenMediosPago.indexOf(b);
        });

        // Crear dropdown HTML
        let htmlDropdown = '';
        if (mediosPagoDisponibles.length > 0) {
            htmlDropdown = `
                <div style="margin: 15px 0;">
                    <label for="medioPagoSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Filtrar por medio de pago:</label>
                    <select id="medioPagoSelect" onchange="filtrarVentasPorPago('${tipo}', this.value)" 
                        style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="">Todos los medios de pago</option>
                        ${mediosPagoDisponibles.map(medio => {
                            const nombreMedio = {
                                'debito': 'Débito',
                                'credito': 'Crédito',
                                'transferencia': 'Transferencia',
                                'efectivo': 'Efectivo'
                            }[medio] || medio;
                            return `<option value="${medio}">${nombreMedio}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }

        // Mostrar datos iniciales
        mostrarDatosVentas(ventasFiltradas, titulo, htmlDropdown, fechaSeleccionada);

    } catch (error) {
        console.error('Error en mostrarVentas:', error);
        Swal.fire({
            title: 'Error',
            text: `No se pudieron cargar las ventas: ${error.message}`,
            icon: 'error'
        });
    }
}

// Función para filtrar por medio de pago
async function filtrarVentasPorPago(tipo, medioPago) {
    try {
        const fechaSeleccionada = obtenerFechaSeleccionada();
        const ventasDelDia = await main.obtenerVentasPorFecha(fechaSeleccionada);

        let ventasFiltradas = [];
        let titulo = '';
        
        switch(tipo.toLowerCase()) {
            case 'total':
                ventasFiltradas = [...ventasDelDia];
                titulo = `Todas las ventas (${formatearFecha(fechaSeleccionada)})`;
                break;
                
            case 'local':
                ventasFiltradas = ventasDelDia.filter(v => {
                    return v.direccion && v.direccion.toLowerCase() === 'local';
                });
                titulo = `Ventas en local (${formatearFecha(fechaSeleccionada)})`;
                break;
                
            case 'delivery':
                ventasFiltradas = ventasDelDia.filter(v => {
                    return !v.direccion || v.direccion.toLowerCase() !== 'local';
                });
                titulo = `Ventas por delivery (${formatearFecha(fechaSeleccionada)})`;
                break;
        }

        // Aplicar filtro por medio de pago si se especificó
        if (medioPago) {
            const medioPagoLower = medioPago.toLowerCase();
            ventasFiltradas = ventasFiltradas.filter(v => {
                if (!v.modo_pago) return false;
                
                const modoPagoVenta = v.modo_pago.toLowerCase();
                
                if (medioPagoLower === 'efectivo') {
                    return modoPagoVenta === 'efectivo' || modoPagoVenta === 'efectivo_y_otro';
                }
                
                return modoPagoVenta === medioPagoLower;
            });
            
            const nombresMediosPago = {
                'debito': 'Débito',
                'credito': 'Crédito',
                'transferencia': 'Transferencia',
                'efectivo': 'Efectivo'
            };
            
            titulo += ` - Medio: ${nombresMediosPago[medioPagoLower] || medioPago}`;
        }

        // Volver a generar el dropdown
        const mediosPagoDisponibles = [...new Set(ventasDelDia.map(v => {
            if (!v.modo_pago) return null;
            const modo = v.modo_pago.toLowerCase();
            return modo === 'efectivo_y_otro' ? 'efectivo' : modo;
        }))].filter(m => m && m !== 'desconocido');

        const ordenMediosPago = ['efectivo', 'debito', 'credito', 'transferencia'];
        mediosPagoDisponibles.sort((a, b) => {
            return ordenMediosPago.indexOf(a) - ordenMediosPago.indexOf(b);
        });

        let htmlDropdown = '';
        if (mediosPagoDisponibles.length > 0) {
            htmlDropdown = `
                <div style="margin: 15px 0;">
                    <label for="medioPagoSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Filtrar por medio de pago:</label>
                    <select id="medioPagoSelect" onchange="filtrarVentasPorPago('${tipo}', this.value)" 
                        style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="">Todos los medios de pago</option>
                        ${mediosPagoDisponibles.map(medio => {
                            const nombreMedio = {
                                'debito': 'Débito',
                                'credito': 'Crédito',
                                'transferencia': 'Transferencia',
                                'efectivo': 'Efectivo'
                            }[medio] || medio;
                            const selected = medio === medioPago ? 'selected' : '';
                            return `<option value="${medio}" ${selected}>${nombreMedio}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }

        mostrarDatosVentas(ventasFiltradas, titulo, htmlDropdown, fechaSeleccionada);

    } catch (error) {
        console.error('Error en filtrarVentasPorPago:', error);
        Swal.fire({
            title: 'Error',
            text: `No se pudieron filtrar las ventas: ${error.message}`,
            icon: 'error'
        });
    }
}

// Función auxiliar para mostrar los datos
function mostrarDatosVentas(ventasFiltradas, titulo, htmlDropdown, fechaSeleccionada) {
    const total = ventasFiltradas.reduce((sum, venta) => {
        const valor = Number(venta.total) || 0;
        return sum + valor;
    }, 0);

    const totalFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(total);

    Swal.fire({
        title: titulo,
        html: `
            <div style="text-align: left;">
                ${htmlDropdown}
                <p><strong>Cantidad:</strong> ${ventasFiltradas.length}</p>
                <p><strong>Total:</strong> ${totalFormateado}</p>
                <p><strong>Fecha:</strong> ${formatearFecha(fechaSeleccionada)}</p>
                ${ventasFiltradas.length > 0 ? `
                <p><strong>Promedio por venta:</strong> ${new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS'
                }).format(total / ventasFiltradas.length)}</p>` : ''}
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Cerrar'
    });
}

function formatearFecha(fechaISO) {
    const [año, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${año}`;
}

async function abrirModalVentasMes() {
    try {
        const ahora = new Date();
        const mesActual = ahora.getMonth() + 1;
        const añoActual = ahora.getFullYear();
        
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        const años = [];
        for (let i = añoActual - 1; i <= añoActual + 1; i++) {
            años.push(i);
        }
        
        const { value: formValues } = await Swal.fire({
            title: 'Seleccionar Ventas del Mes',
            html: `
                <label for="tipoVentas">Tipo de Venta:</label>
                <select id="tipoVentas" class="swal2-select">
                    <option value="total">Todas las ventas</option>
                    <option value="local">Ventas en Local</option>
                    <option value="delivery">Ventas por Delivery</option>
                </select>
                
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <div style="flex: 1;">
                        <label for="mesVentas">Mes:</label>
                        <select id="mesVentas" class="swal2-select">
                            ${meses.map((mes, index) => 
                                `<option value="${index + 1}" ${index + 1 === mesActual ? 'selected' : ''}>${mes}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div style="flex: 1;">
                        <label for="añoVentas">Año:</label>
                        <select id="añoVentas" class="swal2-select">
                            ${años.map(año => 
                                `<option value="${año}" ${año === añoActual ? 'selected' : ''}>${año}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                return {
                    tipo: document.getElementById('tipoVentas').value,
                    mes: document.getElementById('mesVentas').value,
                    año: document.getElementById('añoVentas').value
                }
            }
        });

        if (formValues) {
            Swal.showLoading();
            
            const mesFormateado = formValues.mes.toString().padStart(2, '0');
            const fechaConsulta = `${formValues.año}-${mesFormateado}`;
            
            // Cargar datos iniciales sin filtro de pago
            const datos = await cargarDatosVentas(formValues.tipo, 'mes', fechaConsulta);
            
            if (!datos || datos.ventas.length === 0) {
                return Swal.fire({
                    title: 'Sin datos',
                    html: `No se encontraron ventas para ${meses[formValues.mes - 1]} de ${formValues.año}`,
                    icon: 'warning'
                });
            }

            // Obtener medios de pago disponibles
            const mediosPagoDisponibles = [...new Set(datos.ventas.map(v => {
                if (!v.modo_pago) return null;
                const modo = v.modo_pago.toLowerCase();
                return modo === 'efectivo_y_otro' ? 'efectivo' : modo;
            }))].filter(m => m && m !== 'desconocido');

            // Ordenar los medios de pago
            const ordenMediosPago = ['efectivo', 'debito', 'credito', 'transferencia'];
            mediosPagoDisponibles.sort((a, b) => {
                return ordenMediosPago.indexOf(a) - ordenMediosPago.indexOf(b);
            });

            // Crear dropdown HTML para filtros
            let htmlDropdown = '';
            if (mediosPagoDisponibles.length > 0) {
                htmlDropdown = `
                    <div style="margin: 15px 0;">
                        <label for="medioPagoSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Filtrar por medio de pago:</label>
                        <select id="medioPagoSelect" onchange="filtrarVentasMesPorPago('${formValues.tipo}', '${fechaConsulta}', this.value)" 
                            style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                            <option value="">Todos los medios de pago</option>
                            ${mediosPagoDisponibles.map(medio => {
                                const nombreMedio = {
                                    'debito': 'Débito',
                                    'credito': 'Crédito',
                                    'transferencia': 'Transferencia',
                                    'efectivo': 'Efectivo'
                                }[medio] || medio;
                                return `<option value="${medio}">${nombreMedio}</option>`;
                            }).join('')}
                        </select>
                    </div>
                `;
            }

            const totalFormateado = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(datos.monto_total || datos.total || 0);
            
            Swal.fire({
                title: `Ventas de ${meses[formValues.mes - 1]} de ${formValues.año}`,
                html: `
                    <div style="text-align: left;">
                        ${htmlDropdown}
                        <p><strong>Tipo:</strong> ${formValues.tipo === 'total' ? 'Todas las ventas' : 
                          formValues.tipo === 'local' ? 'Ventas en local' : 'Ventas por delivery'}</p>
                        <p><strong>Cantidad:</strong> ${datos.cantidad}</p>
                        <p><strong>Monto total:</strong> ${totalFormateado}</p>
                        ${datos.ventas.length > 0 ? `
                        <p><strong>Promedio por venta:</strong> ${new Intl.NumberFormat('es-AR', {
                            style: 'currency',
                            currency: 'ARS'
                        }).format(datos.monto_total / datos.cantidad)}</p>` : ''}
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Cerrar'
            });
        }
    } catch (error) {
        console.error("Error al cargar ventas:", error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar las ventas. Por favor, intente nuevamente.',
            icon: 'error'
        });
    }
}

// Nueva función para filtrar ventas mensuales por medio de pago
async function filtrarVentasMesPorPago(tipo, fechaConsulta, medioPago) {
    try {
        Swal.showLoading();
        
        // Cargar datos sin filtrar primero
        const datos = await cargarDatosVentas(tipo, 'mes', fechaConsulta);
        
        if (!datos || datos.ventas.length === 0) {
            return;
        }

        // Aplicar filtro por medio de pago si se especificó
        let ventasFiltradas = datos.ventas;
        let montoTotal = datos.monto_total;
        let cantidad = datos.cantidad;
        
        if (medioPago) {
            const medioPagoLower = medioPago.toLowerCase();
            ventasFiltradas = ventasFiltradas.filter(v => {
                if (!v.modo_pago) return false;
                
                const modoPagoVenta = v.modo_pago.toLowerCase();
                
                if (medioPagoLower === 'efectivo') {
                    return modoPagoVenta === 'efectivo' || modoPagoVenta === 'efectivo_y_otro';
                }
                
                return modoPagoVenta === medioPagoLower;
            });
            
            montoTotal = ventasFiltradas.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
            cantidad = ventasFiltradas.length;
        }

        // Obtener medios de pago disponibles (pueden cambiar después de filtrar)
        const mediosPagoDisponibles = [...new Set(datos.ventas.map(v => {
            if (!v.modo_pago) return null;
            const modo = v.modo_pago.toLowerCase();
            return modo === 'efectivo_y_otro' ? 'efectivo' : modo;
        }))].filter(m => m && m !== 'desconocido');

        // Ordenar los medios de pago
        const ordenMediosPago = ['efectivo', 'debito', 'credito', 'transferencia'];
        mediosPagoDisponibles.sort((a, b) => {
            return ordenMediosPago.indexOf(a) - ordenMediosPago.indexOf(b);
        });

        // Crear dropdown HTML para filtros
        let htmlDropdown = '';
        if (mediosPagoDisponibles.length > 0) {
            htmlDropdown = `
                <div style="margin: 15px 0;">
                    <label for="medioPagoSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Filtrar por medio de pago:</label>
                    <select id="medioPagoSelect" onchange="filtrarVentasMesPorPago('${tipo}', '${fechaConsulta}', this.value)" 
                        style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="">Todos los medios de pago</option>
                        ${mediosPagoDisponibles.map(medio => {
                            const nombreMedio = {
                                'debito': 'Débito',
                                'credito': 'Crédito',
                                'transferencia': 'Transferencia',
                                'efectivo': 'Efectivo'
                            }[medio] || medio;
                            const selected = medio === medioPago ? 'selected' : '';
                            return `<option value="${medio}" ${selected}>${nombreMedio}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }

        const [anio, mes] = fechaConsulta.split('-');
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        const totalFormateado = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(montoTotal);
        
        let titulo = `Ventas de ${meses[parseInt(mes) - 1]} de ${anio}`;
        if (medioPago) {
            const nombresMediosPago = {
                'debito': 'Débito',
                'credito': 'Crédito',
                'transferencia': 'Transferencia',
                'efectivo': 'Efectivo'
            };
            titulo += ` - Medio: ${nombresMediosPago[medioPago.toLowerCase()] || medioPago}`;
        }
        
        Swal.fire({
            title: titulo,
            html: `
                <div style="text-align: left;">
                    ${htmlDropdown}
                    <p><strong>Tipo:</strong> ${tipo === 'total' ? 'Todas las ventas' : 
                      tipo === 'local' ? 'Ventas en local' : 'Ventas por delivery'}</p>
                    <p><strong>Cantidad:</strong> ${cantidad}</p>
                    <p><strong>Monto total:</strong> ${totalFormateado}</p>
                    ${ventasFiltradas.length > 0 ? `
                    <p><strong>Promedio por venta:</strong> ${new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS'
                    }).format(montoTotal / cantidad)}</p>` : ''}
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Cerrar'
        });

    } catch (error) {
        console.error("Error al filtrar ventas:", error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudieron filtrar las ventas. Por favor, intente nuevamente.',
            icon: 'error'
        });
    }
}

async function cargarDatosVentas(tipo, periodo, fecha = null) {
    try {
        if (periodo === 'mes' && fecha) {
            const [anio, mes] = fecha.split('-');
            
            // Verificar si la fecha es futura
            const ahora = new Date();
            const fechaConsulta = new Date(anio, mes - 1, 1);
            
            if (fechaConsulta > ahora) {
                return {
                    ventas: [],
                    cantidad: 0,
                    monto_total: 0
                };
            }

            const data = await main.getVentasPorMesAnio(anio, mes, tipo);
            
            if (!data) {
                throw new Error("No se recibieron datos del servidor");
            }

            return {
                ventas: data.ventas || [],
                cantidad: data.cantidad || data.ventas.length,
                monto_total: data.monto_total || data.total || 0
            };
        } else {
            const ventasDelDia = await main.obtenerVentasPorFecha(fecha);
            
            let ventasFiltradas = ventasDelDia;
            if (tipo === 'local') {
                ventasFiltradas = ventasDelDia.filter(v => v.direccion === 'local');
            } else if (tipo === 'delivery') {
                ventasFiltradas = ventasDelDia.filter(v => v.direccion !== 'local');
            }
            
            return {
                ventas: ventasFiltradas,
                cantidad: ventasFiltradas.length,
                monto_total: ventasFiltradas.reduce((sum, v) => sum + (Number(v.total) || 0), 0)
            };
        }
    } catch (error) {
        console.error("Error en cargarDatosVentas:", error);
        return {
            ventas: [],
            cantidad: 0,
            monto_total: 0,
            error: error.message
        };
    }
}

// Cargar los valores iniciales al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    actualizarValoresVentas();
    
    // Opcional: Actualizar cada cierto tiempo (ej. cada 5 minutos)
    setInterval(actualizarValoresVentas, 300000);
});

document.addEventListener('DOMContentLoaded', async () => {
    await cargarDescuentos();
    configurarBusquedaDescuentos();
});

// Modal de configuración actualizado
async function abrirModalConfigurarRecargos() {
    const { credito, debito } = await main.obtenerRecargos();
    
    const { value: formValues } = await Swal.fire({
        title: 'Configurar Recargos',
        html: `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Tarjeta de Crédito:</label>
                    <div class="input-group">
                        <input type="number" id="recargoCredito" class="form-control" 
                               value="${credito}" min="0" max="100" step="0.1">
                        <div class="input-group-append">
                            <span class="input-group-text" style="height:100%;">%</span>
                        </div>
                    </div>
                </div>
                <div class="form-group mt-3">
                    <label>Tarjeta de Débito:</label>
                    <div class="input-group">
                        <input type="number" id="recargoDebito" class="form-control" 
                               value="${debito}" min="0" max="100" step="0.1">
                        <div class="input-group-append">
                            <span class="input-group-text" style="height:100%;">%</span>
                        </div>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                credito: parseFloat(document.getElementById('recargoCredito').value) || 0,
                debito: parseFloat(document.getElementById('recargoDebito').value) || 0
            }
        }
    });

    if (formValues) {
        const success = await main.guardarRecargos(formValues.credito, formValues.debito);
        if (success) {
            Swal.fire('Éxito', 'Recargos actualizados correctamente', 'success');
        } else {
            Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
        }
    }
}



// Función de ejemplo para manejar los recargos guardados
function actualizarConfiguracionRecargos(credito, debito) {
    // Aquí implementa la lógica para aplicar los recargos
    console.log(`Aplicando recargos - Crédito: ${credito}%, Débito: ${debito}%`);
    
    // Ejemplo de cómo podrías guardar en localStorage
    localStorage.setItem('configRecargos', JSON.stringify({
        credito,
        debito,
        fechaActualizacion: new Date().toISOString()
    }));
    
    // También podrías hacer una llamada a tu backend aquí
}


async function calcularTotalConRecargo() {
    if (recargosActuales.credito === 0 && recargosActuales.debito === 0) {
        const {credito, debito} = await main.obtenerRecargos()
        recargosActuales.credito = credito
        recargosActuales.debito = debito
    }
    const metodoPago = document.getElementById('metodoPago').value;
    const totalSinRecargo = parseFloat(document.getElementById('totalConEnvio').textContent.replace('$', '')) || 0;
    console.log("totalSinRecargo")
    console.log(totalSinRecargo)
    let totalConRecargo = totalSinRecargo;
    const desglose = document.getElementById('desgloseRecargo');

    if (metodoPago === 'credito' || metodoPago === 'debito') {
        const porcentaje = metodoPago === 'credito' ? recargosActuales.credito : recargosActuales.debito;
        const recargo = totalSinRecargo * (porcentaje / 100);
        totalConRecargo = totalSinRecargo + recargo;
        
        // Mostrar desglose
        document.getElementById('subtotal').textContent = `${new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(totalSinRecargo)}`;
        document.getElementById('montoRecargo').textContent = `${new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(recargo)}`;
        document.getElementById('porcentajeRecargo').textContent = porcentaje;
        document.getElementById('totalFinal').textContent = `${new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(totalConRecargo)}`;
        desglose.style.display = 'block';
    } else {
        desglose.style.display = 'none';
    }

    document.getElementById('totalConEnvio').textContent = `$${totalConRecargo.toFixed(2)}`;
    return totalConRecargo;
}

async function cargarDescuentos() {
    descuentosDisponibles = await main.obtenerDescuentos();
    renderListaDescuentos(descuentosDisponibles);
}

// Modal para crear nuevo descuento
async function abrirModalCrearDescuento() {
    const { value: formValues } = await Swal.fire({
        title: 'Crear Nuevo Descuento',
        html: `
            <div class="form-group">
                <label>Nombre del Descuento</label>
                <input type="text" id="nombreDescuento" class="form-control" placeholder="Ej: Cliente frecuente" required>
            </div>
            <div class="form-group">
                <label>Porcentaje de Descuento</label>
                <div class="input-group">
                    <input type="number" id="porcentajeDescuento" class="form-control" 
                           min="1" max="100" required>
                    <div class="input-group-append">
                        <span class="input-group-text">%</span>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const nombre = document.getElementById('nombreDescuento').value.trim();
            const porcentajeInput = document.getElementById('porcentajeDescuento');
            console.log(porcentajeInput.textContent)
            const porcentaje = parseFloat(porcentajeInput.value);
            
            // Validaciones
            if (!nombre) {
                Swal.showValidationMessage('El nombre del descuento es obligatorio');
                return false;
            }
            
            if (isNaN(porcentaje)) {
                Swal.showValidationMessage('Ingrese un porcentaje válido');
                return false;
            }
            
            if (porcentaje <= 0 || porcentaje > 100) {
                Swal.showValidationMessage('El porcentaje debe estar entre 1 y 100');
                return false;
            }
            
            return {
                nombre: nombre,
                porcentaje: porcentaje
            };
        }
    });

    if (formValues) {
        try {
            await main.crearDescuento(formValues.nombre, formValues.porcentaje);
            await cargarDescuentos();
            Swal.fire('Éxito', 'Descuento creado correctamente', 'success');
        } catch (error) {
            console.error('Error al crear descuento:', error);
            Swal.fire('Error', 'No se pudo crear el descuento', 'error');
        }
    }
}

// Función para editar descuento
async function editarDescuento(id) {
    const descuento = descuentosDisponibles.find(d => d.id === id);
    
    if (!descuento) return;
    
    const { value: formValues } = await Swal.fire({
        title: 'Editar Descuento',
        html: `
            <div class="form-group">
                <label>Nombre del Descuento</label>
                <input type="text" id="editNombreDescuento" class="form-control" value="${descuento.nombre}">
            </div>
            <div class="form-group">
                <label>Porcentaje de Descuento</label>
                <div class="input-group">
                    <input type="number" id="editPorcentajeDescuento" class="form-control" 
                           value="${descuento.porcentaje_descuento}" min="1" max="100" step="0.1">
                    <div class="input-group-append">
                        <span class="input-group-text">%</span>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('editNombreDescuento').value,
                porcentaje: parseFloat(document.getElementById('editPorcentajeDescuento').value)
            }
        }
    });

    if (formValues) {
        await main.actualizarDescuento(id, formValues.nombre, formValues.porcentaje);
        await cargarDescuentos();
        Swal.fire('Éxito', 'Descuento actualizado correctamente', 'success');
    }
}

// Función para eliminar descuento
async function eliminarDescuento(id) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar descuento?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        await main.eliminarDescuento(id);
        await cargarDescuentos();
        Swal.fire('Eliminado', 'El descuento ha sido eliminado', 'success');
    }
}

function configurarBusquedaDescuentos() {
    const inputDescuento = document.getElementById('inputDescuento');
    const dropdownDescuentos = document.getElementById('dropdownDescuentos');

    if (!inputDescuento || !dropdownDescuentos) return;

    inputDescuento.addEventListener('focus', async () => {
        if (!descuentosDisponibles.length) {
            descuentosDisponibles = await main.obtenerDescuentos();
        }
        mostrarDescuentos(descuentosDisponibles);
    });

    inputDescuento.addEventListener('input', () => {
        const searchTerm = inputDescuento.value.toLowerCase();
        const filtered = descuentosDisponibles.filter(d => 
            d.nombre.toLowerCase().includes(searchTerm)
            .slice(0, 5));
        mostrarDescuentos(filtered);
    });

    function mostrarDescuentos(descuentos) {
        dropdownDescuentos.innerHTML = descuentos.map(d => `
            <li>
                <a href="#" class="dropdown-item" 
                   data-id="${d.id}" 
                   data-porcentaje="${d.porcentaje_descuento}">
                   ${d.nombre} (${d.porcentaje_descuento}%)
                </a>
            </li>
        `).join('');
        
        dropdownDescuentos.style.display = descuentos.length ? 'block' : 'none';
    }
    dropdownDescuentos.addEventListener('click', (e) => {
        const selected = e.target.closest('.dropdown-item');
        if (!selected) return;

        inputDescuento.value = selected.textContent.trim();
        descuentoSeleccionado = {
            id: selected.getAttribute('data-id'),
            nombre: selected.textContent.trim(),
            porcentaje: parseFloat(selected.getAttribute('data-porcentaje'))
        };
        dropdownDescuentos.style.display = 'none';
        actualizarTotalConDescuento();
    });

    document.addEventListener('click', (e) => {
        if (!dropdownDescuentos.contains(e.target)) {
            dropdownDescuentos.style.display = 'none';
        }
    });
}

// Función para actualizar el total con descuento
function actualizarTotalConDescuento() {
    const totalElement = document.getElementById('totalConEnvio');
    const total = parseFloat(totalElement.textContent.replace('$', '')) || 0;
    
    if (descuentoSeleccionado) {
        const descuento = total * (descuentoSeleccionado.porcentaje / 100);
        const totalConDescuento = total - descuento;
        
        // Mostrar el desglose del descuento
        document.getElementById('desgloseDescuento').style.display = 'block';
        document.getElementById('montoDescuento').textContent = `-$${descuento.toFixed(2)}`;
        document.getElementById('porcentajeDescuento').textContent = descuentoSeleccionado.porcentaje;
        document.getElementById('totalConDescuento').textContent = `$${totalConDescuento.toFixed(2)}`;
    } else {
        document.getElementById('desgloseDescuento').style.display = 'none';
    }
}

// Función para renderizar la tabla de descuentos
function renderListaDescuentos(descuentos) {
    const listaDescuentos = document.getElementById('listaDescuentos');
    
    if (!listaDescuentos) return;
    
    listaDescuentos.innerHTML = `
        <table class="table table-striped table-bordered">
            <thead class="thead-dark">
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Porcentaje</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${descuentos.map(d => `
                    <tr>
                        <td>${d.id}</td>
                        <td>${d.nombre}</td>
                        <td>${d.porcentaje_descuento}%</td>
                        <td>
                            <button onclick="editarDescuento(${d.id})" class="btn btn-primary btn-sm">EDITAR</button>
                            <button onclick="eliminarDescuento(${d.id})" class="btn btn-danger btn-sm">BORRAR</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
}



['metodoPago', 'costoEnvio'].forEach(id => {
    document.getElementById(id).addEventListener('change', actualizarTotalConEnvio);
});

init();

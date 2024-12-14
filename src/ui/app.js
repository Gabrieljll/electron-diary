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
    // Obtener productos disponibles
    main.getProductos().then((productos) => {
        const productosHTML = productos.map(p => `
            <div class="list-group-item">
                <input type="checkbox" class="form-check-input me-2 producto-checkbox" 
                    data-id="${p.id}" 
                    data-nombre="${p.nombre}" 
                    data-stock="${p.cantidad_disponible}">
                <label class="form-check-label">
                    ${p.nombre} (Stock: ${p.cantidad_disponible})
                </label>
                <input type="number" class="form-control form-control-sm mt-2 cantidad-producto" 
                    placeholder="Cantidad" 
                    min="1" 
                    max="${p.cantidad_disponible}" 
                    style="display: none;">
            </div>
        `).join('');

        // Mostrar el modal
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
                            <label class="mt-2"><h5>Seleccionar Productos</h5></label>
                            <div id="productosSeleccionables" class="list-group">
                                ${productosHTML}
                            </div>
                        </div>
                    </form>
                </div>
                <button type="button" id="guardarComboBtn" class="btn btn-success mt-3">Guardar Combo</button>
            `,
            showCloseButton: true,
            showConfirmButton: false,
        });

        // Manejar selección de productos
        const checkboxes = document.querySelectorAll('.producto-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const cantidadInput = event.target.closest('.list-group-item').querySelector('.cantidad-producto');
                if (event.target.checked) {
                    cantidadInput.style.display = 'block';
                    cantidadInput.value = 1; // Valor inicial
                } else {
                    cantidadInput.style.display = 'none';
                    cantidadInput.value = ''; // Limpiar valor
                }
            });
        });

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

            const detalles = [];
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const idProducto = parseInt(checkbox.dataset.id);
                    const cantidad = parseInt(checkbox.closest('.list-group-item').querySelector('.cantidad-producto').value);

                    if (isNaN(cantidad) || cantidad <= 0) {
                        Swal.fire('Error', 'Ingrese cantidades válidas para los productos seleccionados.', 'error');
                        return;
                    }

                    detalles.push({ id_producto: idProducto, cantidad });
                }
            });

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
                Swal.close();
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
        // Obtener los datos del combo y sus productos asociados
        const combo = await main.getComboById(idCombo);
        if (!combo) {
            Swal.fire('Error', 'No se encontró el combo especificado.', 'error');
            return;
        }

        // Obtener todos los productos disponibles
        const productos = await main.getProductos();

        // Generar HTML para los productos, marcando los seleccionados y configurando sus cantidades
        const productosHTML = productos.map(p => {
            const productoEnCombo = combo.detalles.find(detalle => detalle.id_producto === p.id);
            const seleccionado = productoEnCombo ? 'checked' : '';
            const cantidad = productoEnCombo ? productoEnCombo.cantidad : '';
            const cantidadInputStyle = productoEnCombo ? 'display: block;' : 'display: none;';

            return `
                <div class="list-group-item">
                    <input type="checkbox" class="form-check-input me-2 producto-checkbox" 
                        data-id="${p.id}" 
                        data-nombre="${p.nombre}" 
                        data-stock="${p.cantidad_disponible}" 
                        ${seleccionado}>
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

        // Mostrar el modal con los datos cargados
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
                            <label class="mt-2"><h5>Seleccionar Productos</h5></label>
                            <div id="productosSeleccionables" class="list-group">
                                ${productosHTML}
                            </div>
                        </div>
                    </form>
                </div>
                <button type="button" id="guardarComboBtn" class="btn btn-success mt-3">Guardar Cambios</button>
            `,
            showCloseButton: true,
            showConfirmButton: false,
        });

        // Manejar selección de productos
        const checkboxes = document.querySelectorAll('.producto-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const cantidadInput = event.target.closest('.list-group-item').querySelector('.cantidad-producto');
                if (event.target.checked) {
                    cantidadInput.style.display = 'block';
                    cantidadInput.value = 1; // Valor inicial
                } else {
                    cantidadInput.style.display = 'none';
                    cantidadInput.value = ''; // Limpiar valor
                }
            });
        });

        // Guardar cambios del combo
        document.getElementById('guardarComboBtn').addEventListener('click', async () => {
            const nombre = document.getElementById('comboNombre').value.trim();
            const descripcion = document.getElementById('comboDescripcion').value.trim();
            const precio = parseFloat(document.getElementById('comboPrecio').value);
            const precioDelivery = parseFloat(document.getElementById('comboPrecioDelivery').value);

            if (!nombre || !descripcion || isNaN(precio) || isNaN(precioDelivery)) {
                Swal.fire('Error', 'Por favor, complete todos los campos del formulario.', 'error');
                return;
            }

            const detalles = [];
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const idProducto = parseInt(checkbox.dataset.id);
                    const cantidad = parseInt(checkbox.closest('.list-group-item').querySelector('.cantidad-producto').value);

                    if (isNaN(cantidad) || cantidad <= 0) {
                        Swal.fire('Error', 'Ingrese cantidades válidas para los productos seleccionados.', 'error');
                        return;
                    }

                    detalles.push({ id_producto: idProducto, cantidad });
                }
            });

            if (detalles.length === 0) {
                Swal.fire('Error', 'Debe seleccionar al menos un producto para el combo.', 'error');
                return;
            }

            // Llamar al backend para actualizar el combo
            try {
                await main.actualizarCombo(
                    idCombo,
                    { nombre, descripcion, precio, precio_delivery: precioDelivery },
                    detalles
                );

                // Actualizar dinámicamente la vista de combos
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
    const total = parseFloat(document.getElementById('totalConEnvio').textContent.replace('$', ''));
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

    try {
        await main.registrarVenta({
            productos: items,
            cliente,
            telefono,
            direccion,
            metodoPago,
            total,
            fecha: fechaFinal
        });

        Swal.fire('Venta registrada', 'La venta se ha registrado correctamente y el stock ha sido actualizado.', 'success');

        // Limpiar formulario y productos seleccionados
        document.getElementById('nombreCliente').value = '';
        document.getElementById('telefono').value = '';
        document.getElementById('tipoVenta').value = 'local';
        document.getElementById('direccion').value = 'local';
        document.getElementById('direccion').disabled = true;
        document.getElementById('costoEnvio').value = 0;
        document.getElementById('costoEnvio').disabled = true;
        document.getElementById('cantidadProducto').value = '';
        document.getElementById('metodoPago').value = '';
        productosSeleccionados = [];

        actualizarResumenVenta();

        // Actualizar la lista de ventas y productos
        const fechaHoy = new Date();
        const fechaFormateada = fechaHoy.getFullYear() + '-' 
            + (fechaHoy.getMonth() + 1).toString().padStart(2, '0') + '-' 
            + fechaHoy.getDate().toString().padStart(2, '0');
        await cargarVentasPorFecha(fechaFormateada);
        await actualizarProductos();
    } catch (error) {
        console.error('Error al registrar la venta:', error);
        Swal.fire('Error', 'Hubo un problema al registrar la venta. Inténtalo nuevamente.', 'error');
    }
}


async function cargarVentasPorFecha(fecha = null) {
    const fechaSeleccionada = fecha || document.getElementById('fechaVentas').value;
    const ventas = await main.obtenerVentasPorFecha(fechaSeleccionada);
    console.log(ventas)
    const listaVentas = document.getElementById('listaVentasRealizadas');
    listaVentas.innerHTML = ''; // Limpiar la lista de ventas

    // Iterar sobre las ventas
    ventas.forEach(venta => {
        const horaYMinutos = venta.horario.split(':').slice(0, 2).join(':'); // Extrae solo HH:MM

        // Crear el HTML para los productos independientes
        const productosHTML = venta.productos.map(producto => `
            <li class="list-group-item">
                ${producto.cantidad || 1} x ${producto.nombre} - $${producto.precio?.toFixed(2) || '0.00'}
            </li>`).join('');

        // Crear el HTML para los combos
        const combosHTML = venta.combos.map(combo => `
            <li class="list-group-item">
                ${combo.cantidad} x ${combo.nombre} - $${(combo.cantidad * combo.precio).toFixed(2)}
                <br>
                <small>Incluye: ${combo.productos.map(p => p.nombre).join(', ')}</small>
            </li>`).join('');

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
    const divStock = document.getElementById('divStock');
    const divCombos = document.getElementById('divCombos'); // Nueva vista
    const ventasButton = document.querySelector('.nav-buttons:nth-child(1)');
    const stockButton = document.querySelector('.nav-buttons:nth-child(2)');
    const combosButton = document.querySelector('.nav-buttons:nth-child(3)'); // Nuevo botón

    if (vista === 'ventas') {
        window.location.reload();
        divVentas.style.display = 'flex';
        divStock.style.display = 'none';
        divCombos.style.display = 'none';
        ventasButton.classList.add('active');
        stockButton.classList.remove('active');
        combosButton.classList.remove('active');
        await actualizarProductos();
    } else if (vista === 'stock') {
        const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        }

        divVentas.style.display = 'none';
        divStock.style.display = 'block';
        divCombos.style.display = 'none';
        await actualizarProductos();
        ventasButton.classList.remove('active');
        stockButton.classList.add('active');
        combosButton.classList.remove('active');
    } else if (vista === 'combos') {
        const tieneAcceso = await solicitarContrasena();
        if (!tieneAcceso) {
            Swal.fire('Acceso denegado', 'La contraseña ingresada es incorrecta', 'error');
            return;
        }

        divVentas.style.display = 'none';
        divStock.style.display = 'none';
        divCombos.style.display = 'block';
        await actualizarCombos();
        ventasButton.classList.remove('active');
        stockButton.classList.remove('active');
        combosButton.classList.add('active');
    }
}


// =======================================================
// FUNCIONES DE VALIDACIÓN Y UTILIDAD
// =======================================================
function validarStock() {
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    
    console.log("lala")
    console.log(inputProducto)

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
            console.log(productoData);
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


init();

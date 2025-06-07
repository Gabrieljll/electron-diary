// Parte 1 - Inicial y funciones principales
const { ipcRenderer } = window.api;


let filtroTextoCombo = '';
let fechaFiltroSeleccionada = '';
let divListaCombos = document.getElementById('divListaCombos');

async function abrirModalAgregarCombo() {
    try {
        const productos = await ipcRenderer.invoke('producto:obtener-todos');
        let productosFiltrados = [...productos];
        const seleccionados = new Map();

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
                    </div>`;
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

            const detalles = Array.from(seleccionados.entries()).map(([id, s]) => ({
                id_producto: id,
                cantidad: s.cantidad
            }));

            if (detalles.length === 0) {
                Swal.fire('Error', 'Debe seleccionar al menos un producto para el combo.', 'error');
                return;
            }

            try {
                await ipcRenderer.invoke('combo:nuevo', {
                    nombre,
                    descripcion,
                    precio,
                    precio_delivery: precioDelivery,
                    detalles
                });

                Swal.fire('Éxito', '¡El combo ha sido agregado correctamente!', 'success');
                await actualizarCombos();
            } catch (error) {
                console.error('Error al guardar el combo:', error);
                Swal.fire('Error', 'Hubo un problema al guardar el combo.', 'error');
            }
        });

    } catch (error) {
        console.error('Error al cargar productos:', error);
        Swal.fire('Error', 'Hubo un problema al cargar los productos.', 'error');
    }
}

async function actualizarCombos() {
    try {
        const combos = await ipcRenderer.invoke('combo:obtener-todos');

        const combosFiltrados = combos.filter(p => {
            const coincideTexto = filtroTextoCombo
                ? p.nombre.toLowerCase().includes(filtroTextoCombo.toLowerCase())
                : true;
            const coincideFecha = fechaFiltroSeleccionada
                ? p.fecha === fechaFiltroSeleccionada
                : true;
            return coincideTexto && coincideFecha;
        });

        renderListaCombos(combosFiltrados);
    } catch (error) {
        console.error('Error al actualizar combos:', error);
        Swal.fire('Error', 'No se pudieron cargar los combos.', 'error');
    }
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
        const combo = await ipcRenderer.invoke('combo:obtener-por-id', idCombo);
        if (!combo) {
            Swal.fire('Error', 'No se encontró el combo especificado.', 'error');
            return;
        }

        const productos = await ipcRenderer.invoke('producto:obtener-todos');
        let productosFiltrados = [...productos];
        const seleccionados = new Map();

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
                    </div>`;
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

            const detalles = Array.from(seleccionados.entries()).map(([id, s]) => ({
                id_producto: id,
                cantidad: s.cantidad
            }));

            if (detalles.length === 0) {
                Swal.fire('Error', 'Debe seleccionar al menos un producto para el combo.', 'error');
                return;
            }

            try {
                await ipcRenderer.invoke('combo:actualizar', {
                    id: idCombo,
                    nombre,
                    descripcion,
                    precio,
                    precio_delivery: precioDelivery,
                    detalles
                });

                const combosActualizados = await ipcRenderer.invoke('combo:obtener-todos');
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

async function eliminarCombo(id) {
    const confirmacion = await Swal.fire({
        title: '¿Desea eliminar este combo?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'rgb(91 191 175)',
        cancelButtonColor: 'rgb(255 85 85)',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        try {
            await ipcRenderer.invoke('combo:borrar', id);
            await actualizarCombos();
            Swal.fire('Listo!', 'El combo fue borrado.', 'success');
        } catch (error) {
            console.error('Error al borrar combo:', error);
            Swal.fire('Error', 'No se pudo eliminar el combo.', 'error');
        }
    }
}


function actualizarVistaCombos(combos) {
    renderListaCombos(combos);
}

function filtrarPorTextoCombo(event) {
    filtroTextoCombo = event.target.value;
    actualizarCombos();
}

module.exports = {
    abrirModalAgregarCombo,
    actualizarCombos,
    renderListaCombos,
    editarCombo,
    eliminarCombo,
    actualizarVistaCombos,
    filtrarPorTextoCombo
};
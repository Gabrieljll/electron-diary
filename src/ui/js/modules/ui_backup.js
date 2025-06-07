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
        divConfiguraciones. style.display = 'block';
        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none';
        divStock.style.display = 'none';
        divCombos.style.display = 'none';
    }
}

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

async function abrirModalConfigurarDescuentos(){
    let ret=0
    
    const { value: formValues } = await Swal.fire({
        title: 'Configurar Descuentos',
        html: `
            <div style="text-align: left;">
                <div class="form-group">
                    <h1>Realizando ajustes...</h1>
                </div>
                
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                ret: 0
            }
        }
    });

    if (formValues) {
        const success = await main.guardarDescuentos("", "");
        if (success) {
            Swal.fire('Éxito', 'Descuentos actualizados correctamente', 'success');
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

export {
    mostrarVista,
    toggleDetalleVenta,
    abrirModalAgregarProducto,
    abrirModalConfigurarRecargos,
    abrirModalConfigurarDescuentos,
    actualizarConfiguracionRecargos,
    actualizarTipoVenta,
    actualizarPreciosProductos,
    actualizarPreciosSeleccionados,
    actualizarPrecioSeleccionado,
    actualizarResumenVenta
};
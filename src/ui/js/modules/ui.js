async function mostrarVista(vista) {
    const divVentas = document.getElementById('divVentas');
    const divBotonesVentas = document.getElementById('botonesDetalleVentas')
    const divConfiguraciones = document.getElementById('divConfiguraciones')
    const divStock = document.getElementById('divStock');
    const divCombos = document.getElementById('divCombos');
    const ventasButton = document.querySelector('.nav-buttons:nth-child(1)');
    const stockButton = document.querySelector('.nav-buttons:nth-child(2)');
    const combosButton = document.querySelector('.nav-buttons:nth-child(3)');

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
        await ipcRenderer.invoke('producto:actualizar');
        await ipcRenderer.invoke('venta:obtener-por-fecha');
    } else if (vista === 'stock') {
        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none';
        divStock.style.display = 'block';
        divCombos.style.display = 'none';
        divConfiguraciones.style.display = 'none';
        await ipcRenderer.invoke('producto:actualizar');
        ventasButton.classList.remove('active');
        stockButton.classList.add('active');
        combosButton.classList.remove('active');
    } else if (vista === 'combos') {
        divVentas.style.display = 'none';
        divBotonesVentas.style.display = 'none';
        divStock.style.display = 'none';
        divConfiguraciones.style.display = 'none';
        divCombos.style.display = 'block';
        await ipcRenderer.invoke('combo:actualizar');
        ventasButton.classList.remove('active');
        stockButton.classList.remove('active');
        combosButton.classList.add('active');
    } else if (vista === 'configuracion') {
        divConfiguraciones.style.display = 'block';
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
    detalleVenta.style.display = detalleVenta.style.display === 'block' ? 'none' : 'block';
}

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
  
  async function abrirModalConfigurarRecargos() {
    const { credito, debito } = await ipcRenderer.invoke('config:obtener-recargos');
  
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
      const success = await ipcRenderer.invoke('config:guardar-recargos', formValues);
      if (success) {
        Swal.fire('Éxito', 'Recargos actualizados correctamente', 'success');
      } else {
        Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
      }
    }
  }
  
  async function agregarNuevoProducto() {
    const nombre = document.getElementById('nombre').value.trim();
    const precio = parseFloat(document.getElementById('precio').value);
    const precioDelivery = parseFloat(document.getElementById('precioDelivery').value);
    const descripcion = document.getElementById('descripcion').value.trim();
    const cantidad = parseInt(document.getElementById('cantidad').value);
  
    if (!nombre || isNaN(precio) || isNaN(precioDelivery) || isNaN(cantidad)) {
      Swal.fire('Error', 'Por favor, complete todos los campos correctamente.', 'error');
      return;
    }
  
    try {
      await ipcRenderer.invoke('producto:nuevo', {
        nombre,
        precio,
        precio_delivery: precioDelivery,
        descripcion,
        cantidad
      });
  
      Swal.fire('Éxito', 'Producto agregado correctamente', 'success');
      await ipcRenderer.invoke('producto:actualizar');
    } catch (error) {
      console.error('Error al agregar producto:', error);
      Swal.fire('Error', 'No se pudo guardar el producto.', 'error');
    }
  }
  
  function limpiarVistas() {
    document.getElementById('divVentas').style.display = 'none';
    document.getElementById('botonesDetalleVentas').style.display = 'none';
    document.getElementById('divStock').style.display = 'none';
    document.getElementById('divCombos').style.display = 'none';
    document.getElementById('divConfiguraciones').style.display = 'none';
  
    document.querySelectorAll('.nav-buttons').forEach(btn => btn.classList.remove('active'));
  }
  
  async function recargarVistaActual(vista) {
    limpiarVistas();
    await mostrarVista(vista);
  }
  
  async function abrirModalConfigurarDescuentos() {
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
        const success = await ipcRenderer.invoke('config:guardar-descuentos', "", "");
        if (success) {
            Swal.fire('Éxito', 'Descuentos actualizados correctamente', 'success');
        } else {
            Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
        }
    }
}

function actualizarTipoVenta() {
  const tipoVenta = document.getElementById("tipoVenta").value;
  const costoEnvio = document.getElementById("costoEnvio");
  const direccion = document.getElementById("direccion");
  const productos = document.getElementById("productosSeleccionados").children;

  if (tipoVenta === "local") {
      costoEnvio.disabled = true;
      costoEnvio.value = 0;
      direccion.value = "local";
      direccion.disabled = true;
      actualizarPreciosProductos("precio");
  } else if (tipoVenta === "delivery") {
      costoEnvio.value = "";
      costoEnvio.disabled = false;
      direccion.value = "";
      direccion.disabled = false;
      actualizarPreciosProductos("precio_delivery");
  }
}

async function actualizarPreciosProductos(precioTipo) {
  const productosSeleccionados = document.getElementById("productosSeleccionados").children;

  Array.from(productosSeleccionados).forEach(async producto => {
      const productoId = producto.getAttribute("data-id");
      const productoData = await ipcRenderer.invoke('producto:obtener-por-id', productoId);
      const precio = productoData[precioTipo];

      const precioElemento = producto.querySelector(".precioProducto");
      if (precioElemento) {
          precioElemento.textContent = "$" + precio;
      }
  });
}

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

  // Obtener productos seleccionados del DOM
  const productosSeleccionados = Array.from(document.querySelectorAll('.producto-seleccionado')).map(producto => {
      return {
          nombre: producto.getAttribute('data-nombre'),
          precio: parseFloat(producto.getAttribute('data-precio')),
          cantidad: parseInt(producto.querySelector('.cantidadProducto').value),
          id: producto.getAttribute('data-id')
      };
  });

  // Generar el resumen de productos
  productosSeleccionados.forEach((producto, index) => {
      const productoElemento = document.createElement('li');
      productoElemento.classList.add('list-group-item');

      productoElemento.innerHTML = `
          <span>${producto.nombre} - ${producto.cantidad} x $${producto.precio.toFixed(2)}</span>
      `;

      const botonEliminar = document.createElement('button');
      botonEliminar.classList.add('btn', 'btn-light', 'btn-md', 'm-2', 'quitarProducto');
      botonEliminar.innerHTML = 'x';
      botonEliminar.onclick = () => quitarProducto(index);

      productoElemento.appendChild(botonEliminar);
      listaResumen.appendChild(productoElemento);
  });

  // Actualizar el total
  actualizarTotalConEnvio();
}


  module.exports = {
    mostrarVista,
    toggleDetalleVenta,
    abrirModalAgregarProducto,
    abrirModalConfigurarRecargos,
    abrirModalConfigurarDescuentos,
    agregarNuevoProducto,
    limpiarVistas,
    recargarVistaActual,
    actualizarTipoVenta,
    actualizarPreciosProductos,
    actualizarPreciosSeleccionados,
    actualizarPrecioSeleccionado,
    actualizarResumenVenta,
  };
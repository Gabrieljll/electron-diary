const { ipcRenderer } = require('electron');

function validarStock() {
    const inputProducto = document.getElementById('inputProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    
    if (!inputProducto) {
        console.error('No se encontró el elemento inputProducto en el DOM.');
        return;
    }
    if (!inputCantidad) {
        console.error('No se encontró el elemento cantidadProducto en el DOM.');
        return;
    }

    const idProducto = inputProducto.dataset.productId;
    const nombreProducto = inputProducto.value;
    const stockDisponible = parseInt(inputProducto.dataset.stock);
    const cantidadSeleccionada = parseInt(inputCantidad.value);

    if (!idProducto || !nombreProducto) {
        console.error('No se seleccionó un producto válido.');
        return;
    }

    if (cantidadSeleccionada > stockDisponible) {
        Swal.fire(
            'Stock insuficiente',
            `No hay suficiente stock para "${nombreProducto}". Quedan ${stockDisponible} unidades.`,
            'warning'
        );
        inputCantidad.value = stockDisponible;
    }
}

async function obtenerStockActualizado(id, tipo) {
    if (tipo === 'producto') {
        const productoActualizado = await ipcRenderer.invoke('producto:obtener-por-id', id);
        return productoActualizado.cantidad_disponible;
    } else if (tipo === 'combo') {
        const combo = await ipcRenderer.invoke('combo:obtener-por-id', id);
        if (!combo || !combo.detalles) {
            throw new Error('El combo no contiene detalles válidos.');
        }

        return Math.floor(Math.min(
            ...combo.detalles.map(detalle => {
                return detalle.cantidad_disponible / detalle.cantidad;
            })
        ));
    } else {
        throw new Error('Tipo desconocido al intentar obtener el stock.');
    }
}

async function init() {
    await ipcRenderer.invoke('producto:actualizar');
}

module.exports = {
    validarStock,
    obtenerStockActualizado,
    init
};

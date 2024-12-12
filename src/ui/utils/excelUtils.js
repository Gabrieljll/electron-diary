const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');

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
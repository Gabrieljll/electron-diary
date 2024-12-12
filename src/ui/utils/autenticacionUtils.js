const Swal = require('sweetalert2');
// Configuración de la contraseña
export const CONTRASENA = "pombero91124";


// =======================================================
// FUNCIONES DE AUTENTICACIÓN
// =======================================================
export async function solicitarContrasena() {
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

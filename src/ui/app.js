const Swal = require('sweetalert2')
const remote = require("@electron/remote");
const { parseJson } = require("builder-util-runtime");
const main = remote.require('./main')

let contadorFichasPorFecha = 0;

const divFichas = document.getElementById('fichas')
const divFechasFichas = document.getElementById('divFechasFichas')

let arrayFichas = []
let arrayFechasFichas = []
let arrayDiasSemana = ["Domingo","Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
let filtroFecha = false;
let fechaFiltroSeleccionada = ''



function abrirModalAgendar(){
    
    Swal.fire({
        html:`
        <h1 class="tituloModal"> Nuevo Cliente </h1>
        <hr>
        <form action="" id="formulario_producto">
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Día de entrega</strong></h5></label>
                <input type="date" id="fecha" placeholder="Fecha" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Código de cliente</strong></h5></label>
                <input type="text" id="numeroPedido" placeholder="Número de pedido" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Cliente</strong></h5></label>
                <input type="text" id="nombreCliente" placeholder="Nombre de Cliente" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Celular</strong></h5></label>
                <input type="number" id="numeroContacto" placeholder="Número de Contacto" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Producto</strong></h5></label>
                <input type="text" id="producto" placeholder="Nombre del producto a entregar" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Precio del producto</strong></h5></label>
                <input type="number" id="precioProducto" placeholder="Precio del producto" class="form-control" step="0.01" autofocus required="true">
            </div>   
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Dirección de la entrega</strong></h5></label>
                <input type="text" id="direccion" placeholder="Dirección o ubicación" class="form-control" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Observaciones</strong></h5></label>
                <textarea id="observaciones" rows="3" placeholder="observaciones" class="form-control"></textarea>
            </div>
            <button onclick="agendarNuevaFicha()" class="btn btn-success mt-1">
                AGENDAR
            </button>                    
        </form>                                    
                    `
                    ,
                    showCloseButton: true,
                    showCancelButton: false,
                    showConfirmButton: false,
                    focusConfirm: false
                })
            }
            
async function agendarNuevaFicha(){
    const formulario_producto = document.getElementById('formulario_producto')


    const fecha = document.getElementById('fecha')
    const numeroPedido = document.getElementById('numeroPedido')
    const nombreCliente = document.getElementById('nombreCliente')
    const numeroContacto = document.getElementById('numeroContacto')
    const producto = document.getElementById('producto')
    const precioProducto = document.getElementById('precioProducto')
    const direccion = document.getElementById('direccion')
    const observaciones = document.getElementById('observaciones')

    if(validarCamposFormulario(fecha, numeroPedido, nombreCliente, numeroContacto, producto, precioProducto, direccion)){
        const fichaDeCliente = {
            fecha: fecha.value,
            numeroPedido: numeroPedido.value,
            nombreCliente: nombreCliente.value,
            numeroContacto: numeroContacto.value,
            producto: producto.value,
            precioProducto: precioProducto.value,
            direccion: direccion.value,
            observaciones: observaciones.value
        }
        const result = await main.nuevaFichaCliente(fichaDeCliente)
                
        formulario_producto.reset()
        Swal.close()
        await getFichasCliente()
    }
    else{
        return false
    }
        
}

function validarCamposFormulario(fecha, numeroPedido, nombreCliente, numeroContacto, producto, precioProducto, direccion){
    if( fecha.value != '' && numeroPedido.value != '' && nombreCliente.value != '' && numeroContacto.value != '' && producto.value != '' && precioProducto.value != '' &&
    direccion.value != ''){
        return true
    }
    else{
        return false;
    }
}

async function fichaClienteEditada(idFichaEditada){

    const formulario_producto_edit = document.getElementById('formulario_producto_edit')
    const fecha_edit = document.getElementById('fecha_edit')
    const numeroPedido_edit = document.getElementById('numeroPedido_edit')
    const nombreCliente_edit = document.getElementById('nombreCliente_edit')
    const numeroContacto_edit = document.getElementById('numeroContacto_edit')
    const producto_edit = document.getElementById('producto_edit')
    const precioProducto_edit = document.getElementById('precioProducto_edit')
    const direccion_edit = document.getElementById('direccion_edit')
    const observaciones_edit = document.getElementById('observaciones_edit')    

    if(validarCamposFormulario(fecha_edit, numeroPedido_edit, nombreCliente_edit, nombreCliente_edit, numeroContacto_edit, producto_edit, precioProducto_edit, direccion_edit)){
        const fichaDeClienteEditada = {
            fecha: fecha_edit.value,
            numeroPedido: numeroPedido_edit.value,
            nombreCliente: nombreCliente_edit.value,
            numeroContacto: numeroContacto_edit.value,
            producto: producto_edit.value,
            precioProducto: precioProducto_edit.value,
            direccion: direccion_edit.value,
            observaciones: observaciones_edit.value,
        }
        await main.actualizarFichaCliente(idFichaEditada, fichaDeClienteEditada)    
        Swal.close()
        await getFichasCliente()
    }
}


async function setearFiltros(divFechasFichas, fechas){
    for(let i=0; i<fechas.length;i++){
        let diaMes = String(new Date(fechas[i].fecha).getDate()).padStart(2, '0')+ '/' + String(new Date(fechas[i].fecha).getMonth() + 1).padStart(2, '0')
        if(!document.getElementById(diaMes)){
            contadorFichasPorFecha = await cantidadFichasPorFecha(fechas[i].fecha)
            divFechasFichas.innerHTML += `
            <div class="divBotonesFiltro animate__animated animate__fadeInUp">
                <button onclick="filtrarFichas('${diaMes}')" id="${diaMes}" class="botonesFiltro btn btn-info">${arrayDiasSemana[new Date(fechas[i].fecha).getDay()] + ' '+diaMes} <br>(${+contadorFichasPorFecha} PEDIDOS)
                </button>                
            </div>
            `
        }
    }
}

function renderFichasCliente(fichas,fechas) {
    divFechasFichas.innerHTML='';

    setearFiltros(divFechasFichas, fechas)
    

    if (!filtroFecha){
        divFichas.innerHTML = '';
        fichas.forEach(ficha => {                        
            divFichas.innerHTML += `
                <div class="card bg-light my-2 animate__animated animate__fadeInUp">
                    <div class="divBotonCopiarTexto">                    
                        <buttton onclick="copiarTextoCard(${ficha.id})" class="btn btn-secondary botonCopiar">
                        <img class="iconoCopiar" src="./img/copiar-64.png">
                             COPIAR
                        </buttton>
                    </div>                    
                    <div class="divTextoCards">
                        <h5 id="cliente_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*Cliente:*</strong>
                            ${ficha.nombreCliente}
                        </h5>
                        <br>
                        <h5 id="direccion_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Dirección de la entrega:* </strong>
                            ${ficha.direccion}
                        </h5>
                        <br>
                        <h5 id="celular_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Celular:* </strong>
                            ${ficha.numeroContacto}
                        </h5>
                        <br>
                        <h5 id="producto_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Producto:* </strong>
                            ${ficha.producto}
                        </h5>
                        <br>
                        <h5 id="precio_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Precio del producto que va a pagar el cliente:* </strong>
                            $${ficha.precioProducto}
                        </h5>
                        <br>
                        <h5 id="fecha_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong id="${ficha.fecha}">*- Día de entrega:*</strong>
                        ${String(new Date(ficha.fecha).getDate()).padStart(2, '0')+ '/' + String(new Date(ficha.fecha).getMonth() + 1).padStart(2, '0')}
                        </h5>
                        <br>
                        <h5 id="codigo_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Código de cliente:* </strong>
                            ${ficha.numeroPedido}
                        </h5>
                        <br>
                        <h5 id="observaciones_${ficha.id}" class="textoCards textoCards_${ficha.id}"><strong>*- Observaciones:* </strong>
                            ${ficha.observaciones}
                        </h5>
                    </div>                    
                    <br>
                        <div class="divBotonEditar">
                            <button onclick="editarFichaCliente(${ficha.id})" class="btn btn-primary botonEditar">EDITAR</button>
                        </div>
                        <div class="divBotonBorrar">
                            <button onclick="borrarFichaCliente(${ficha.id})" class="btn btn-secondary botonEliminar">BORRAR</button>
                        </div>
                <div>
            `
        })
    } else {
        divFichas.innerHTML = '';
        fichas.forEach(ficha => {
            let diaMes = String(new Date(ficha.fecha).getDate()).padStart(2, '0')+ '/' + String(new Date(ficha.fecha).getMonth() + 1).padStart(2, '0')
            if(diaMes == fechaFiltroSeleccionada){
                divFichas.innerHTML += `
                    <div class="card bg-light my-2 animate__animated animate__fadeInUp">
                        <div class="divBotonCopiarTexto">
                            <buttton onclick="copiarTextoCard(${ficha.id})" class="btn btn-secondary botonCopiar">
                            <img class="iconoCopiar" src="./img/copiar-64.png">
                                COPIAR
                            </buttton>
                        </div>                        
                        <div class="divTextoCards">
                            <h5 id="cliente_${ficha.id}" class="textoCards"><strong>*Cliente:*</strong>${ficha.nombreCliente}</h5>
                            <br>
                            <h5 id="direccion_${ficha.id}" class="textoCards"><strong>*- Dirección de la entrega:* </strong>
                                ${ficha.direccion}
                            </h5>
                            <br>
                            <h5 id="celular_${ficha.id}" class="textoCards"><strong>*- Celular:* </strong>
                                ${ficha.numeroContacto}
                            </h5>
                            <br>
                            <h5 id="producto_${ficha.id}"class="textoCards"><strong>*- Producto:* </strong>
                                ${ficha.producto}
                            </h5>
                            <br>
                            <h5 id="precio_${ficha.id}" class="textoCards"><strong>*- Precio del producto que va a pagar el cliente:* </strong>
                                $${ficha.precioProducto}
                            </h5>
                            <br>
                            <h5 id="fecha_${ficha.id}" class="textoCards"><strong id="${ficha.fecha}">*- Día de entrega:*</strong>
                            ${String(new Date(ficha.fecha).getDate()).padStart(2, '0')+ '/' + String(new Date(ficha.fecha).getMonth() + 1).padStart(2, '0')}
                            </h5>
                            <br>
                            <h5 id="fecha_${ficha.id}" class="textoCards"><strong>*- Código de cliente:* </strong>
                                ${ficha.numeroPedido}
                            </h5>
                            <br>
                            <h5 id="observaciones_${ficha.id}" class="textoCards"><strong>*- Observaciones:* </strong>
                                ${ficha.observaciones}
                            </h5>
                        </div> 
                            <div class="divBotonEditar">
                                <button onclick="editarFichaCliente(${ficha.id})" class="btn btn-primary botonEditar">EDITAR</button>
                            </div>
                            <div class="divBotonBorrar">
                                <button onclick="borrarFichaCliente(${ficha.id})" class="btn btn-secondary botonEliminar">BORRAR</button>
                            </div>
                    <div>
                  `
            }
        })
    }
}


function copiarTextoCard(id){
    let texto = ''    
    let cliente = document.getElementById('cliente_'+id);
    let direccion = document.getElementById('direccion_'+id);
    let celular = document.getElementById('celular_'+id);
    let producto = document.getElementById('producto_'+id);
    let precio = document.getElementById('precio_'+id);
    let fecha = document.getElementById('fecha_'+id);
    let codigo = document.getElementById('codigo_'+id);
    let observaciones = document.getElementById('observaciones_'+id);
    
    texto = cliente.innerText+"\n\n"+direccion.innerText+"\n\n"+celular.innerText+"\n\n"+producto.innerText+"\n\n"+precio.innerText+"\n\n"+fecha.innerText+"\n\n"+codigo.innerText+"\n\n"+observaciones.innerText;
    
    navigator.clipboard.writeText(texto)
        .then(() => {
            Swal.fire({
                position: 'top-end',
                icon: 'success',
                title: 'Copiada!',
                showConfirmButton: false,
                timer: 1300
            })      
        })
        .catch(err => {
        console.log('Something went wrong', err);
        })


}

async function limpiarFiltro(){
    filtroFecha = false
    await getFichasCliente()
}
async function filtrarFichas(fechaDiaMes){
    filtroFecha = true
    fechaFiltroSeleccionada = fechaDiaMes
    await getFichasCliente()
}

async function editarFichaCliente(idFicha){      
    const fichaDevuelta = await main.getFichaById(idFicha)    
    var fichaFechaModal = String(new Date(fichaDevuelta.fecha).getFullYear() + '-' + String(new Date(fichaDevuelta.fecha).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(fichaDevuelta.fecha).getDate()).padStart(2, '0'))
    
    Swal.fire({
        html:`
        <h1 class="tituloModal">Editar Ficha</h1>
        <hr>
        <div id="modal_${fichaDevuelta.id}" class="modalEditar" class="col-md-12 p-4 my-auto">
        <div action="" id="formulario_producto_edit">        
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Día de entrega</strong></h5></label>
                <input type="date" id="fecha_edit" placeholder="Fecha" class="form-control" value="${fichaFechaModal}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Código de cliente</strong></h5></label>
                <input type="text" id="numeroPedido_edit" placeholder="Número de pedido" class="form-control" value="${fichaDevuelta.numeroPedido}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Cliente</strong></h5></label>
                <input type="text" id="nombreCliente_edit" placeholder="Nombre de Cliente" class="form-control" value="${fichaDevuelta.nombreCliente}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Celular</strong></h5></label>
                <input type="number" id="numeroContacto_edit" placeholder="Número de Contacto" class="form-control" value="${fichaDevuelta.numeroContacto}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Producto</strong></h5></label>
                <input type="text" id="producto_edit" placeholder="Nombre del producto a entregar" class="form-control" value="${fichaDevuelta.producto}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Precio del producto</strong></h5></label>
                <input type="number" id="precioProducto_edit" placeholder="Precio del producto" class="form-control" step="0.01" value="${fichaDevuelta.precioProducto}" autofocus required="true">
            </div>   
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Dirección de la entrega</strong></h5></label>
                <input type="text" id="direccion_edit" placeholder="Dirección o ubicación" class="form-control" value="${fichaDevuelta.direccion}" autofocus required="true">
            </div>
            <div class="form-group">
                <label class="mt-2" for=""><h5><strong>Observaciones</strong></h5></label>
                <textarea id="observaciones_edit" rows="3" placeholder="observaciones" class="form-control" value="${fichaDevuelta.observaciones}"></textarea>
            </div>
            <button onclick="fichaClienteEditada(${fichaDevuelta.id})" class="btn btn-success mt-1">
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

async function borrarFichaCliente(id){
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
          await main.borrarFichaCliente(id)
          await getFichasCliente()
        }
      })        
    return
}

const getFichasCliente = async () =>{
    arrayFichas = await main.getFichasCliente()
    arrayFechasFichas = await getDiasFichas()    
    await renderFichasCliente(arrayFichas,arrayFechasFichas)
}

async function getDiasFichas(){
    return await main.getDiasFichas()
    
}

async function cantidadFichasPorFecha(fecha){
    let fechaLimpia=String(new Date(fecha).getFullYear() + '-' + String(new Date(fecha).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(fecha).getDate()).padStart(2, '0'))    
    let result = await main.getFichasPorFecha(fechaLimpia)
    return result
}

async function init(){
    await getFichasCliente()    
}

init()
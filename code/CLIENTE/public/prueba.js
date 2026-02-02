let fileList = document.querySelector('.file-list ul');
let fileListComp = document.querySelector('.file-list-compartidos ul');
let fileListDes = document.querySelector('.file-list-des ul');
let lista = document.querySelector('.file-details');
let listaDes = document.querySelector('.file-details-des');
let newFile = false;
let newFileTitle = "";
let newFile1 = false;
let newFileTitle1 = "";
let modoInseguro = false;
let contraseña = document.querySelector("#password");
let usuarioGlobal="";



document.addEventListener('DOMContentLoaded', () => {
    fileList = document.querySelector('.file-list ul');
    fileListDes = document.querySelector('.file-list-des ul');
    lista = document.querySelector('.file-details');
    listaDes = document.querySelector('.file-details-des');

    
    let url = window.location.href;

    // Comprueba si la URL contiene 'login' o 'register'
    if (!url.includes('login') && !url.includes('register') && url != 'https://localhost:3000/') {
        cargarInfo();
        obtenerArchivos();
        listar_usuarios();
    }
});

//Lista los archivos subidos por el usuario y los que le han compartido
function obtenerArchivos() {
    if(usuarioGlobal !== "" && usuarioGlobal !== null){
        console.log("Sesion Iniciada con: ", usuarioGlobal);

        fetch(`https://localhost:3000/listar_archivos/${usuarioGlobal}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {
            fileList.innerHTML = '';
            data.archivos.forEach(archivo => {
                const contenedorArchivo = document.createElement('div'); // Contenedor para el elemento li y el botón eliminar
                contenedorArchivo.classList.add('contenedor-archivo');
                const nombreArchivo = document.createElement('li');
                const botonEliminar = document.createElement('button');
        
                if(!archivo.endsWith('.zip.enc')){
                    return;
                }

                if(newFile == true && newFileTitle == archivo){
                    const textoRojo = document.createElement('span');

                    const indiceGuionBajo = archivo.indexOf('_');
                    const substring = archivo.substring(indiceGuionBajo + 1);

                    textoRojo.textContent = substring;
                    nombreArchivo.appendChild(textoRojo);

                    const textoNew = document.createElement('span');
                    textoNew.style.color = 'red';
                    textoNew.style.fontSize = '10px';
                    textoNew.style.fontStyle = 'italic';
                    textoNew.style.fontWeight = 'bold';
                    textoNew.textContent = ' ¡NUEVO!';

                    nombreArchivo.appendChild(textoNew);
                } else {
                    const indiceGuionBajo = archivo.indexOf('_');
                    const substring = archivo.substring(indiceGuionBajo + 1);
                    nombreArchivo.textContent = substring;
                    botonEliminar.textContent = "Eliminar";
                    botonEliminar.classList.add('eliminar-archivo');
                    contenedorArchivo.appendChild(nombreArchivo);
                    contenedorArchivo.appendChild(botonEliminar);
                }
                nombreArchivo.addEventListener("click", ()=> {
                    descomprimirDesencriptar(archivo);
                });
                botonEliminar.addEventListener("click", ()=> {
                    eliminar_archivo(usuarioGlobal, botonEliminar.parentNode.firstChild.textContent);
                });
                fileList.appendChild(contenedorArchivo);
            });

            newFile = false;

            fileListComp.innerHTML = '';
            data.archivosCompartidos.forEach(archivo => {
            
                const contenedor = document.createElement('div');
                contenedor.textContent = archivo.usuario + ': ';
                contenedor.classList.add(archivo.usuario);

                const contenedorArchivo = document.createElement('div'); // Contenedor para el elemento li
                contenedorArchivo.style.marginLeft = '20px';
                const nombreArchivo = document.createElement('li');

                if(newFile1 == true && newFileTitle1 == archivo.archivo){
                    const textoRojo = document.createElement('span');

                    const nombreArchivoConUsuarioGlobal = archivo.archivo.replace(usuarioGlobal, '');
                    const nombreArchivoSinUsuario = nombreArchivoConUsuarioGlobal.replace(archivo.usuario, '');
                    const nombreArchivoSinUsuarioBarra = nombreArchivoSinUsuario.replace(/_+[^A-Za-z]/, '');

                    const indicePunto = nombreArchivoSinUsuarioBarra.indexOf('.');
                    const substring = nombreArchivoSinUsuarioBarra.substring(0, indicePunto);
                    nombreArchivo.textContent = substring + '.zip.enc';

                    textoRojo.textContent = substring + '.zip.enc';
                    nombreArchivo.appendChild(textoRojo);

                    const textoNew = document.createElement('span');
                    textoNew.style.color = 'red';
                    textoNew.style.fontSize = '10px';
                    textoNew.style.fontStyle = 'italic';
                    textoNew.style.fontWeight = 'bold';
                    textoNew.textContent = ' ¡NUEVO!';

                    nombreArchivo.appendChild(textoNew);
                } else {
                    const nombreArchivoConUsuarioGlobal = archivo.archivo.replace(usuarioGlobal, '');

                    const nombreArchivoSinUsuario = nombreArchivoConUsuarioGlobal.replace(archivo.usuario, '');
                    const nombreArchivoSinUsuarioBarra = nombreArchivoSinUsuario.replace(/_+[^A-Za-z]/, '');

                    const indicePunto = nombreArchivoSinUsuarioBarra.indexOf('.');
                    const substring = nombreArchivoSinUsuarioBarra.substring(0, indicePunto);
                    nombreArchivo.textContent = substring + '.zip.enc';
                }
                nombreArchivo.addEventListener("click", ()=> {
                    descomprimirDesencriptarCompartido(archivo.archivo)
                });
                contenedorArchivo.appendChild(nombreArchivo);
                contenedor.append(contenedorArchivo);

                fileListComp.appendChild(contenedor);


            });

            newFile1 = false;
        })
        .catch(error => {
            console.error('Error al obtener la lista de archivos:', error.message);
        
            // Verificar si el mensaje de error indica que el token ha expirado
            if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
                logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
            }
        });
    }
}



//Sube un archivo
function guardarArchivo(usuariosActualizar, titulo) {

    let tituloInput = "";
    let descripcionInput = "";
    let autorInput = "";
    let archivoInput = "";
    let fileupload = "";

    if(usuariosActualizar == null){
        tituloInput = document.getElementById('titulo');
        descripcionInput = document.getElementById('descripcion');
        autorInput = document.getElementById('autor');
        archivoInput = document.getElementById('archivo');
        console.log(archivoInput);
        fileupload = archivoInput.files;
        newFileTitle = tituloInput.value + '.zip';
    
    }
    else{
        tituloInput = titulo;
        console.log(tituloInput);
        descripcionInput = document.getElementsByClassName('des-descripcion');
        console.log(descripcionInput);
        autorInput = document.getElementsByClassName('des-autor');
        console.log(autorInput);
        archivoInput = document.getElementsByClassName('des-archivo');
        fileupload = archivoInput.files;  //creo que es aqui lo que se le esta pasando que debería ser el archivo en si a lo mejor
        console.log(fileupload); //undefinded
        newFileTitle = tituloInput + '.zip';
    }
    
    if(usuariosActualizar == null){
        if(!tituloInput.value || !descripcionInput.value || !autorInput.value || fileupload.length == 0){
            Swal.fire({
                icon: "error",
                title: "400 Bad Request",
                text: "Rellena todos los campos",
            });
            return;
        }
    }
    else{
        if(!tituloInput || !descripcionInput || fileupload.length == 0){
            Swal.fire({
                icon: "error",
                title: "400 Bad Request",
                text: "Rellena todos los campos",
            });
            return;
        }
    }

    if (tituloInput.value.includes(" ")) {
        Swal.fire({
            icon: "error",
            title: "400 Bad Request",
            text: "Eltítulo no puede contener espacios",
        });
        return;
    }
    
    if (!/^[a-zA-Z0-9_]*$/.test(tituloInput.value)) {
        Swal.fire({
            icon: "error",
            title: "400 Bad Request",
            text: "El título solo puede contener letras, números y guiones bajos (_)",
        });
        return;
    }
    
    let formData;
    if(usuariosActualizar == null){
        formData = new FormData();
        for (let i = 0; i < fileupload.length; i++) {
            formData.append("fileupload", fileupload[i]);
        }

        formData.append("titulo", tituloInput.value);
        formData.append("descripcion", descripcionInput.value);
        formData.append("autor", autorInput.value);
        formData.append("modoInseguro", modoInseguro);
    }
    else{
        formData = new FormData();
        for (let i = 0; i < fileupload.length; i++) {
            formData.append("fileupload", fileupload[i]);
        }

        formData.append("titulo", tituloInput);
        formData.append("descripcion", descripcionInput.getAttribute('id'));
        formData.append("autor", autorInput.getAttribute('id'));
        formData.append("modoInseguro", modoInseguro);
    }
   

    // Obtener la lista de usuarios seleccionados
    if(usuariosActualizar == null){
        console.log('subiendo nuevo');
        let listaUsuariosCheckboxes = document.querySelectorAll('.checklist input[type="checkbox"]:checked');
        let listaUsuariosSeleccionados = [];
        listaUsuariosCheckboxes.forEach(checkbox => {
            listaUsuariosSeleccionados.push(checkbox.value);
        });
        formData.append("usuariosSeleccionados", JSON.stringify(listaUsuariosSeleccionados));
    }
    else{
        console.log('actualizando');
        formData.append("usuariosSeleccionados", JSON.stringify(usuariosActualizar));
    }
    
    let loadingScreen = document.getElementById('loading');
      
    loadingScreen.style.opacity = 1;
    loadingScreen.style.zIndex = 1;

    const url = `https://localhost:3000/subir_archivo/${usuarioGlobal}`;

    const request = {
        method: 'POST',
        body: formData
    };
    

    fetch(url, request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {

            Swal.fire({
                title: "200 OK",
                text: `${data.message}`,
                icon: "success"
            });
            obtenerArchivos();
            archivoInput.value = tituloInput.value = descripcionInput.value = autorInput.value = '';
            lista.classList.toggle('invisible');
            newFile = true;
        })
        .catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            // Aquí puedes mostrar un mensaje de error al usuario o manejar la situación de otra manera
            if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
                logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
            }
            else{
                Swal.fire({
                    title: 'Error', 
                    text: error.message,
                    icon: "error"
                });
            }
        })
        .finally(() => {
            // Ocultar el spinner
            loadingScreen.style.opacity = 0;
            loadingScreen.style.zIndex = -1;
        });
}

//Desplegar al darle a crear archivo
function desplegar(){
    lista.classList.toggle('invisible');
    listar_usuarios();
}

function toggleModoInseguro(){

    if(modoInseguro==true){
        modoInseguro = false;
    }
    else{
        modoInseguro = true;
    }
    document.querySelector('body').classList.toggle('inseguro');
}

function descomprimirDesencriptar(nombreArchivo) {

    const url = '/desencriptar_descomprimir';

    const request = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archivo : nombreArchivo})
    };

    fetch(url, request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {
            Swal.fire({
                title: `${data.titulo} has been Decompressed!`, 
                //text: data.descripcion,
                //autor: data.autor,
                icon: "success"});
            obtenerDesencriptados(data, true);
        })
        .catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            Swal.fire({
                title: 'Unable to decompress...', 
                text: '...',
                icon: "error"
            });
            if (error.message && error.message.includes('token') && !error.message.includes('Unexpected')) {
                logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
            }
        });
}

function descomprimirDesencriptarCompartido(nombreArchivo) {

    const url = '/desencriptar_descomprimir_compartido';

    const request = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archivo : nombreArchivo})
    };

    fetch(url, request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {
            Swal.fire({
                title: `${data.titulo} has been Decompressed!`, 
                //text: data.descripcion,
                //autor: data.autor,
                icon: "success"});
            obtenerDesencriptados(data, false);
        })
        .catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            Swal.fire({
                title: 'Unable to decompress...', 
                text: '...',
                icon: "error"
            });
            if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
                logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
            }
        });
}

//Obtener la información del archivo desencriptado
async function obtenerDesencriptados(data, flag) {
        
    var titulo;
    var descripcion;
    var autor;
    var fecha;

    var contenedorTitulo = document.querySelector('.file-list-des h2');
    const contenedor = document.querySelector('.file-list-des ul');

    contenedor.innerHTML ='';
    contenedorTitulo.innerHTML ='';

    var tituloVar = data.titulo;

    titulo = document.createElement('h2');
    titulo.textContent = "Archivo desencriptado: " + data.titulo;
    let tituloParaFuncion = data.titulo;
    
    autor = document.createElement('div');
    autor.textContent = "Autor: " + data.autor;
    autor.classList.add('des-autor');
    autor.setAttribute('id', data.autor);

    descripcion = document.createElement ('div');
    descripcion.textContent = "Descripcion: " + data.descripcion;
    descripcion.classList.add('des-descripcion');
    autor.setAttribute('id', data.descripcion);

    fecha = document.createElement('div');
    fecha.textContent = "Fecha: " + data.fecha;

    contenedorTitulo.append(titulo);
    contenedor.append(autor);
    contenedor.append(descripcion);
    contenedor.append(fecha);

    var listaArchivos = document.createElement('ul');
    let rutaDescomprimidos = data.ruta;
    fetch(`/listar_contenido_descomprimido/${rutaDescomprimidos}`)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
        listaArchivos.innerHTML = '';
        data.forEach(archivo => {
            const li = document.createElement('li');

            if(archivo == 'info.json'){
                return;
            }

            var nombre = document.createElement('span');
            nombre.textContent = archivo;
            nombre.classList.add('des-archivo');
            nombre.setAttribute('type', 'file');
            li.appendChild(nombre);

            listaArchivos.appendChild(li);

            // Agregar evento de clic al nombre del archivo
            nombre.addEventListener('click', function() {
                // Redirigir a la URL del archivo
                const file = `./assets/decompressed/${rutaDescomprimidos}/temp/${archivo}`;
                const url = `/descargar?file=${encodeURIComponent(file)}?malicioso=${false}`;
                const request = {
                    method: 'GET'
                }
                fetch(url, request).then(data=>data.blob()).then(blob=> {
                    const blobUrl = window.URL.createObjectURL(blob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = blobUrl;
                    downloadLink.download = archivo.split('/').pop(); // Extrae el nombre del archivo de la ruta
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    window.URL.revokeObjectURL(blobUrl); // Limpia la URL del objeto
                });
            });
        });

        contenedor.append(listaArchivos);
        if(flag){
            obtenerUsuarios(contenedor, tituloParaFuncion);
        }
    })
    .catch(error => console.error('Error al obtener la lista de archivos:', error));
    
}


//Muestra los usuarios en las dos cajas que hay con la información de cada archivo al desencriptar
function obtenerUsuarios(contenedor, titulo){

    var usuarios;

    var contenedorUsuarioss = document.querySelector('.contenedor-usuarios');
    if (contenedorUsuarioss) {
        contenedorUsuarioss.innerHTML = '';
        usuarios = contenedorUsuarioss;
    } else {
        usuarios = document.createElement('div');
        usuarios.classList.add('contenedor-usuarios');
    }

    var compartido = document.createElement('h4');
    compartido.textContent = "Compartido con: ";
    usuarios.appendChild(compartido);
    const contenedorUsuarios = document.createElement('ul');
    contenedorUsuarios.classList.add('lista-usuarios-compartido');
    let listaUsuarioConArchivo = [];
    listaUsuariosArchivoCompartido(titulo).then(listaUsuarios => {
        console.log('lista usuarios: ' + listaUsuarios);
        listaUsuarioConArchivo = listaUsuarios;
        // Iterar sobre la lista de usuarios para crear elementos para cada uno
        listaUsuarios.forEach(usuario => {
            // Crear un div para el usuario
            const usuarioDiv = document.createElement('li');
        
            // Crear un elemento para el nombre del usuario
            const nombreUsuario = document.createElement('div');
            nombreUsuario.textContent = usuario;
            nombreUsuario.classList.add('nombre-usuario');
            
            // Crear un botón para quitar permisos
            
            const quitarPermisosBtn = document.createElement('button');
            quitarPermisosBtn.textContent = 'Quitar permisos';
            quitarPermisosBtn.classList.add('quitar-permisos-btn');
            
            // Agregar evento al botón para quitar permisos
            quitarPermisosBtn.addEventListener('click', () => {
                // Aquí puedes agregar la lógica para quitar los permisos del usuario
                // Puedes llamar a una función para manejar esto
                console.log(`Quitar permisos para ${usuario}`);
                eliminar_permisos(usuarioGlobal, usuario, titulo, listaUsuarios);
            });
            
                
            // Agregar el nombre del usuario y el botón al div del usuario
            usuarioDiv.appendChild(nombreUsuario);
            usuarioDiv.appendChild(quitarPermisosBtn);
            

            // Agregar el div del usuario al contenedor de usuarios
            contenedorUsuarios.appendChild(usuarioDiv);
        });
        
       
    })
    .catch(error => {
        console.error('Error al obtener la lista de usuarios:', error);
        if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
            logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
        }
    });

    // Agregar el contenedor de usuarios al contenedor principal
    usuarios.appendChild(contenedorUsuarios);
    
    
    var sincompartido = document.createElement('h4');
    sincompartido.textContent = "Usuarios no compartido: ";
    usuarios.append(sincompartido);
    const contenedorUsuariosSin = document.createElement('ul');
    contenedorUsuariosSin.classList.add('lista-usuarios-sin-compartido');

    listaUsuariosSinCompartido(titulo).then(listaUsuarios => {
        
        // Iterar sobre la lista de usuarios para crear elementos para cada uno
        listaUsuarios.forEach(usuario => {
            // Crear un div para el usuario
            const usuarioDiv = document.createElement('li');
        
            // Crear un elemento para el nombre del usuario
            const nombreUsuario = document.createElement('div');
            nombreUsuario.textContent = usuario;
            nombreUsuario.classList.add('nombre-usuario');
            
            // Crear un botón para quitar permisos
            
            const addPermisosBtn = document.createElement('button');
            addPermisosBtn.textContent = 'Añadir permisos';
            addPermisosBtn.classList.add('añadir-permisos-btn');
            
            // Agregar evento al botón para quitar permisos
            addPermisosBtn.addEventListener('click', () => {
                // Aquí puedes agregar la lógica para quitar los permisos del usuario
                // Puedes llamar a una función para manejar esto
                console.log(`Añadir permisos para ${usuario}`);                
                add_permisos(usuarioGlobal, usuario, titulo, listaUsuarioConArchivo);
            });
            
            // Agregar el nombre del usuario y el botón al div del usuario
            usuarioDiv.appendChild(nombreUsuario);           
            usuarioDiv.appendChild(addPermisosBtn);
            
        
            contenedorUsuariosSin.appendChild(usuarioDiv);
        }); 
    })
    .catch(error => {
        console.error('Error al obtener la lista de usuarios:', error);
        if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
            logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
        }
    });

    usuarios.appendChild(contenedorUsuariosSin);
    contenedor.append(usuarios);
}


function descargarArchivo(archivo){
    url = `/descargar/${archivo}`;
    request = {
        method: 'GET'
    }
    fetch(url, request).then(data=>data.blob()).then(blob=> {
            const blobUrl = window.URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = archivo.split('/').pop(); // Extrae el nombre del archivo de la ruta
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(blobUrl); // Limpia la URL del objeto
    });           
}



////////////////////////// USUARIO ////////////////////////////////////////

//Para autogenerar y rellenar los campos al darle autogenarar al registrase
if (window.location.href == 'https://localhost:3000/register.html') {
    document.getElementById('autogenerateButton').addEventListener('click', function(){
        var password = autogenerar();
        document.getElementById('password').value = password;
        document.getElementById('confirmPassword').value = password;
    });
}


//Para autogenerar la contraseña
function autogenerar() {
    var length = 15;
    var lowercaseCharset = "abcdefghijklmnopqrstuvwxyz";
    var uppercaseCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var numericCharset = "0123456789";
    var specialCharset = "!@#$%^&*()_+\\-=[]{};':\"\\|,.<>/?";

    var password = "";
    password += lowercaseCharset.charAt(Math.floor(Math.random() * lowercaseCharset.length));
    password += uppercaseCharset.charAt(Math.floor(Math.random() * uppercaseCharset.length));
    password += numericCharset.charAt(Math.floor(Math.random() * numericCharset.length));

    for (var i = 0; i < length - 3; i++) {
        var charset = lowercaseCharset + uppercaseCharset + numericCharset + specialCharset;
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    // Mezclar la contraseña
    password = password.split('').sort(function(){return 0.5-Math.random()}).join('');
    console.log(password);
    return password;
}

function formatoCorreo(correo) {
    let indiceArroba = correo.indexOf('@'); // Encuentra la posición del '@'
    if (indiceArroba === -1) return correo; // Retorna el correo tal cual si no hay '@'

    let primeraParte = correo.slice(0, indiceArroba);
    let segundaParte = correo.slice(indiceArroba); // Desde '@' hasta el final

    if (primeraParte.length > 4) {
        // Corta los primeros 4 caracteres y los muestra, y el resto se convierte en '*'
        primeraParte = primeraParte.slice(0, 4) + '*'.repeat(primeraParte.length - 4);
    }

    return primeraParte + segundaParte;
}

//Login
function login(){
    let usuario = document.querySelector("#username").value;
    let contraseña = document.querySelector("#password").value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, contraseña })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            })
        }
        return response.json();
    })
    .then(data => {
        let correo = formatoCorreo(data.mail);
        //Pantalla de 2fa codigo
        let pantallaCodigo = document.getElementById('pantalla-codigo2fa');
        let textoVerificacion = document.getElementById('textoVerficacion');
        pantallaCodigo.style.display = 'flex'; //display: none;
        textoVerificacion.innerHTML = `Introduzca el código de verificación enviado al correo ${correo}`;


    }).catch(error => {
        console.error('Error en la solicitud al servidor:', error.message);
        Swal.fire({
            title: `Error`, 
            text: error.message,
            icon: "error"
        });
        if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
            logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
        }
    });
    
    
}

function verificarCodigo2FA(){
    let usuario = document.querySelector("#username").value;

    let codigo1 = document.getElementById('codigo1').value;
    let codigo2 = document.getElementById('codigo2').value;
    let codigo3 = document.getElementById('codigo3').value;
    let codigo4 = document.getElementById('codigo4').value;

    let codigo = codigo1 + codigo2 + codigo3 + codigo4;

    fetch('/codigo_verificacion2FA', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codigo, usuario })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            })
        }
        return response.json();
    })
    .then(data => {
        Swal.fire({
            title: `Success`, 
            text: data.message,
            icon: "success",
    
        }).then((result) => {
            if (result.isConfirmed) {
                console.log(usuario);
                usuarioGlobal = usuario;
 
                usuario = "";
                contraseña = ""; 
                // cambio de login.html a index.html COMPROBAR QUE FUNCIONA
                window.location.href = '/index.html?usuario=' + encodeURIComponent(usuarioGlobal);
            }
        });

    }).catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        Swal.fire({
            title: `Error`, 
            text: error,
            icon: "error"
        });
        if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
            logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
        }
    });
}

//Carga el nombre se usuario que tiene la sesión activa
function cargarInfo(){
    const urlParams = new URLSearchParams(window.location.search);
    usuarioGlobal = urlParams.get('usuario');
    document.querySelector('.nombre').textContent = usuarioGlobal;
}

//Muestra el mensaje conforme se vaya escribiendo la contraseña
function mostrarMensaje(mensaje) {

    let mensajeElemento = document.querySelector(".mensaje");

    mensajeElemento.innerHTML = '';
    
    if(mensaje.length>0){
        var mensajeTexto = document.createElement("span");
        mensajeTexto.textContent = mensaje;
        mensajeTexto.classList.add("mensaje-texto");

        if(mensaje =="La contraseña es lo suficientemente segura y larga."){
            mensajeTexto.classList.add("seguro");
        }
        
        mensajeElemento.appendChild(mensajeTexto);
        mensajeElemento.style.display = 'block';
    }
}

if (window.location.href == 'https://localhost:3000/register.html') {
    contraseña.addEventListener('input', function() {

        if (contraseña.value == "") {
            mostrarMensaje("");
        }
        else if (contraseña.value.length < 8 && contraseña.value.length > 0) {
            mostrarMensaje("La contraseña debe tener al menos 8 caracteres.");
        } else if (contraseña.value.length > 8 && contraseña.value.length > 0){
            var contieneMayuscula = /[A-Z]/.test(contraseña.value);
            var contieneMinuscula = /[a-z]/.test(contraseña.value);
            var contieneNumero = /[0-9]/.test(contraseña.value);
            var contieneCaracterEspecial = /[^A-Za-z0-9]/.test(contraseña.value);

            if (contieneMayuscula && contieneMinuscula && contieneNumero && contieneCaracterEspecial) {
                mostrarMensaje("La contraseña es lo suficientemente segura y larga.");
            } else {
                if(contieneMayuscula && contieneMinuscula && contieneNumero){
                    mostrarMensaje("La contraseña necesita al menos un carácter especial");
                }
                else if(contieneMayuscula && contieneMinuscula && contieneCaracterEspecial){
                    mostrarMensaje("La contraseña necesita al menos un número");
                }
                else if(contieneMinuscula && contieneNumero && contieneCaracterEspecial){
                    mostrarMensaje("La contraseña necesita al menos una letra mayúscula");
                }
                else if(contieneMayuscula && contieneNumero && contieneCaracterEspecial){
                    mostrarMensaje("La contraseña necesita al menos una letra minúscula");
                }
                else{
                    mostrarMensaje("La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial.");
                }
            }
        }
    });
}

//Register
function register(){

    let mensajeElemento = document.querySelector(".mensaje");
    mensajeElemento.style.display = 'none';

    var usuario = document.querySelector("#username").value;
    let contraseña = document.querySelector("#password").value;
    let contraseñaRepe = document.querySelector("#confirmPassword").value;
    let mail = document.querySelector("#mail").value;

    if (!/^[a-zA-Z0-9_]*$/.test(usuario)) {
        Swal.fire({
            icon: "error",
            title: "400 Bad Request",
            text: "El nombre de usuario solo puede contener letras, números y guiones bajos (_)",
        });
    } else {
        let loadingScreen = document.getElementById('loading');
      
        loadingScreen.style.opacity = 1;
        loadingScreen.style.zIndex = 1;
        loadingScreen.style.width = '60%';
        loadingScreen.style.height = '400px';

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, contraseña, contraseñaRepe,mail })
        })
        .then(response => {
            
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                })
            }
            return response.json();
        })
        .then(data => {
            
            Swal.fire({
                title: `Success`, 
                text: data.message,
                icon: "success"
            })
            .then((result) => {
                if (result.isConfirmed) {
                    usuarioGlobal = usuario;
                    usuario = "";
                    contraseña = ""; 
                    contraseñaRepe = ""; 
            
                    // Cambiar a index.html después de cerrar el cuadro de diálogo
                    window.location.href = '/index.html?usuario=' + encodeURIComponent(usuarioGlobal);
                }
            });
            
            // Listar Archivos del usuario
            obtenerArchivos();
        })
        .catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            Swal.fire({
                title: 'Unable to register...', 
                text: error,
                icon: "error"
            });
            if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
                logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
            }
        })
        .finally(() => {
            // Ocultar el spinner
            loadingScreen.style.opacity = 0;
            loadingScreen.style.zIndex = -1;
            loadingScreen.style.width = '20%';
            loadingScreen.style.height = '350px';
        });
    }
}

//Log out
function logOut(mensaje = ""){

    if (mensaje != ""){
        window.alert(mensaje);
    }
    fetch('/logout', {
        method: 'GET',
        credentials: 'same-origin' 
    }).then(response => {
        if (response.redirected) {
            window.location.href = response.url; 
        }
    }).catch(error => {
        console.error('Error al cerrar sesión:', error);
        if (error.message && error.message.includes('token')  && !error.message.includes('Unexpected')) {
            logOut('Error con el token'); // Llama a la función de logout si el token ha expirado
        }
    });
}

//Lista los usuarios con los que puedes compartir a la hora de subir un nuevo archivo
function listar_usuarios() {
    var listaUsuarios = document.querySelector('.file-list-usuarios ul.checklist');

    fetch(`/listar_usuarios/${usuarioGlobal}`)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
        listaUsuarios.innerHTML = ''; // Limpiamos la lista antes de agregar nuevos elementos
        data.usuarios.forEach(usuario => {
            if(usuario[0]!==usuarioGlobal){
                const li = document.createElement('li');
                const input = document.createElement('input');
                input.setAttribute('type', 'checkbox');
                input.setAttribute('id', usuario[0]);
                input.setAttribute('value', usuario[0]);
                const label = document.createElement('label');
                label.setAttribute('for', usuario[0]);
                label.textContent = usuario[0];
                li.appendChild(input);
                li.appendChild(label);
                listaUsuarios.appendChild(li);
            }
        });
    })
    .catch(error => console.error('Error al obtener la lista de usuarios:', error));
}

//Obtiene la lista de usuarios que tienen el archivo x compartido
function listaUsuariosArchivoCompartido(archivo) {
    return new Promise((resolve, reject) => {
        url = `https://localhost:3000/lista_compartidos/${usuarioGlobal}/${archivo}`;
        request = {
            method: 'GET'
        }
        fetch(url, request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {
            resolve(data.usuarios);
            return data.usuarios;
        })
        .catch(error => reject(error));
    });
}

//Obtiene la lista de usuarios que no tienen el archivo x compartido
function listaUsuariosSinCompartido(archivo) {

    return new Promise((resolve, reject) => {
        url = `https://localhost:3000/lista_sin_compartidos/${usuarioGlobal}/${archivo}`;
        request = {
            method: 'GET'
        }
        fetch(url, request)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        })
        .then(data => {
            resolve(data.usuarios);
            return data.usuarios;
        })
        .catch(error => reject(error));
    });
    
}

//Elimina los permisos de acceso a un archivo
function eliminar_permisos(propietario, compartido, archivo_compartido, lista_compartir) {

    lista_compartir = lista_compartir.filter(usuario => usuario != compartido);

    //CUando se resuba solo sera necesario llamar a resubir
    let url = `/cambiar_compartidos/${usuarioGlobal}/${archivo_compartido}`;
    let request = {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/json'  // Asegúrate de incluir este encabezado
        },
        body: JSON.stringify({'lista_compartidos': lista_compartir})
    }
    fetch(url, (request))
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {

        Swal.fire({
            title: `Success`, 
            text: data.message,
            icon: "success"
        })
        .then((result) => {
            // reload the current page
            window.location.reload();
        });

        /*
        listaUsuariosArchivoCompartido(archivo_compartido).then(usuarios => {
            guardarArchivo(usuarios, archivo_compartido);
        });*/

        console.log(usuarioGlobal + ' ha dejado de compartir '+ archivo_compartido + ' con ' + compartido );
    })
    .catch(error => {
        if(error.message){
            Swal.fire({
                title: `Error Inesperado`, 
                text: error.message,
                icon: "error"
            })
            .then((result) => {
                // reload the current page
                window.location.reload();
            });
        }
        else{
            Swal.fire({
                title: `Error Inesperado`, 
                text: error,
                icon: "error"
            })
            .then((result) => {
                // reload the current page
                window.location.reload();
            });
        }
    });
}

//Añade permisos de acceso a un archivo
function add_permisos(propietario, compartido, archivo_compartido, lista_compartir) {
    let trigger = false;
    lista_compartir.forEach(usuario_compartido =>{
        if(usuario_compartido == compartido){
            trigger = true;
        }
    })
    if(!trigger){
        lista_compartir.push(compartido);
    }

    //CUando se resuba solo sera necesario llamar a resubir
    let url = `/cambiar_compartidos/${usuarioGlobal}/${archivo_compartido}`;
    let request = {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/json'  // Asegúrate de incluir este encabezado
        },
        body: JSON.stringify({'lista_compartidos': lista_compartir})
    }
    fetch(url, request)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {

        Swal.fire({
            title: `Success`, 
            text: data.message,
            icon: "success"
        })
        .then((result) => {
            // reload the current page
            window.location.reload();
        });

        /*
        listaUsuariosArchivoCompartido(archivo_compartido).then(usuarios => {
            usuarios.push(compartido);
            guardarArchivo(usuarios, archivo_compartido);
        });*/

        console.log(usuarioGlobal + ' ha comenzado a compartir '+ archivo_compartido + ' con ' + compartido );
    })
    .catch(error => {
        if(error.message){
            Swal.fire({
                title: `Error Inesperado`, 
                text: error.message,
                icon: "error"
            })
            .then((result) => {
                // reload the current page
                window.location.reload();
            });
        }
        else{
            Swal.fire({
                title: `Error Inesperado`, 
                text: error,
                icon: "error"
            })
            .then((result) => {
                // reload the current page
                window.location.reload();
            });
        }
    });
}

//Elimina un archivo y los que tiene asociado
function eliminar_archivo(propietario, archivo_compartido) {

    Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará el archivo permanentemente. ¿Deseas continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            
            fetch(`/eliminar_archivo/${usuarioGlobal}/${archivo_compartido}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error);
                    });
                }
                return response.json();
            })
            .then(data => {
                // Mostrar mensaje de éxito
                Swal.fire({
                    title: 'Éxito',
                    text: data.message,
                    icon: 'success'
                });
                console.log(usuarioGlobal + ' ha eliminado el ' + archivo_compartido + ' correctamente ');
                obtenerArchivos();
            })
            .catch(error => console.error('Error al quitar permisos:', error));
        }
    });
}
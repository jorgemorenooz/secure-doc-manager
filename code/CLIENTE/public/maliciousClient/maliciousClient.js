//LA GESTIÓN DEL CLIENTE MALICIOSO AHORA HA CAMBIADO. LAS PETICIONES QUE SE REALICEN SE PROPAGARÁN DESDE EL SERVIDOR CLIENTE HASTA EL SERVIDOR ALMACENAMIENTO Y VICEVERSA. 
// EL CLIENTE MALICIOSO AHORA DEBERÁ APROVECHAR UNA PUERTA TRASERA/VULNERABILIDAD ABIERTA DESDE EL SERVIDOR CLIENTE PARA PODER SALTARSE LAS MEDIDAS DE SEGURIDAD CON TOKENS/CLAVES.

document.addEventListener('DOMContentLoaded', () => {    
    window.Swal = swal;
    let boton = document.querySelector(".button-interfaz");
    boton.addEventListener("click", ()=>{
        limpiarInterfaz();
        archivosUsuario();
    });

    let usuarioTexto = document.querySelector(".user-input");

    // Execute a function when the user presses a key on the keyboard
    usuarioTexto.addEventListener("keypress", function(event) {
        // If the user presses the "Enter" key on the keyboard
        if (event.key === "Enter") {
            limpiarInterfaz();
            archivosUsuario();
        }
    });
});

function limpiarInterfaz(){
    let Zips = document.querySelector("#listaZips"); 
    let listaZips = Zips.querySelector("ul").childNodes;
    listaZips.forEach(zip=>zip.remove());
    Zips.style.display = "none";
   
    limpiarArchivosAsociados();
}

function limpiarArchivosAsociados(){

    let documentosDelZip = document.querySelector("#documentosDelZip");
    let titulo = documentosDelZip.querySelector("h2");
    titulo.textContent = "Documentos asociados al ZIP ";
    let listaDocumentos = documentosDelZip.querySelector("ul").childNodes;
    listaDocumentos.forEach(doc=>doc.remove());
    documentosDelZip.style.display = "none";

    let infoDiv = documentosDelZip.querySelector(".info-comprimido");
    let infoDivChildren = infoDiv.childNodes;
    infoDivChildren.forEach(child=>{child.remove()});
}

//Mostrará los documentos asociados al usuario deseado. 
function archivosUsuario(){  

    //LIMPIAMOS LA LISTA DE ARCHIVOS EN EL CASO DE QUE SE HAYAN LISTADO PREVIAMENTE LOS ARCHIVOS DE OTRO USUARIO: 
    let visorDocumentos = document.querySelector("#listaZips");
    if(visorDocumentos){
        visorDocumentos.style.display = "block";
    }
    var listaDocumentos = visorDocumentos.querySelector("ul");
    if(listaDocumentos.children.length>0){
        listaDocumentos.textContent = ""; //de esta manera limpiamos todo lo que pudiera tener. 
    }

    const usuario = document.querySelector(".user-input").value;
    const url = `/listar_archivos_inseguro/${usuario}`;
    const request = {method: 'GET'};

    fetch(url, request)
    .then(data=>data.json())
    .then(documentos=>{
            if(documentos.archivos){  
                for(var i = 0; i<documentos.archivos.length; i++){
                    if(documentos.archivos[i].includes('.json')){
                        documentos.archivos[i] = documentos.archivos[i].replace('.json', '');
                        documentos.archivos[i] = documentos.archivos[i].replace(`${usuario}_`, '');
                    }
                    let documentoLi = document.createElement("li");
                    documentoLi.textContent = documentos.archivos[i];
                    documentoLi.addEventListener("click", ()=>{ limpiarArchivosAsociados(); desencriptar_y_listar_Zip(documentoLi.textContent, usuario); console.log(documentoLi.textContent);});
                    listaDocumentos.appendChild(documentoLi);
                }
            }
            else{
                limpiarInterfaz(); 
                Swal.fire({
                    title: `${documentos.status} ERROR`,
                    text: documentos.error,
                    icon: "error"
                });
                
            }
        });
}
 //UTIL, DESENCRIPTA Y LISTA LOS ARCHIVOS ASOCIADOS AL ZIP. LOS ARCHIVOS DESENCRIPTADOS DEL ZIP SE ALMACENAN EN MALICIOUSFOLDER. 
function desencriptar_y_listar_Zip(archivo){
    limpiarArchivosAsociados();
    url = `/desencriptar_y_listar_Zip_inseguro/${archivo}`;
    request = {
        method: 'GET'
    }  
    fetch(url, request).then(response => response.json())
        .then(data=>{
            if(!data.error){

                let infoDiv = document.querySelector(".info-comprimido");
                autor = document.createElement('div');
                autor.textContent = "Autor: " + data.autor;

                descripcion = document.createElement ('div');
                descripcion.textContent = "Descripcion: " + data.descripcion;

                fecha = document.createElement('div');
                fecha.textContent = "Fecha: " + data.fecha;

                infoDiv.append(autor);
                infoDiv.append(descripcion);
                infoDiv.append(fecha);

                console.log("archivos: " + data.listaArchivos);
                let divDocumentos = document.querySelector("#documentosDelZip");
                divDocumentos.style.display="block";
                divDocumentos.appendChild(infoDiv);


                let titulo = divDocumentos.querySelector("h2");
                titulo.textContent = titulo.textContent + archivo;
                
                let listaDocumentos = divDocumentos.querySelector("ul");
                for(var i = 0; i<data.listaArchivos.length; i++){
                    let documentoLi = document.createElement("li");
                    documentoLi.textContent = data.listaArchivos[i];
                    documentoLi.addEventListener("click", ()=>{descargarArchivo(documentoLi.textContent);});
                    listaDocumentos.appendChild(documentoLi);
                }
            }else{
                Swal.fire({
                    title: "400 ERROR",
                    text: data.error,
                    icon: "error"
                })
            } 
            
        });
}

function descargarArchivo(nombreArchivo){
    url = `/descargar_archivos_inseguro/${nombreArchivo}`;
    request = {
        method: 'GET'
    }  

    fetch(url, request).then(data=>data.blob()).then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = nombreArchivo;
        downloadLink.click();
        // No es necesario eliminar el enlace, ya que se eliminará automáticamente cuando la función termine
        // Pero si deseas hacerlo explícitamente, puedes hacerlo después de un pequeño retraso
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 100);
    })
    .catch(error => {
        console.error('Error al descargar el archivo:', error);
    });
}
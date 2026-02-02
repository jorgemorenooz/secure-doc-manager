const express = require('express');
const fs = require('fs');
const path = require('path');
const compressing = require('compressing');
const multer  = require('multer');
const AdmZip = require('adm-zip');
const bodyParser = require('body-parser');
const { execSync } = require('child_process');
const crypto = require('crypto');
const https = require("https");
const sha3 = require("js-sha3");
const nodemailer = require('nodemailer');

let usuariosclaves = [{"miranda":"miranda123"}, {"jorge":"jorge123"}]; //valor mockup

const PORT = 3000;
let usuario = "";
let clave_usuario = "";
let clave_datos = "";
let token_usuario = "";
let codigoVerificacion;
let KprivUsuario;
let contraseñas = ['123456', 'admin', '12345678', '123456789', '1234', '12345', 'password', '123', 'Aa123456', '1234567890'];
var privateKey = fs.readFileSync('./certificados/clave_privada_servidor.pem').toString();
var certificate = fs.readFileSync('./certificados/certificado_servidor.crt').toString();
var credentials = {key: privateKey, cert: certificate};
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'estatregiasdeseguridad.os@gmail.com',
        pass: 'bqqi wxlu vbgc mdiz'
    }
});

const upload = multer({ dest: './assets/files/' });
const app = express();
app.use((req, res, next) => {
    if (req.path === '/') {
        next(); // Salta express.static si la ruta es la raíz
    } else {
        express.static(path.join(__dirname, 'public'))(req, res, next);
    }
});
app.use(bodyParser.json());
//Ruta de almacenamiento de los ficheros a desencriptar. 
const storageMalicious = multer.diskStorage({
    destination: function(req, file, cb) {
        //directorio para almacenar los archivos
        const destinationPath = path.join(__dirname, '/maliciousFolder');

        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath);
        }
        else{
            vaciarCarpeta(destinationPath);
        }

        cb(null, destinationPath);
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});
const uploadMalicious = multer({ storage: storageMalicious });
var httpsServer = https.createServer(credentials, app);

function signMessage(message, privateKey) {
    const signer = crypto.createSign('sha256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    return signature;
}

function writeLogWithTimestamp(ip, message) {
    const date = new Date();
    const fechaFormateada = `${date.toDateString()} ${date.toTimeString().split(' ')[0]}`;
    const fullMessage = `${fechaFormateada} - ${ip}: ${message}`;

    if(usuario == ""){
        writeLogs(ip, fullMessage, "");
    }
    else{
        const signature = signMessage(fullMessage, KprivUsuario); // Firma el mensaje
        writeLogs(ip, fullMessage, signature);
    }
}

function writeLogs(ip, message, signature) {
    const logsDirectory = './assets/logs';
    const logsFilePath = path.join(logsDirectory, 'logs.txt');

    // Asegurar que el directorio y el archivo de logs existan
    if (!fs.existsSync(logsDirectory)) {
        fs.mkdirSync(logsDirectory);
    }
    if (!fs.existsSync(logsFilePath)) {
        fs.writeFileSync(logsFilePath, '', 'utf8');
    }

    // Agregar el mensaje y la firma al archivo de logs
    const logEntry = `${message} - Signature: ${signature}\n`;
    fs.appendFileSync(logsFilePath, logEntry, 'utf8');
}


async function enviarCorreo(correoDestino) {

    try{
        const result = await transporter.sendMail({
            from: 'estatregiasdeseguridad.os@gmail.com',
            to: `${correoDestino}`, //${data.correo}
            subject: 'Código de verificación',
            text: 'Tu código de verificación es: ' + codigoVerificacion
        });

        console.log(JSON.stringify(result, null, 4));
    }
    catch  (error){
        console.log(JSON.stringify(error, null, 4));
    }
}

// UTIL, GENERA UNA CONTRASEÑA INSEGURA -> IGUAL
function randomInsecurePassword(){
    const n = Math.floor(Math.random() * contraseñas.length);

    return contraseñas[n].padEnd(32," ");
}

// UTIL, GENERA UNA CONTRASEÑA SEGURA PARA ENCRIPTAR EL ZIP -> IGUAL
function randomHash(nChar) {
    let nBytes = Math.ceil(nChar = (+nChar || 8) / 2);
    let u = crypto.randomBytes(nBytes);
    let zpad = str => '00'.slice(str.length) + str;
    let a = Array.prototype.map.call(u, x => zpad(x.toString(16)));
    let str = a.join('').toUpperCase();
    if (nChar % 2) str = str.slice(1);
    return str;
}

function obtenerClavePublica(nombreUsuario) {
    for (let i = 0; i < usuariosclaves.length; i++) {
        if (usuariosclaves[i][0] === nombreUsuario) {
            return usuariosclaves[i][1];
        }
    }
    return null; // Si no se encuentra el usuario, devolver null
}

async function obtenerClavePrivada(usuario) {
    const url = `https://localhost:4000/obtenerClavePrivada/${usuario}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await fetch(url, request);
        if (response.ok) {
            const data = await response.json();
            console.log("Esta es la clave privada cifrada: " + data.clavePrivadaCifrada);
            
            // Desciframos la clave privada usando AES-256-CBC
            const decipher = crypto.createDecipheriv('aes-256-cbc', clave_datos, crypto.randomBytes(16));
            let privateKeyDescifrada = decipher.update(data.clavePrivadaCifrada, 'hex', 'utf8');
            privateKeyDescifrada += decipher.final('utf8');
            let lineas = privateKeyDescifrada.split('\n');
            lineas[0] = "-----BEGIN PRIVATE KEY-----";
            privateKeyDescifrada = lineas.join('\n');

            console.log("Clave privada descifrada: " + privateKeyDescifrada);
            return privateKeyDescifrada;
        } else {
            console.log("Error al obtener clave privada:", response.statusText);
            return null;
        }
    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        return null;
    }
}



// UTIL, ENCRIPTA EL ARCHIVO -> IGUAL
function encrypt(archivo, modo, usuario){
    var clave = '';
    let jsonFilePath;
    let jsonContent;

    //console.log("Es inseguro?: " + modo);
    if(modo=='true'){
        console.log("Es inseguro");
        clave = randomInsecurePassword();
        jsonFilePath = path.join(archivo + '.json');
    }
    else if(modo == 'usuario'){
        clave = obtenerClavePublica(usuario);
        archivo = archivo+".json";  //así apuntamos al archivo encriptador -> json
        let archivo2 = archivo;
        archivo = archivo.replace("files/", "files/" + usuario + "_");
        fs.copyFile(archivo2, archivo, (err) => {
            if (err) {
              console.error('Error al copiar el archivo:', err);
              return;
            }
            console.log('Archivo copiado exitosamente.');
          });
        jsonFilePath = archivo+'.json';
    }
    else if(modo == 'agregar_permisos'){
        clave = obtenerClavePublica(usuario);
        jsonFilePath = archivo;
    }
    else if(modo == 'clave_datos'){
        clave = clave_datos;
        jsonFilePath = path.join(archivo + '.json');
    }
    else{
        console.log("Es seguro");
        clave = randomHash(32);
        jsonFilePath = path.join(archivo + '.json');
    }

    jsonContent = JSON.stringify({ key: clave, iv: 0 });    
    
    fs.writeFileSync(jsonFilePath, jsonContent);

    try {
        let result = "";
        if(modo != 'usuario' && modo != 'agregar_permisos'){
         result = execSync(`python3 ./public/scripts/zip-compresser.py "${archivo}" "${jsonFilePath}" -e`);
        }
        else{
         result = execSync(`python3 ./public/scripts/zip-compresser-rsa.py "${archivo}" "${jsonFilePath}" -e`); //para cifrar el zip.json por cada uno de los usuarios a compartir. 
        }
        console.log(`Script de Python ejecutado correctamente: ${result}`);

    } catch (error) {
        console.error(`Error al ejecutar el script de Python: ${error.message}`);
    }

    if(modo != 'clave_datos' && modo != 'usuario'){
        encrypt(jsonFilePath, 'clave_datos');
    }

}

async function decrypt(archivoEncriptado, modo, usuario, rutaClave=""){
    var jsonFilePath = path.join(archivoEncriptado + '.json');
    let jsonContent;
    if(modo == 'clave'){
        jsonContent = JSON.stringify({ key: clave_datos, iv: 0 }); 
        fs.writeFileSync(jsonFilePath, jsonContent);
    }
    else if(modo=='clave_compartido'){
        jsonFilePath = rutaClave;
    }
    else if(modo == 'usuario'){ 
        let clavePrivada = await obtenerClavePrivada(usuario);
        jsonContent = JSON.stringify({ key: clavePrivada, iv: 0 });
        console.log("Se escribe en " + jsonFilePath+ " : " + jsonContent);
        fs.writeFileSync(jsonFilePath, jsonContent);
    }
    else{
        jsonFilePath = archivoEncriptado.replace('.zip.enc', '.json');
    }
    
    try {
        let result;
        if(modo != 'usuario'){
            result = execSync(`python3 ./public/scripts/zip-compresser.py ${archivoEncriptado} ${jsonFilePath} -d`);
        }
        else{
            console.log(archivoEncriptado);
            let result = execSync(`python3 ./public/scripts/zip-compresser-rsa.py ${archivoEncriptado} ${jsonFilePath} -d`);
            let resultString = result.toString('utf8');
            console.log(resultString);
            return resultString;

        }
        console.log(`Script de Python ejecutado correctamente: ${result}`);
    } catch (error) {
        console.error(`Error al ejecutar el script de Python: ${error.message}`);
    }
    
    if(modo == 'clave'){
        const index = archivoEncriptado.indexOf('.zip') + 4;
        const archivoGenerado = archivoEncriptado.substring(0, index); //el.zip
        const archivoClave = archivoGenerado.replace('.zip', '.json');
        fs.renameSync(archivoGenerado, archivoClave);

        decrypt(archivoGenerado + '.enc', 'normal', usuario)
    }
}

var deleteFolderRecursive = function(path) {
    if( fs.existsSync(path) ) {
        vaciarCarpeta(path);
        fs.rmdirSync(path);
    }
};

function vaciarCarpeta(path) {

    try{
        if( fs.existsSync(path) ) {
            fs.readdirSync(path).forEach(function(file,index){
                var curPath = path + "/" + file;
                if(fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
        }
    }
    catch(error){
        console.error(error);
    }
}

function subirArchivo(path, fileStream, options) { 
    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let responseData = '';
            response.on('data', (chunk) => responseData += chunk);
            response.on('end', () => {
                console.log(`Respuesta: ${responseData}`); //Cambiar si "token"

                let responseJSON = JSON.parse(responseData);
                if(responseJSON.error){
                    reject(responseJSON.error);
                }
                else{
                    resolve(responseData);
                }
            });
        });

        request.setTimeout(10000, () => {  // 10000 ms = 10 segundos
            request.abort();
            reject(new Error('Request timeout'));
        });

        request.on('error', (err) => {
            console.error('Error en la solicitud HTTP:', err);
            reject(err);
        });

        fileStream.pipe(request);
        fileStream.on('end', () => {
            request.end();
        });
    });
}

function validarContraseña(contraseña) {
    if (contraseña.length < 8 && contraseña.length > 0) {
        return "La contraseña debe tener 8 carácteres";
    } else if (contraseña.length >= 8) {
        const contieneMayuscula = /[A-Z]/.test(contraseña);
        const contieneMinuscula = /[a-z]/.test(contraseña);
        const contieneNumero = /[0-9]/.test(contraseña);
        const contieneCaracterEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(contraseña);
        
        if(contieneMayuscula && contieneMinuscula && contieneCaracterEspecial && !contieneNumero){
            return "La contraseña necesita al menos un número";
        }
        else if(contieneMinuscula && contieneNumero && contieneCaracterEspecial && !contieneMayuscula){
            return "La contraseña necesita al menos una letra mayúscula";
        }
        else if(contieneMayuscula && contieneNumero && contieneCaracterEspecial && !contieneMinuscula){
            return "La contraseña necesita al menos una letra minúscula";
        }
        else if(contieneMayuscula && contieneMinuscula && contieneNumero && !contieneCaracterEspecial){
            return "La contraseña necesita al menos un carácter especial";
        }
        else if(!contieneMayuscula || !contieneMinuscula || !contieneCaracterEspecial || !contieneNumero){
            return "La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial";
        }
        else{
            return 1;
        }
    }
}

function listarArchivosEnDirectorio(rutaDirectorio, callback) {
    fs.readdir(rutaDirectorio, (error, archivos) => {
        if (error) {
            console.error('Error al leer el directorio:', error);
            callback(error, null);
            return;
        }
        console.log('Archivos en el directorio:');
        callback(null, archivos);
    });
}

function limpiarDirectorio(directorio) {
    const rutaDirectorio = path.resolve(directorio);
    try {
        const archivos = fs.readdirSync(rutaDirectorio);

        archivos.forEach((archivo) => {
            const rutaCompleta = path.join(rutaDirectorio, archivo);
            const stat = fs.statSync(rutaCompleta);

            if (stat.isDirectory()) {
                limpiarDirectorio(rutaCompleta);
                fs.rmdirSync(rutaCompleta);
            } else {
                fs.unlinkSync(rutaCompleta);
            }
        });
    } catch (error) {
        console.error('Error al limpiar el directorio:', error);
        throw error; 
    }
}

function maliciousDecrypt(rutaArchivoEncriptado){ 

    let resultado = false;
    for (let i = 0; i < contraseñas.length; i++) {
        try {
            console.log("Intentando desencriptar con la contraseña: " + contraseñas[i]);
            // Ejecuta el script de Python y captura la salida
            const decryptedFilePath = rutaArchivoEncriptado.replace('.zip.enc', `_${i}.zip`);
  
            var jsonFilePath = path.join(rutaArchivoEncriptado + '.json');
            var jsonContent = JSON.stringify({ key: contraseñas[i].padEnd(32," "), iv: 0});
            fs.writeFileSync(jsonFilePath, jsonContent);
  
            try {
                const result = execSync(`python3 public/scripts/malicious.py ${rutaArchivoEncriptado} ${jsonFilePath} ${decryptedFilePath}`);
                console.log(`Script de Python ejecutado correctamente: ${result}`);
            } catch (error) {
                console.error(`Error al ejecutar el script de Python: ${error.message}`);
            }
            
            // Intenta abrir el archivo zip descifrado
            if (fs.existsSync(decryptedFilePath)) {
                try{
                    let zip = new AdmZip(decryptedFilePath); 
                    zip.extractAllTo("./maliciousFolder", true); // Extrae el contenido
                    console.log("Archivo descomprimido exitosamente.");
                    i = contraseñas.length;
                    resultado = true;
                }
                catch(error){
                    console.log("No se ha podido descomprimir el archivo", error);
                } 
                
                fs.rmSync(decryptedFilePath); //borra el comprimido 
                fs.rmSync(jsonFilePath) //Borra el json
            }
        } catch (error) {
            console.error("Error durante el proceso de descifrado o descompresión: " + error.message);
        }
    }
    return resultado;
}

function cifrarTextoPlano(textoPlano, clave) {
    const iv = crypto.randomBytes(16); // Generar IV
    const cipher = crypto.createCipheriv('aes-256-cbc', clave, iv);
    let cifrado = cipher.update(textoPlano, 'utf8', 'hex');
    cifrado += cipher.final('hex');
    const datosCifrados = iv.toString('hex') + cifrado; // Concatenar IV al cifrado
    return datosCifrados;
}


function descifrarTextoPlano(datosCifrados, clave) {
    const iv = Buffer.from(datosCifrados.substring(0, 32), 'hex'); // Extraer IV (los primeros 16 bytes, 32 caracteres hex)
    const textoCifrado = datosCifrados.substring(32); // El resto es el texto cifrado
    const decipher = crypto.createDecipheriv('aes-256-cbc', clave, iv);
    let descifrado = decipher.update(textoCifrado, 'hex', 'utf8');
    descifrado += decipher.final('utf8');
    return descifrado;
}

httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${PORT}, https://localhost:${PORT}`);
    writeLogWithTimestamp('localhost:' + PORT, `Servidor escuchando en el puerto ${PORT}`);
});

// Ruta raíz para servir login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario}`);
    // MODIFICADO
    // Petición al servidor POST '/login' con params: 'user', 'clave_usuario'
    // Devuelve: token

    if (!req.body.usuario || !req.body.contraseña) {
        writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} fallida, faltan campos`);
        return res.status(400).json({ error: 'Debes completar todos los campos' });
    }

    // Dividir contraseña en clave_usuario y clave_datos
    let contraseñaCompleta = sha3.sha3_512(req.body.contraseña);
    console.log(contraseñaCompleta);
  
    // Obtener la longitud del hash
    const hashLength = contraseñaCompleta.length;

    // Dividir el hash en dos partes equivalentes
    const halfLength = Math.floor(hashLength / 2);
    clave_usuario = contraseñaCompleta.substring(0, halfLength);
    clave_datos = contraseñaCompleta.substring(halfLength).substring(0,32);//encriptar el archivo de claves

    const url = 'https://localhost:4000/login';
    const requestBody = {
        usuario: req.body.usuario, // Asegúrate de que 'usuario' es el nombre correcto del campo en req.body
        clave_usuario: clave_usuario,
    };

    const request = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    };

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Enviando datos al SA`);

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

        //2FA
        codigoVerificacion = crypto.randomInt(1000, 9999);
        let mail = descifrarTextoPlano(data.mailCifrado, clave_datos);
        try{
            enviarCorreo(mail);
            writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Mail Enviado para 2FA`);
        }
        catch (error) {
            writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Error(${error})`);
           return res.status(500).json({ error: error });
        }

        token_usuario = data.token;
        usuario = req.body.usuario;
        KprivUsuario = descifrarTextoPlano(data.KprivUsuario, clave_datos);
        return res.status(200).json({ message: 'Inicio de sesión exitoso', mail:mail });
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error.message);
        writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Error(${error})`);

        return res.status(404).json({ "error": error.message });
    });
});

app.post('/codigo_verificacion2FA', (req, res) => {
    const codigo = req.body.codigo;

    if (codigoVerificacion != codigo){
        writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Codigo 2FA Incorrecto`);

        return res.status(404).json({ error: 'Codigo Incorrecto' });
    }

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de inicio de sesión para: ${req.body.usuario} - Inicio de Sesion exitoso`);
    return res.status(200).json({ message: 'Inicio de Sesion exitoso' });
});

app.post('/register', (req, res) => {

    // MODIFICAR LLAMADA SERVIDOR
    // Petición al servidor POST '/register' con params: 'user', 'clave_usuario'
    // Devuelve: 200

    console.log(`Solicitud de registro para ${req.body.usuario}`);
    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de registro para: ${req.body.usuario}`);

    if (!req.body.usuario || !req.body.contraseña || !req.body.contraseñaRepe) {
        return res.status(400).json({ error: 'Debes rellenar todos los campos' });  
    }

    var mensaje = validarContraseña(req.body.contraseña);
    
    if(mensaje!==1){
        return res.status(400).json({ error: mensaje });  
    }

    if (req.body.contraseña !== req.body.contraseñaRepe){
        return res.status(400).json({ error: 'Las contraseñas deben ser iguales' });  
    }

    // Dividir contraseña en clave_usuario y clave_datos
    let contraseñaCompleta = sha3.sha3_512(req.body.contraseña);

    // Obtener la longitud del hash
    const hashLength = contraseñaCompleta.length;

    // Dividir el hash en dos partes equivalentes
    const halfLength = Math.floor(hashLength / 2);
    clave_usuario = contraseñaCompleta.substring(0, halfLength);//guardar en la db
    clave_datos = contraseñaCompleta.substring(halfLength).substring(0,32);//encriptar el archivo de claves

    //Guardar la clave publica en claro en SERVIDOR_ALMACENAMIENTO 
    //Cifrar la clave privada con K_datos y guardarla en S_A
    let privateKeyCifrada, publicKey;
    const { generateKeyPair } = require('crypto');
    generateKeyPair('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
    }, (err, clavePublicaRSA, privateKey) => {
        if(!err) 
        {
            publicKey = clavePublicaRSA;
            privateKeyCifrada = cifrarTextoPlano(privateKey, clave_datos);

            writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de registro para: ${req.body.usuario} - Clave privada cifrada`);

            compartido = [];
            let mail = req.body.mail;
            let mailCifrado = cifrarTextoPlano(mail, clave_datos);
            
            const url = 'https://localhost:4000/register';
            const requestBody = {
                usuario: req.body.usuario, // Asegúrate de que 'usuario' es el nombre correcto del campo en req.body
                clave_usuario: clave_usuario,
                privateKeyCifrada: privateKeyCifrada,
                publicKey: publicKey,
                compartido: compartido,
                mailCifrado: mailCifrado
            };
        
            const request = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            };
            console.log(`Enviando datos al SA`);
            writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de registro para: ${req.body.usuario} - Enviando datos al SA`);

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
                console.log(data.message);
                token_usuario = data.token;
                usuario = req.body.usuario;
                KprivUsuario = descifrarTextoPlano(data.KprivUsuario, clave_datos);

                writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de registro para: ${usuario} - Usuario registrado correctamente`);
                res.status(200).json({ message: 'Usuario registrado correctamente'});
            })
            .catch(error => {
                console.error('Error en la solicitud al servidor:', error);
                res.status(404).json({ error: 'Nombre de usuario existente' });
            });
        } 
        else
        { 
          // Prints error 
          console.log("Error al crear las claves RSA: ", err);
          writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud de registro para: ${usuario} - Error al crear las claves RSA(${err})`);

          return res.status(404).json({ error: err });
        } 
    });

});

// UTIL, LISTA ARCHIVOS DESDE SERVIDOR -> ACTUALIZADO
app.get('/listar_archivos/:usuario', (req, res) => {

    // USO DEL METODO
    // ESPERA LOS PARAMETROS EN EL PATH: usuario
    //   LLAMA A GET '/listar_archivos/:usuario' con HEADER Authorization : `Bearer ${token}`
    //   ESPERA EN RESPUESTA: archivos -> Lista de strings con nombres de los archivos
    // DEVUELVE: archivos -> Lista de strings con nombres de los archivos

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de los archivos de: ${req.params.usuario}`);

    const url = `https://localhost:4000/listar_archivos/${req.params.usuario}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de los archivos de: ${req.params.usuario} - Solicitud enviada al SA`);

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
        // El metodo devuelve una lista con los nombres de los archivos
        writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de los archivos de: ${req.params.usuario} - Lista de archivos obtenida correctamente`);

        return res.status(200).json({archivos: data.archivos, archivosCompartidos: data.archivosCompartidos});
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de los archivos de: ${req.params.usuario} - Error al obtener la lista de archivos(${error})`);

        return res.status(400).json({ error: error.message });
    });
});

// UTIL, METODO QUE LISTA LOS ARCHIVOS DENTRO DEL DESCOMPROMIDO -> IGUAL
app.get('/listar_contenido_descomprimido/:directorio', (req, res) => {

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para listar el contenido de un archivo descomprimido`);

    const directorio = './assets/decompressed/' + req.params.directorio + '/temp';
    console.log(directorio);
    fs.readdir(directorio, (error, archivos) => {
        if (error) {
            console.error('Error al leer el directorio:', error);
            res.status(500).json({error:'Error al obtener el contenido de un archivo descomprimido'});

            writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el contenido de un archivo descomprimido`);
            return;
        }

        writeLogWithTimestamp(req.socket.remoteAddress, `Lista de archivos descomprimidos enviada`);
        
        console.log(archivos);
        res.json(archivos);
    });
});

// UTIL, METODO QUE LEE LOS METADATOS DEL ARCHIVO DESCOMPRIMIDO -> NO SE USA ???
app.get('/leerJSONDescomprimido', function (req, res) {
    const file = req.query.file;

    fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo:', err);
            res.status(500).json({error:'Error al leer el archivo'});
            return;
        }
        
        // Envía el contenido del archivo como respuesta al cliente
        res.status(200).json(data);
    });
});

// UTIL, SUBE ARCHIVO A SERVIDOR -> FALTA ENCRIPTAR CLAVE DE DATOS !!!
app.post('/subir_archivo/:usuario', upload.array('fileupload'), async (req, res) => {

    // USO DEL METODO
    // ESPERA LOS PARAMETROS EN EL BODY: usuario, titulo, descripcion, autor, modoInseguro, fileupload (array de archivos)
    //   LLAMA A POST '/post_archivos/' con HEADER Authorization : `Bearer ${token}` | BODY: usuario, archivo, clave
    //   ESPERA EN RESPUESTA: 200
    // DEVUELVE: 200

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para comprimir archivos`);

    // `req.files` contendrá la lista de archivos subidos
    const titulo = req.body.titulo;
    const descripcion = req.body.descripcion;
    const autor = req.body.autor;
    //const usuarios_compartir = req.body.usuarios;
    let usuarios_compartir = JSON.parse(req.body.usuariosSeleccionados);

    const modo = req.body.modoInseguro;
    
    // Crear el directorio temporal si no existe
    const filesDirectory = `./temp/`;
    if (!fs.existsSync(filesDirectory)) {
        fs.mkdirSync(filesDirectory);
    }

    // Guardamos los archivos en /temp para comprimirlos
    req.files.forEach(file => {
        const filePath = path.join(filesDirectory, file.originalname);
        fs.renameSync(file.path, filePath);
    });

    const date = new Date();

    //Generamos el json con los metadatos
    const info = {
        titulo: titulo,
        descripcion: descripcion,
        autor : autor,
        fecha : `${date.toDateString()} ${date.toTimeString().split(' ')[0]}`
    };
    const infoFilePath = path.join(filesDirectory, 'info.json');
    fs.writeFileSync(infoFilePath, JSON.stringify(info), 'utf8');

    // Comprime el directorio con todos los archivos
    const destinationZip = `./assets/files/${titulo}.zip`;
    const jsonFilePath = `./assets/files/${titulo}.zip.json`;
    compressing.zip.compressDir(filesDirectory, destinationZip)
        .then(async () => {
            writeLogWithTimestamp(req.socket.remoteAddress, `Archivos comprimidos correctamente en ${destinationZip}.`);

            // Encriptar el archivo comprimido
            encrypt(destinationZip, modo, "");
            
            deleteFolderRecursive(filesDirectory);

            fs.rmSync(destinationZip);

            // enviar archivos al backend
            const options = {
                hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                path: `/subir_archivos/${usuario}/${titulo}.zip.enc/true`, // Cambia esto por el endpoint en el servidor de destino
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token_usuario}`,
                },
            };
            const stream = fs.createReadStream(`./assets/files/${titulo}.zip.enc`);

            const options2 = {
                hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                path: `/subir_archivos/${usuario}/${titulo}.zip.json.enc/true`, // Cambia esto por el endpoint en el servidor de destino
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token_usuario}`,
                },
            };
            const stream2 = fs.createReadStream(`./assets/files/${titulo}.zip.json.enc`);

            //subirArchivosConAsyncAwait(req, res, options, options2, stream, stream2);

            //

            try {
                // Subir el primer archivo
                await subirArchivo(options.path, stream, options);
        
                // Añadir aquí la encriptación para cada archivo comprimido
                // Llamada a la función compartirCon(usuarios)
        
                // Subir el segundo archivo
                await subirArchivo(options2.path, stream2, options2);
        
                // Bucle para compartir archivos con usuarios
                for (let i = 0; i < usuarios_compartir.length; i++) {
                    encrypt(destinationZip, "usuario", usuarios_compartir[i]);
        
                    const options_compartir = {
                        hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                        port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                        path: `/compartir_archivos/${usuario}/${usuarios_compartir[i]}/${usuario}_${usuarios_compartir[i]}_${titulo}.zip.json.enc`, // Cambia esto por el endpoint en el servidor de destino
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token_usuario}`,
                        },
                    };
        
                    const stream = fs.createReadStream(`./assets/files/${usuarios_compartir[i]}_${titulo}.zip.json.enc`);
        
                    const upload_c = subirArchivo(options_compartir.path, stream, options_compartir);
        
                    await upload_c; // Esperar a que se complete la subida del archivo
                }
        
                writeLogWithTimestamp(req.socket.remoteAddress, 'Ambos archivos se han subido correctamente');
                vaciarCarpeta('./assets/files');
                
                res.status(200).json({ message: 'Archivos encriptados correctamente.' });
            } catch (error) {
                if (error.includes('segundo archivo')) {
                    console.error(error);
                    res.status(500).json({ error: error });
                } else {
                    console.error(error);
                    res.status(500).json({ error: error });
                }
            }
  
        })
        .catch(error => {
            console.error('Error al comprimir los archivos', error);
            deleteFolderRecursive(filesDirectory);
            console.log(destinationZip);
            writeLogWithTimestamp(req.socket.remoteAddress, `Error al comprimir los archivos en ${destinationZip}:`);

            return res.status(500).json({ error: error });
        });


});

// UTIL, DESCOMPRIME Y DESENCRIPTA EL ARCHIVO
app.post('/desencriptar_descomprimir', (req, res) => {
    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para descomprimir el archivo ${req.body.archivo}.`);

    // USO DEL METODO
    // ESPERA LOS PARAMETROS EN EL BODY: archivo (nombre del archivo)
    //   LLAMA A GET '/descargar_archivos/${nombreUsuario}?archivo=${nombreArchivo}' con HEADER Authorization : `Bearer ${token}`
    //   ESPERA EN RESPUESTA: archivo, clave ???
    // DEVUELVE: titulo, descripcion, autor, fecha

    deleteFolderRecursive('./assets/decompressed/');
    let data;
    let jsonData;

    let protegido = false;
    var carpeta = req.body.archivo.slice(0, -4);
    var rutaArchivo = `./assets/files/${req.body.archivo}`;
    var rutaClave = `./assets/files/${carpeta}.json.enc`;


    const url = `https://localhost:4000/descargar_archivos/${usuario}/${req.body.archivo}`;
    const request = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para descomprimir el archivo ${req.body.archivo}. - Solicitando al SA`);
    fetch(url, request).then(response => {
        // Asegurándose de que la respuesta es OK
        if (response.ok) {
            //console.log(response);
            return response.arrayBuffer();
        }
        else{
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }

    }).then(arrayBuffer => {

        const buffer = Buffer.from(arrayBuffer);
        const filePath = rutaArchivo; // Ruta donde se guardará el archivo

        fs.writeFile(filePath, buffer, err => {
            if (err) {
                console.error("Error al guardar el archivo", err);
                return res.status(500).json({error:'Error al guardar el archivo'});
            }

            const url2 = `https://localhost:4000/descargar_archivos/${usuario}/${carpeta}.json.enc`;
            const request2 = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token_usuario}`
                }
            };
            fetch(url2, request2).then(response => {
                // Asegurándose de que la respuesta es OK
                if (response.ok) {
                    //console.log(response);
                    return response.arrayBuffer();
                }
                else{
                    return response.json().then(err => {
                        throw new Error(err.error);
                    });
                }
        
            }).then(arrayBuffer => {

                console.log(arrayBuffer.byteLength);
                const buffer = Buffer.from(arrayBuffer);
                const filePath = rutaClave; // Ruta donde se guardará el archivo
        
                fs.writeFile(filePath, buffer, err => {
                    if (err) {
                        console.error("Error al guardar el archivo", err);
                        return res.status(500).json({error:'Error al guardar el archivo'});
                    }

                    decrypt(rutaClave, 'clave', usuario);

                    //"./assets/files/usuarioA_AAA.zip.enc" rutaArchivo
                    var archivo = new AdmZip(rutaArchivo.replace('.enc', ''));
                    var archivosZip = archivo.getEntries();

                    for(var entry of archivosZip){
                        if(entry.header && typeof entry.header.isEncrypted === 'function'){
                            if(entry.header.isEncrypted()){
                                protegido = true;
                            }
                        }   
                    }
                    
                    if(protegido){
                        contraseñas.forEach( (contraseña) => {
                            try{
                                
                                //archivo.setPassword(contraseña);
                                archivo.extractAllTo(`./assets/decompressed/${carpeta}`, { password: contraseña });
                                
                                //devolver el titulo y descripcion
                                try{
                                    data = fs.readFileSync(`./assets/decompressed/${carpeta}/info.json`, 'utf8');
                                    jsonData = JSON.parse(data);
                                }
                                catch(error){
                                    console.log(error);
                                }
                                //-------
                                process.exit();
                            }
                            catch(error){
                                console.log(error);
                                return res.status(200).json({ message: 'Archivos no han podido ser descomprimidos.' });
                            }
                        })
                    }
                    else{
                        try{ 
                            archivo.extractAllTo(`./assets/decompressed/${carpeta}`, {} );
                            //devolver el titulo y descripcion
                            try{
                                data = fs.readFileSync(`./assets/decompressed/${carpeta}/temp/info.json`, 'utf8');
                                jsonData = JSON.parse(data);
                            }
                            catch(error){
                                console.log(error);
                            }
                            //-------
                        }
                        catch(error){console.log(error);}    
                    }

                    vaciarCarpeta('./assets/files/')
                    return res.status(200).json({titulo:jsonData.titulo, descripcion:jsonData.descripcion, autor:jsonData.autor, fecha:jsonData.fecha, ruta:carpeta});

                });
        }).catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el archivo `);
            return res.status(400).json({ error: error.message });
        });
    });
    }).catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el archivo `);
        return res.status(400).json({ error: error.message });
    });
});

app.post('/desencriptar_descomprimir_compartido', (req, res) => {

    deleteFolderRecursive('./assets/decompressed/');
    let data;
    let jsonData;

    let protegido = false;
    
    let archivoClaveDescarga = req.body.archivo;

    archivoClaveDescarga = archivoClaveDescarga.replace('.json', '');

    // !!! archivoClaveDescarga = "diego_Smithereens.zip.enc"; // !!! ASUMO QUE LLEGA UN ARCHIVO CON ESTE FORMATO
    var carpeta = archivoClaveDescarga.slice(0, -4);
    
    var rutaArchivo = `./assets/files/${archivoClaveDescarga}`;
    var rutaClave = `./assets/files/${carpeta}.json.enc`;

    const url1 = `https://localhost:4000/autor_compartido/${usuario}/${carpeta}.json.enc`;
    const request1 = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url1, request1).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {

        const autor = data.usuario;

        let archivoDescarga = archivoClaveDescarga.replace(`${usuario}_`, '');
        rutaArchivo = `./assets/files/${archivoDescarga}`;
       
        console.log(data.usuario);
        // El metodo devuelve una lista con los nombres de los archivos
        writeLogWithTimestamp(req.socket.remoteAddress, `Lista de archivos obtenida correctamente`);

        const url = `https://localhost:4000/descargar_archivos/${usuario}/${carpeta}.json.enc`;// !!! funciona con la implementacion actual, si cambia lo que se muestra fallar'a
        const request = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token_usuario}`
            }
        };

        fetch(url, request).then(response => {
            // Asegurándose de que la respuesta es OK
            if (response.ok) {
                //console.log(response);
                return response.arrayBuffer();
            }
            else{
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }

        }).then(arrayBuffer => {

            console.log(arrayBuffer.byteLength);
            const buffer = Buffer.from(arrayBuffer);
            const filePath = rutaClave; // Ruta donde se guardará el archivo

            fs.writeFile(filePath, buffer, err => {
                if (err) {
                    console.error("Error al guardar el archivo", err);
                    return res.status(500).json({error:'Error al guardar el archivo'});
                }

                const url2 = `https://localhost:4000/descargar_archivos/${usuario}/${archivoDescarga}`;
                const request2 = {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token_usuario}`
                    }
                };
                fetch(url2, request2).then(response => {
                    // Asegurándose de que la respuesta es OK
                    if (response.ok) {
                        //console.log(response);
                        return response.arrayBuffer();
                    }
                    else{
                        return response.json().then(err => {
                            throw new Error(err.error);
                        });
                    }
            
                }).then(arrayBuffer => {

                    console.log(arrayBuffer.byteLength);
                    const buffer = Buffer.from(arrayBuffer);
                    const filePath = rutaArchivo; // Ruta donde se guardará el archivo
            
                    fs.writeFile(filePath, buffer, async err => {
                        if (err) {
                            console.error("Error al guardar el archivo", err);
                            return res.status(500).json({error:'Error al guardar el archivo'});
                        }

                        rutaClave = await decrypt(rutaClave, 'usuario', usuario); //desciframos la clave con clave privada
                        
                        rutaClave = rutaClave.replace('\n', '');

                        await decrypt(rutaArchivo,'clave_compartido', usuario, rutaClave); //desciframos el fichero original con la clave obtenida en el anterior descifrado. 
                        
                        console.log('yey!');

                        try{
                            var archivo = new AdmZip(rutaArchivo.replace('.enc', ''));
                            var archivosZip = archivo.getEntries();
                        }catch(error){
                            return res.status(500).json({error: error});
                        }
    
                        for(var entry of archivosZip){
                            if(entry.header && typeof entry.header.isEncrypted === 'function'){
                                if(entry.header.isEncrypted()){
                                    protegido = true;
                                }
                            }   
                        }
                        
                        if(protegido){
                            contraseñas.forEach( (contraseña) => {
                                try{
                                    
                                    //archivo.setPassword(contraseña);
                                    archivo.extractAllTo(`./assets/decompressed/${carpeta}`, { password: contraseña });
                                    
                                    //devolver el titulo y descripcion
                                    try{
                                        data = fs.readFileSync(`./assets/decompressed/${carpeta}/info.json`, 'utf8');
                                        jsonData = JSON.parse(data);
                                    }
                                    catch(error){
                                        console.log(error);
                                    }
                                    //-------
                                    process.exit();
                                }
                                catch(error){
                                    console.log(error);
                                    return res.status(200).json({ message: 'Archivos no han podido ser descomprimidos.' });
                                }
                            })
                        }
                        else{
                            try{ 
                                carpeta = carpeta.replace('.zip', '');
                                archivo.extractAllTo(`./assets/decompressed/${carpeta}`, {});
                                //devolver el titulo y descripcion
                                try{
                                    data = fs.readFileSync(`./assets/decompressed/${carpeta}/temp/info.json`, 'utf8');
                                    jsonData = JSON.parse(data);
                                }
                                catch(error){
                                    console.log(error);
                                }
                                //-------
                            }
                            catch(error){console.log(error);}    
                        }
    
                        vaciarCarpeta('./assets/files/')
                        return res.status(200).json({titulo:jsonData.titulo, descripcion:jsonData.descripcion, autor:jsonData.autor, fecha:jsonData.fecha, ruta:carpeta});
    

                    });
            }).catch(error => {
                console.error('Error en la solicitud al servidor:', error);
                writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el archivo `);
                return res.status(400).json({ error: error.message });
            });
        });
        }).catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el archivo `);
            return res.status(400).json({ error: error.message });
        });
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener la lista de archivos`);
        return res.status(400).json({ error: error.message });
    });


    
});

// NO DEL TODO ÚTIL, ESTO LO HACE AHORA EL STORAGE SERVER. 
app.get('/descargar' , (req, res) => {

    let archivo = req.query.file.split('?')[0];

    let regex = /(\/decompressed\/)(.*)/;

    //archivo = archivo.replace(regex, `$1${usuario}_$2`);

    let malicioso = req.query.malicioso === 'true';

    var filepath = ''; 
    if (malicioso == true) {
        archivo = archivo.replace("..", "").replace('/', '');
        filepath  = path.join(__dirname, 'maliciousFolder', archivo);
    } else {
        filepath  = archivo;
    }
    
    fs.access(filepath, fs.constants.F_OK, (err)=>{
        if(err){
            console.error("El archivo no existe. ", err);
            return res.status(404).json({error:'Archivo noencontrado'});
        }
         res.download(filepath, (err) => {
            if (err) {
                console.error("Error al enviar el archivo.", err);
                res.status(500).json({error:'Error al descargar el archivo'});
            }
        });
    })
});

app.get('/listar_archivos_inseguro/:usuario', (req, res)=>{
    let status;

    console.log("Usuario: " + req.params.usuario);
    const url = `https://localhost:4000/listar_archivos_inseguro/${req.params.usuario}`;
    const request = {
        method: 'GET'
    };

    fetch(url, request).then(response=>{
        status = response.status;
        return response.json();
    }).then(data=>{
        if(data.archivos){
            return res.status(200).json({archivos: data.archivos});
        }
        else{
            return res.status(status).json({"error": data.error, "status": status});
        }
    }) 
    
});

app.get('/desencriptar_y_listar_Zip_inseguro/:archivo' , (req, res) => {
    
    limpiarDirectorio("./maliciousFolder");

    let archivo = req.params.archivo;
    var filepath = './files/'+ archivo; //comprobar que esto hace falta.
    let status;

    const url = `https://localhost:4000/descargar_archivos_inseguro/${archivo}`;
    const request = {
        method:'GET'
    };
    
    fetch(url, request).then(response => {
            // Asegurándose de que la respuesta es OK
            status = response.status;
            if (response.ok) {
                //console.log(response);
                return response.arrayBuffer();
            }

        }).then(arrayBuffer => {

            console.log(arrayBuffer.byteLength);
            const buffer = Buffer.from(arrayBuffer);
            const filePath = `./maliciousFolder/${archivo}`; // Ruta donde se guardará el archivo


            fs.writeFile(filePath, buffer, err => {
                if (err) {
                    console.error("Error al guardar el archivo", err);
                    return res.status(status).json({error: err.error, "status": status});
                }
    
                // Una vez guardado, pasamos la ruta del archivo a maliciousDecrypt
                const exito = maliciousDecrypt(filePath);
                if (exito) {
                    //DEBE DEVOLVER LA LISTA DE LOS ARCHIVOS QUE CONTIENE EL ZIP, UBICADOS EN MALICIOUSFOLDER/TEMP/
                    
                    listarArchivosEnDirectorio("./maliciousFolder/temp", (error, archivos) => {
                        if (error) {
                            console.error('Error:', error);
                            return;
                        }
                        let info = fs.readFileSync(`./maliciousFolder/temp/info.json`, 'utf8');
                        let infoJSON = JSON.parse(info);
                        
                        let listaFiltrada = [];
                        for(var i = 0; i<archivos.length; i++){
                            if(archivos[i]!="info.json"){
                                listaFiltrada.push(archivos[i]);
                            }
                        }
                        return res.status(200).json({listaArchivos: listaFiltrada, "descripcion": infoJSON.descripcion, "autor": infoJSON.autor, "fecha": infoJSON.fecha});
                    });  
                    
                } else {
                    console.log("El archivo ha sido encriptado de manera segura.")
                    return res.status(300).json({ error: "El archivo ha sido encriptado de manera segura." });
                }
            });
        })
});

app.get('/descargar_archivos_inseguro/:archivo', (req, res) => {

    const archivo = req.params.archivo;
    const filepath = `./maliciousFolder/temp/${archivo}`;

    try {
        const contenidoArchivo = fs.readFileSync(filepath);
        res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
        res.status(200).send(contenidoArchivo);
    } catch (error) {
        console.error('Error al leer el archivo:', error);
        res.status(500).json({error:'Error al leer el archivo'});
    }

});

app.get('/logout', (req, res) => {
    
    usuario = "";
    clave_usuario = "";
    clave_datos = "";
    token_usuario = "";

    res.redirect('/');
});

//Para listar los usuarios disponibles para compartir cuando vayamos a añadir un archivo nuevo
app.get('/listar_usuarios/:usuario', (req, res) => {

    // USO DEL METODO
    // ESPERA LOS PARAMETROS: 
    //   LLAMA A GET '/listar_usuarios' con HEADER Authorization : `Bearer ${token}`
    //   ESPERA EN RESPUESTA: usuarios -> Lista de tuplas usuario + clave
    // DEVUELVE: archivos -> Lista de tuplas usuario + clave

    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para la lista de usuarios y claves públicas');

    const url = `https://localhost:4000/listar_usuarios/${req.params.usuario}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    console.log(token_usuario);

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
       
        // El metodo devuelve una lista con tuplas usuarios, clave pública
        writeLogWithTimestamp(req.socket.remoteAddress, `Lista de usuarios obtenida correctamente`);
        usuariosclaves = data.usuarios;
        return res.status(200).json({usuarios: data.usuarios});
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener la lista de archivos`);
        return res.status(400).json({ error: error.message });
    });
});

//Lista de usuarios con el archivo x compartido con ellos y mostrarlo en la info de ese archivo
app.get('/lista_compartidos/:usuario/:archivo', (req, res) => {
 
    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para la lista de usuarios que tienen compartido el archivo');

    const url = `https://localhost:4000/lista_compartidos/${req.params.usuario}/${req.params.archivo}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
       
        writeLogWithTimestamp(req.socket.remoteAddress, `Lista de usuarios obtenida correctamente`);
        console.log('Usuarios con archivo: ' + data.usuariosConArchivo);
        return res.status(200).json({usuarios: data.usuariosConArchivo});
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener la lista de usuarios`);
        return res.status(400).json({ error: error.message });
    });
});

//Lista de usuarios sin acceso a un archivo
app.get('/lista_sin_compartidos/:usuario/:archivo', (req, res) => {
 
    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para la lista de usuarios que no tienen compartido el archivo');

    const url = `https://localhost:4000/lista_sin_compartidos/${req.params.usuario}/${req.params.archivo}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
       
        writeLogWithTimestamp(req.socket.remoteAddress, `Lista de usuarios obtenida correctamente`);
        console.log('Usuarios sin archivo: ' + data.usuariosSinArchivo);
        return res.status(200).json({usuarios: data.usuariosSinArchivo});
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener la lista de usuarios`);
        return res.status(400).json({ error: error.message });
    });
});

/* //Dejar de compartir un archivo con un usuario
app.get('/eliminar_permisos/:propietario/:compartido/:archivo', (req, res) => {
 
    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para elimiar permisos');

    const url = `https://localhost:4000/eliminar_permisos/${req.params.propietario}/${req.params.compartido}/${req.params.archivo}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
       
        writeLogWithTimestamp(req.socket.remoteAddress, `Permiso eliminado correctamente`);
        return res.status(200).json({message: 'Eliminado correctamente'});
 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al eliminar los permisos`);
        return res.status(400).json({ error: error.message });
    });
});

//Añade permisos de acceso a un archivo - INNECESARIO
app.get('/add_permisos/:propietario/:compartido/:archivo', (req, res) => {
 
    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para añadir permisos');
    
    let usuario_propietario = req.params.propietario;
    let usuario_compartir = req.params.compartido;
    let archivo = req.params.archivo;
    
    //tenemos que traer el archivo cifrador: .zip.json.enc, descifrarlo con la clave privada del usuario, obtener el archivo cifrador original y cifrarlo con la clave pública del nuevo usuario.
    //1. construimos el archivo cifrador con las variables de sesión: 
    let rutaClave = `./assets/files/${usuario_propietario}_${archivo}.zip.json`;
    let clave = JSON.stringify({ key: clave_datos, iv: 0 }); 
    fs.writeFileSync(rutaClave, clave);
    
    encrypt(rutaClave, "agregar_permisos", usuario_compartir);
    
    console.log("Archivo cifrado exitosamente.");

    const options_compartir = {
        hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
        port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
        path: `/compartir_archivos/${usuario_propietario}/${usuario_compartir}/${usuario_propietario}_${usuario_compartir}_${archivo}.zip.json.enc`, // Cambia esto por el endpoint en el servidor de destino
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token_usuario}`,
        },
    };

    const stream = fs.createReadStream(`./assets/files/${usuario_compartir}_${titulo}.zip.json.enc`);

    const upload_c = subirArchivo(options_compartir.path, stream, options_compartir);

    upload_c; // Esperar a que se complete la subida del archivo
    url = `https://localhost:4000/add_permisos/${req.params.propietario}/${req.params.compartido}/${req.params.archivo}`;
    request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    }).then(data => {
    
        writeLogWithTimestamp(req.socket.remoteAddress, `Permiso añadido correctamente`);
        return res.status(200).json({message: 'Añadido correctamente'});

    })
    /* //1. nos traemos el zip.json.enc del propietario: 
    let url = `https://localhost:4000/descargar_archivos/${usuario_propietario}/${usuario_propietario}_${archivo}.zip.json.enc`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };
    await fetch(url, request).then(response => 
        {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {

            console.log(arrayBuffer.byteLength);
            const buffer = Buffer.from(arrayBuffer);
            const filePath =`./assets/files/${usuario_propietario}_${archivo}.zip.json.enc`; // Ruta donde se guardará el archivo
    
            fs.writeFile(filePath, buffer, async err => {
                if (err) {
                    console.error("Error al guardar el archivo", err);
                    return res.status(500).send('Error al guardar el archivo');
                }
                console.log("Archivo guardado exitosamente.");
           
                let destinationZip = `./assets/files/${usuario_propietario}_${archivo}.zip.json.enc`;
                
                //construimos el archivo cifrador con los datos de la sesión: 
                let clave = JSON.stringify({ key: clave_datos, iv: 0 }); 
                fs.writeFileSync(`${usuario_propietario}_${archivo}.zip.json`, clave);
                
            })
        });
      
}); */

//Elimina un archivo y los que tiene asociado
app.get('/eliminar_archivo/:usuario/:archivo', (req, res) => {
 
    writeLogWithTimestamp(req.socket.remoteAddress, 'Solicitud para elimiar archivo');

    const url = `https://localhost:4000/eliminar_archivo/${req.params.usuario}/${req.params.archivo}`;
    const request = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token_usuario}`
        }
    };

    fetch(url, request).then(response => 
    {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error);
            });
        }
        return response.json();
    })
    .then(data => {
       
        writeLogWithTimestamp(req.socket.remoteAddress, `Archivo eliminado correctamente`);
        let archivo = req.params.archivo;
        archivo = archivo.replace('.zip.enc', '');
        let titulo = `${req.params.usuario}_${archivo}`;
        const url = `https://localhost:4000/eliminar_compartidos/${req.params.usuario}/${titulo}`;
        const request = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token_usuario}`
            }
        };

        fetch(url, request).then(response => 
        {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error);
                });
            }
            return response.json();
        }).then(data => {
            writeLogWithTimestamp(req.socket.remoteAddress, `Archivos compartidos eliminados correctamente`);

            return res.status(200).json({message: 'Archivos compartidos eliminados correctamente'});

        }).catch(error => {
            console.error('Error en la solicitud al servidor:', error);
            writeLogWithTimestamp(req.socket.remoteAddress, `Error al eliminar el archivo`);
            return res.status(400).json({ error: error.message });
        }); 
    })
    .catch(error => {
        console.error('Error en la solicitud al servidor:', error);
        writeLogWithTimestamp(req.socket.remoteAddress, `Error al eliminar el archivo`);
        return res.status(400).json({ error: error.message });
    });
});

app.post('/cambiar_compartidos/:usuario/:archivo', (req, res) => {

    let usuario = req.params.usuario;
    let archivo = usuario + '_' + req.params.archivo + '.zip.enc'; //zip.enc
    let usuarios_compartir = req.body.lista_compartidos;
    //let usuarios_compartir = ['adria']; //mock

    //descargamos de S.A. el archivo zip.enc y el zip.json.enc
    const url = `https://localhost:4000/descargar_archivos/${usuario}/${archivo}`; 
    const request = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token_usuario}`
        },
    };

    fetch(url, request).then(response => { //NOS TRAEMOS EL .ZIP.ENC
        // Asegurándose de que la respuesta es OK
        if (response.ok) {
            //console.log(response);
            return response.arrayBuffer();
        }
        else{
            throw new Error('El archivo no existe');
        }

    }).then(arrayBuffer => {

        console.log(arrayBuffer.byteLength);
        const buffer = Buffer.from(arrayBuffer);
        const filePath = `./assets/files/${archivo}`; // Ruta donde se guardará el archivo

        fs.writeFile(filePath, buffer, err => {
            if (err) {
                console.error("Error al guardar el archivo", err);
                return res.status(500).json({error:'Error al guardar el archivo'});
            }

            const url2 = `https://localhost:4000/descargar_archivos/${usuario}/${usuario}_${req.params.archivo}.zip.json.enc`; //NOS TRAEMOS EL .ZIP.JSON.ENC
            const request2 = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token_usuario}`
                }
            };
            fetch(url2, request2).then(response => {
                // Asegurándose de que la respuesta es OK
                if (response.ok) {
                    //console.log(response);
                    return response.arrayBuffer();
                }
                else{
                    throw new Error('El archivo no existe');
                }
        
            }).then(arrayBuffer => {

                console.log(arrayBuffer.byteLength);
                const buffer = Buffer.from(arrayBuffer);
                const filePath = `./assets/files/${usuario}_${req.params.archivo}.zip.json.enc`; // Ruta donde se guardará el archivo
        
                fs.writeFile(filePath, buffer, async err => {
                    if (err) {
                        console.error("Error al guardar el archivo", err);
                        return res.status(500).json({error:'Error al guardar el archivo'});
                    }

                    decrypt(filePath, 'clave', usuario); //DESCIFRAMOS LA CLAVE CON CONTRASEÑA. 

                    //aquí ya tenemos el archivo.zip crudo. Vamos a volver a cifrar con nueva contraseña y para cada uno de los compartidos
                    let titulo = `${usuario}_${req.params.archivo}`;
                    let destinationZip = `./assets/files/${titulo}.zip`;
                    let modo = false; //cuidado!!!
                    

                    // Encriptar el archivo comprimido
                    encrypt(destinationZip, modo, "");
                    
                    //deleteFolderRecursive(filesDirectory);

                    fs.rmSync(destinationZip);
                    
                    // enviar archivos al backend
                    const url = `https://localhost:4000/subir_archivos/${usuario}`;

                    const options = {
                        hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                        port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                        path: `/subir_archivos/${usuario}/${req.params.archivo}.zip.enc/false`, // Cambia esto por el endpoint en el servidor de destino
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token_usuario}`,
                        },
                    };
                    const stream = fs.createReadStream(`./assets/files/${titulo}.zip.enc`);

                    const options2 = {
                        hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                        port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                        path: `/subir_archivos/${usuario}/${req.params.archivo}.zip.json.enc/false`, // Cambia esto por el endpoint en el servidor de destino
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token_usuario}`,
                        },
                    };
                    const stream2 = fs.createReadStream(`./assets/files/${usuario}_${req.params.archivo}.zip.json.enc`);

                    try {
                        // Subir el primer archivo
                        await subirArchivo(options.path, stream, options);
                
                        // Subir el segundo archivo
                        await subirArchivo(options2.path, stream2, options2);

                        //quitamos todo registro de compartición de db del archivo en cuestión

                        let request = {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token_usuario}`
                            }
                        }
                        await fetch(`https://localhost:4000/eliminar_compartidos/${usuario}/${titulo}`, request).then(response=>{
                            return response.json();
                        }).then(async data=>{
                            // Bucle para compartir archivos con usuarios
                            for (let i = 0; i < usuarios_compartir.length; i++) {

                                encrypt(destinationZip, "usuario", usuarios_compartir[i]);
                                const options_compartir = {
                                    hostname: 'localhost', // Cambia esto por la dirección del servidor de destino
                                    port: 4000, // Cambia esto por el puerto en el que está escuchando el servidor de destino
                                    path: `/compartir_archivos/${usuario}/${usuarios_compartir[i]}/${usuario}_${usuarios_compartir[i]}_${req.params.archivo}.zip.json.enc`, // Cambia esto por el endpoint en el servidor de destino
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token_usuario}`,
                                    },
                                };
                    
                                const stream = fs.createReadStream(`./assets/files/${usuarios_compartir[i]}_${titulo}.zip.json.enc`);
                    
                                const upload_c = subirArchivo(options_compartir.path, stream, options_compartir);
                    
                                await upload_c; // Esperar a que se complete la subida del archivo
                            }
                    
                            writeLogWithTimestamp(req.socket.remoteAddress, 'Ambos archivos se han subido correctamente');
                            vaciarCarpeta('./assets/files');
                    
                            res.status(200).json({ message: 'Archivos encriptados correctamente.' });
                        })
                    } catch (error) {
                        if(error.message){
                            if (error.message.includes('segundo archivo')) {
                                vaciarCarpeta('./assets/files/')
                                res.status(500).json({ error: 'Error al subir el segundo archivo' });
                            }
                            else {
                                vaciarCarpeta('./assets/files/')
                                res.status(500).json({ error: error });
                            }
                        }
                        else {
                            res.status(500).json({ error: 'Error al subir el primer archivo' });
                        }
                    }
                    
                    vaciarCarpeta('./assets/files/')
                    return res.status(200);

                });
            }).catch(error => {
                console.error('Error en la solicitud al servidor:', error);
                writeLogWithTimestamp(req.socket.remoteAddress, `Error al obtener el archivo `);
                return res.status(400).json({ error: error.message });
            });
        });
    });
});

const express = require('express');
const https = require("https");
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { arch } = require('os');
const { error } = require('console');

const PORT = 4000;
var privateKey = fs.readFileSync('./certificados/clave_privada_servidor.pem').toString();
var certificate = fs.readFileSync('./certificados/certificado_servidor.crt').toString();
var credentials = {key: privateKey, cert: certificate};
const clave_servidor = 'CLAVE_SERVIDOR';
const saltRounds = 10; // Número de rondas de hashing (más rondas = más seguro pero más lento)
let flag_inseguro = false;

const app = express();
app.use(bodyParser.json());
var httpsServer = https.createServer(credentials, app);

const dbDirectory = './assets/db';
const filesDirectory = './assets/files/';
const dbFilePath = './assets/db/usuarios.json';

function writeLogWithTimestamp(ip, message) {
  const date = new Date();
  const fechaFormateada = `${date.toDateString()} ${date.toTimeString().split(' ')[0]}`;
  writeLogs(ip, `${fechaFormateada} - ${message}`);
}

function writeLogs(ip, message){
  const logsDirectory = './assets/logs';
  const logsFilePath = path.join(logsDirectory, 'logs.txt');
  // Verificar si el directorio de logs existe, si no, crearlo
  if (!fs.existsSync(logsDirectory)) {
    fs.mkdirSync(logsDirectory, { recursive: true });
  }
  // Verificar si el archivo de logs existe, si no, crearlo
  if (!fs.existsSync(logsFilePath)) {
    // Crear el archivo logs.txt si no existe
    fs.writeFileSync(logsFilePath, '', 'utf8');
  }
  fs.appendFileSync(logsFilePath, `${ip}: ${message}\n`, 'utf8');
}

function iniciarSesion(datos,nombreSolicitud, claveSolicitud){
  // Comprobar existencia del usuario y verificar la clave
  const usuarioEncontrado = datos.usuarios.find(usuario =>
    usuario.nombre === nombreSolicitud && usuario.clave === claveSolicitud
  );

  if (!usuarioEncontrado) {
    return null;
  }

  //Generar token
  const token = jwt.sign({ nombreSolicitud }, clave_servidor, { expiresIn: '2h' });
  return token;
}



function verificarTokenMiddleware(req, res, next) {
  const usuarioRecibido = req.params.usuario;
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    manejarErroresJWT(new Error('Se requiere autenticación'), req, res);
  }

  const tokenRecibido = authHeader.split(' ')[1];

  try {
    const datosDecodificados = jwt.verify(tokenRecibido, clave_servidor);
    const { nombreSolicitud } = datosDecodificados;

    if (nombreSolicitud != usuarioRecibido) {
      if (req.file) {
        fs.unlinkSync(req.file.path); // Elimina el archivo si la verificación del token falla
      }
      throw new Error('El token y el usuario no coinciden');
    }
    next();
  } catch (error) {
    manejarErroresJWT(error, req, res);
  }
}

function manejarErroresJWT(error, req, res) {
  let statusCode = 403;
  let errorMessage = 'Acceso denegado.';

  if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'El token ha expirado.';
  } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Error en el token JWT.';
  }

  console.error(errorMessage, error);
  writeLogWithTimestamp(req.socket.remoteAddress, errorMessage);
  res.status(statusCode).json({ error: errorMessage });
}

httpsServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}, https://localhost:${PORT}`);

  if (!fs.existsSync(filesDirectory)) {
    fs.mkdirSync(filesDirectory, { recursive: true });
  }

  // Verificar si el directorio de db existe, si no, crearlo
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
  // Verificar si el archivo de db existe, si no, crearlo
  if (!fs.existsSync(dbFilePath)) {
    const initialData = {
      usuarios: []
    };
    fs.writeFileSync(dbFilePath, JSON.stringify(initialData, null, 2), 'utf8');
  }

  if(process.argv[2] == "inseguro"){
    flag_inseguro = true;
    console.log("------------------------ EL SERVIDOR DE ALMACENAMIENTO HA SIDO INICIADO EN MODO INSEGURO ------------------------")
  }
});

app.get('/', (req, res) => {
  res.send('Servidor-Servidor de ES');
});

app.post('/register', (req, res) => {
  var privateKeyCifrada = req.body.privateKeyCifrada;
  var publicKey = req.body.publicKey;
  console.log(`Solicitud de registro para ${req.body.usuario}`);
  
  try{ 
    //Leer DB
    var fileContent = fs.readFileSync(dbFilePath, 'utf8');
    var datos = { usuarios: [] };
    if(fileContent){
      datos = JSON.parse(fileContent);
    }

    console.log(`DB leida`);

    if (datos.usuarios.some(usuario => usuario.nombre === req.body.usuario)) {
      console.error('Usuario existente');
      return res.status(409).json({ error: 'Usuario existente' });
    }

    console.log(`Encriptando...`);
    bcrypt.hash(req.body.clave_usuario, saltRounds, (err, hash) => {
      if (err) {
        console.error('Error al generar hash bcrypt:', err);
        return res.status(500).json({ error: 'Error al registrar usuario' });
      }

      const salt = bcrypt.genSaltSync(saltRounds); // Genera la sal
      const usuario = {
        nombre: req.body.usuario,
        clave: hash, // Almacena el hash de la contraseña en lugar de la contraseña en texto plano
        mail: req.body.mailCifrado,
        salt: salt, // Almacena la sal utilizada para el hash
        archivos: [],
        compartido: req.body.compartido,
        clavePublicaRSA: publicKey,
        clavePrivadaRSA: privateKeyCifrada
      };
      console.log(`Almacenando datos...`);
      datos.usuarios.push(usuario);

      const jsonStr = JSON.stringify(datos, null, 2);
      fs.writeFileSync(dbFilePath, jsonStr, 'utf8');

      var resultadoLogin = iniciarSesion(datos, req.body.usuario, hash);
      if (!resultadoLogin) {
        return res.status(500).json({ error: 'Usuario o contraseña incorrectos' });
      }
      console.log('Inicio de sesión exitoso', resultadoLogin);
      return res.status(200).json({
        message: 'Usuario registrado correctamente',
        token: resultadoLogin,
        KprivUsuario: privateKeyCifrada
      });
    });
  }catch (error) {
    console.error(error);
    return res.status(500).json({ error: error });
  }
});

app.post('/login', (req, res) => {
  let nombreSolicitud = req.body.usuario;

  //! Usar bcrypt para HASH otra vez de la clave y compararlo con la DB
  let claveSolicitud = req.body.clave_usuario;

  //Leer DB
  var fileContent = fs.readFileSync(dbFilePath, 'utf8');

  var datos = { usuarios: [] };
  if(fileContent){
    datos = JSON.parse(fileContent);
  }
  
  // Buscar el usuario en la base de datos
  const usuarioEncontrado = datos.usuarios.find(usuario => usuario.nombre === nombreSolicitud);

  // Verificar si el usuario existe
  if (!usuarioEncontrado) {
    return res.status(500).json({ error: 'Usuario o contraseña incorrectos' });
  }

  // Comparar la contraseña proporcionada con la contraseña almacenada usando bcrypt
  bcrypt.compare(claveSolicitud, usuarioEncontrado.clave, (err, result) => {
    if (err || !result) {
      return res.status(500).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    var resultadoLogin = iniciarSesion(datos,nombreSolicitud,usuarioEncontrado.clave);

    if (!resultadoLogin) {
      return res.status(500).json({ error: 'Usuario o contraseña incorrectos' });
    }
    console.log('Inicio de sesión exitoso', resultadoLogin);
    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token: resultadoLogin,
      mailCifrado: usuarioEncontrado.mail,
      KprivUsuario:usuarioEncontrado.clavePrivadaRSA}
    );
      
  });
});

app.get('/listar_archivos/:usuario', verificarTokenMiddleware, (req, res) => {
  writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de los archivos`);

  const nombreUsuario = req.params.usuario

  // Leer el archivo JSON
  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Error al leer el archivo:", err);
        res.status(500).json({error: "Error a la hora de leer el archivo de usuarios. "});
    }
    
    // Parsear el JSON
    const jsonData = JSON.parse(data);
    
    // Buscar el usuario por nombre
    const usuario = jsonData.usuarios.find(usuario => usuario.nombre === nombreUsuario);
    // Devolver la lista de archivos si se encuentra el usuario, de lo contrario devolver null o un mensaje
    if (usuario) {
      let archivosUsuario = usuario.archivos;
      let archivosCompartidos = usuario.compartido;
      let tieneArchivos = (archivosUsuario || archivosCompartidos);

      if(tieneArchivos){
        //filtro para solo devolver la lista de archivos zip, no los zip.enc
        let listaFiltrada = [];
        let listaCompartidos = [];
        if (archivosCompartidos){
          for(let i = 0; i<archivosUsuario.length ; i++){
            if(!archivosUsuario[i].includes(".json.enc")){
              listaFiltrada.push(archivosUsuario[i]);
            }
          }
        }
        if (archivosCompartidos) {
          for (let i = 0; i < archivosCompartidos.length; i++) {
            let usuarioCompartido = archivosCompartidos[i];
            let nombresUsuarios = Object.keys(usuarioCompartido); // Obtener todos los nombres de usuario
            for (let j = 0; j < nombresUsuarios.length; j++) {
              let nombreUsuario = nombresUsuarios[j];
              let archivos = usuarioCompartido[nombreUsuario];
              for (let k = 0; k < archivos.length; k++) {
                if (archivos[k].includes(".json.enc")) {
                 listaCompartidos.push({usuario: nombreUsuario, archivo: archivos[k]});
                // listaCompartidos.push(archivos[k]);
                }
              }
            }
          }
        }
        res.status(200).json({ archivos: listaFiltrada, archivosCompartidos: listaCompartidos });
      }
      else{
        res.status(400).json({error: `El usuario ${nombreUsuario} no tiene archivos almacenados`});
      }
    } else {
      res.status(400).json({error: `Error al obtener los archivos del usuario: ${nombreUsuario}`});
    }
  });

});

app.post('/subir_archivos/:usuario/:titulo/:crear', verificarTokenMiddleware, (req, res) => {
  writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para almacenar archivos`);
  const usuarioNombre = req.params.usuario;
  const titulo = req.params.titulo;
  const filePath = `./assets/files/${usuarioNombre}_${titulo}`;

  if(req.params.crear == 'true'){
    if (fs.existsSync(filePath)) {
      return res.status(500).json({error: 'El archivo ya existe, elimina el existente o elige un nuevo nombre'})
    }
  }
  
  const fileStream = fs.createWriteStream(filePath);

  req.pipe(fileStream);

  fileStream.on('finish', () => {
    console.log('File has been written successfully.');
    fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
      if (err) {
        console.error("Error al leer el archivo:", err);
        return res.status(500).json({ error: "Error al leer el archivo de usuarios." });
      }

      try {
        const jsonData = JSON.parse(data);
        const usuarioActual = jsonData.usuarios.find(usuario => usuario.nombre === usuarioNombre);

        if (!usuarioActual) {
          return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const nombreArchivo = `${usuarioNombre}_${titulo}`;
        let archivoExistente = false;
        for (const archivo of usuarioActual.archivos) {
          if (archivo === nombreArchivo) {
            archivoExistente = true;
            break;
          }
        }

        if (!archivoExistente) {
          usuarioActual.archivos.push(nombreArchivo);
        }

        const nuevoContenido = JSON.stringify(jsonData, null, 2);

        fs.writeFile('./assets/db/usuarios.json', nuevoContenido, (err) => {
          if (err) {
            console.error('Error al escribir en el archivo:', err);
            return res.status(500).json({ error: "Error al escribir en el archivo de usuarios." });
          }
          res.status(200).json({ message: 'Archivo y clave almacenados exitosamente.' });
        });

      } catch (error) {
        console.error('Error al parsear el JSON:', error);
        res.status(500).json({ error: "Error interno al procesar el JSON de usuarios." });
      }
    });
  });

  fileStream.on('error', error => {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Error writing file'});
  });

  req.on('error', error => {
    console.error('Error in request stream:', error);
    res.status(500).json({ error: 'Error in request stream'});
  });
});


app.get('/descargar_archivos/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivo  = req.params.archivo;

  let rutaDesencriptado = `./assets/files/${archivo}`;
  res.download(rutaDesencriptado, archivo, err => {
      if (err) {
          // Si hay un error que no es de tipo 'archivo no encontrado',
          // envía un error 500 indicando que hubo un problema al descargar el archivo.
          if (!res.headersSent) {
              console.error("Error al enviar el archivo.", err);
              res.status(500).json({error : `El archivo ${archivo} no existe en BBDD.`});
          }
      } else {
          console.log("Archivo enviado exitosamente.");
      }
  });
});

app.get('/autor_compartido/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {

  const archivo  = req.params.archivo;

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error al leer el archivo de usuarios." });
    }

    try {
      const jsonData = JSON.parse(data);
      const usuarioActual = jsonData.usuarios.find(usuario => usuario.nombre === req.params.usuario);

      if (!usuarioActual) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      let resultado = usuarioActual.compartido.find(compartido => {
        let nombre = Object.keys(compartido)[0];
        return compartido[nombre].includes(archivo);
      });

      if (resultado) {
        let nombre = Object.keys(resultado)[0];
        console.log(nombre); // Imprime "antonio"
        console.log("Archivo enviado exitosamente.");
        res.status(200).json({ usuario: nombre });

      } else {
        console.log('Archivo no encontrado en compartidos');
        res.status(500).json({ error: "Error interno al procesar el JSON de usuarios." });

      }
    } catch (error) {
      console.error('Error al parsear el JSON:', error);
      res.status(500).json({ error: "Error interno al procesar el JSON de usuarios." });
    }
  });
});


//LISTA LOS ARCHIVOS EN MODO INSEGURO, NO NECESITA AUTENTICACIÓN CON TOKEN. 
app.get('/listar_archivos_inseguro/:usuario', (req, res) => { //buscamos en el json de USUARIOS los documentos asociados a cada usuario. No queremos desencriptar. Solo devolver el listado de archivos. 
    if(flag_inseguro){
      let nombreUsuario = req.params.usuario;
      
      // Leer el archivo JSON
      fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
        if (err) {
            console.error("Error al leer el archivo:", err);
            res.status(500).json({error: "Error a la hora de leer el archivo de usuarios. "});
        }
        
        // Parsear el JSON
        const jsonData = JSON.parse(data);
        
        // Buscar el usuario por nombre
        const usuario = jsonData.usuarios.find(usuario => usuario.nombre === nombreUsuario);
        // Devolver la lista de archivos si se encuentra el usuario, de lo contrario devolver null o un mensaje
        if (usuario) {
          let archivosUsuario = usuario.archivos; 
          let archivosCompartidos = usuario.compartido;
          if(archivosUsuario || archivosCompartidos){
            //filtro para solo devolver la lista de archivos zip, no los zip.enc
            let listaFiltrada = [];
            for(let i = 0; i<archivosUsuario.length ; i++){
              if(!archivosUsuario[i].includes(".json.enc")){
                listaFiltrada.push(archivosUsuario[i]);
              }
            }

            for(let i = 0; i<archivosCompartidos.length ; i++){
              let compartido = archivosCompartidos[i];
              Object.keys(compartido).forEach(key => {
                  compartido[key].forEach(archivo => {
                      if (archivo.includes(".json.enc")) {
                          listaFiltrada.push(archivo);
                      }
                  });
              });
            }
            res.status(200).json({ archivos: listaFiltrada });
          }
          else{
          res.status(400).json({error: `El usuario ${nombreUsuario} no tiene archivos almacenados`});
          }
        } else {
          res.status(400).json({error: `Error al obtener los archivos del usuario: ${nombreUsuario}`});
        }
      });
    }else{
      return res.status(403).json({error: "Operación no autorizada."});
    }
});

app.get('/descargar_archivos_inseguro/:archivo', (req, res) => {
    if(flag_inseguro){
        const archivo = req.params.archivo;
        let rutaDesencriptado = `./assets/files/${archivo}`;
        res.download(rutaDesencriptado, archivo, err => {
            if (err) {
                // Si hay un error que no es de tipo 'archivo no encontrado',
                // envía un error 500 indicando que hubo un problema al descargar el archivo.
                if (!res.headersSent) {
                    console.error("Error al enviar el archivo.", err);
                    res.status(500).json({error : `El archivo ${archivo} no existe en BBDD.`});
                }
            } else {
                console.log("Archivo enviado exitosamente.");
            }
        });
    }else{
        return res.status(403).json({error: "Operación no autorizada."});
    }
});

//Lista de usuarios
app.get('/listar_usuarios/:usuario', verificarTokenMiddleware, (req, res) => {

  writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para la lista de usuarios y claves públicas`);

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Error al leer el archivo:", err);
        res.status(500).json({error: "Error a la hora de leer el archivo de usuarios. "});
    }
    
    // Parsear el JSON
    const jsonData = JSON.parse(data);
    
    const listaTuplas = jsonData.usuarios.map(usuario => [usuario.nombre, usuario.clavePublicaRSA]);
    console.log(listaTuplas);

    if (listaTuplas) {
          res.status(200).json({ usuarios: listaTuplas });    
    } else {
        res.status(400).json({error: `Error al obtener los usuarios`});
    }

  });
});


//Lista de usuarios con acceso a un archivo
app.get('/lista_compartidos/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivo  = req.params.archivo;
  const nombreUsuario = req.params.usuario;
  const nombreArchivo = '_' + archivo + '.zip.json.enc';

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Error al leer el archivo:", err);
        res.status(500).json({error: "Error a la hora de leer el archivo de usuarios."});
        return;
    }

    try {
      const jsonData = JSON.parse(data);
      
      const usuario = jsonData.usuarios.find(user => user.nombre === nombreUsuario);

      if (!usuario) {
        res.status(400).json({error: `El usuario ${nombreUsuario} no existe.`});
        return;
      }

      // Obtener todos los nombres de usuarios distintos al que se busca
      const otrosUsuarios = jsonData.usuarios.filter(user => user.nombre !== nombreUsuario);
      
      // Array para almacenar los usuarios que tienen el archivo compartido
      let usuariosConArchivo = [];

      // Iterar sobre los otros usuarios
      otrosUsuarios.forEach(otroUsuario => {
        otroUsuario.compartido.forEach(compartido => {
          const nombresCompartidos = Object.keys(compartido);
          nombresCompartidos.forEach(nombreCompartido => {
            const archivosCompartidos = compartido[nombreCompartido];
            archivosCompartidos.forEach(archivoCompartido => {
              if (archivoCompartido == (nombreUsuario+ '_' + otroUsuario.nombre+nombreArchivo) && !usuariosConArchivo.includes(otroUsuario.nombre)) {
                usuariosConArchivo.push(otroUsuario.nombre);
              }
            });
          });
        });
      });

      console.log('Usuarios con archivo si: ' + usuariosConArchivo);
      if (usuariosConArchivo.length > 0) {
        res.status(200).json({usuariosConArchivo});
      }

    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({error: "Error al procesar la solicitud."});
    }
  });
  
});

//Lista de usuarios sin acceso a un archivo
app.get('/lista_sin_compartidos/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivo = req.params.archivo;
  const nombreUsuario = req.params.usuario;
  const nombreArchivo = '_' + archivo + '.zip.json.enc';

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
        console.error("Error al leer el archivo:", err);
        return res.status(500).json({error: "Error a la hora de leer el archivo de usuarios."});
    }

    try {
      const jsonData = JSON.parse(data);
      
      // Buscar el usuario en la lista
      const usuario = jsonData.usuarios.find(user => user.nombre === nombreUsuario);
      if (!usuario) {
        return res.status(400).json({error: `El usuario ${nombreUsuario} no existe.`});
      }

      // Obtener todos los nombres de usuarios distintos al que se busca
      const otrosUsuarios = jsonData.usuarios.filter(user => user.nombre !== nombreUsuario);
      
      // Array para almacenar los usuarios que tienen el archivo compartido
      let usuariosConArchivo = [];

      // Iterar sobre los otros usuarios
      otrosUsuarios.forEach(otroUsuario => {
        otroUsuario.compartido.forEach(compartido => {
          const nombresCompartidos = Object.keys(compartido);
          nombresCompartidos.forEach(nombreCompartido => {
            const archivosCompartidos = compartido[nombreCompartido];
            archivosCompartidos.forEach(archivoCompartido => {
              if (archivoCompartido === (nombreUsuario + '_' + otroUsuario.nombre + nombreArchivo)) {
                usuariosConArchivo.push(otroUsuario.nombre);
              }
            });
          });
        });
      });

      // Obtener la lista de usuarios sin archivo compartido
      const usuariosSinArchivo = otrosUsuarios.filter(user => !usuariosConArchivo.includes(user.nombre))
      .map(user => user.nombre);

      console.log(usuariosSinArchivo);
      if (usuariosSinArchivo.length > 0) {
        res.status(200).json({usuariosSinArchivo});
      }

    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({error: "Error al procesar la solicitud."});
    }
  });
});

//Elimina los permisos de acceso a un archivo para un usuario
app.get('/eliminar_permisos/:usuario/:compartido/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivo = req.params.archivo;
  const propietario = req.params.usuario;
  const compartido = req.params.compartido;
  const nombreArchivo = propietario + '_' + compartido + '_' + archivo + '.zip.json.enc';
  let good = false; 

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error a la hora de leer el archivo de usuarios." });
    }

    try {
      const jsonData = JSON.parse(data);
      
      // Obtener el usuario propietario
      const otrosUsuarios = jsonData.usuarios.filter(user => user.nombre !== propietario);

      // Iterar sobre los otros usuarios
      otrosUsuarios.forEach(otroUsuario => {
        otroUsuario.compartido.forEach(compartido => {
          const nombresCompartidos = Object.keys(compartido);
          nombresCompartidos.forEach(nombreCompartido => {
            const archivosCompartidos = compartido[nombreCompartido];
            archivosCompartidos.forEach((archivoCompartido, index) => {
              if (archivoCompartido == nombreArchivo) {
                archivosCompartidos.splice(index, 1);
                good=true;
              }
            });
          });
        });
      });
      

      if (good) {
        // Escribir el JSON actualizado de nuevo en el archivo
        fs.writeFile('./assets/db/usuarios.json', JSON.stringify(jsonData, null, 2), (err) => {
          if (err) {
            console.error("Error al escribir el archivo:", err);
            return res.status(500).json({ error: "Error al escribir el archivo de usuarios." });
          }
          // Eliminar el archivo físico
          const filePath = path.join(__dirname, 'assets', 'files', nombreArchivo);
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error("Error al eliminar el archivo:", err);
              return res.status(500).json({ error: "Error al eliminar el archivo físico." });
            }
          });
          res.status(200).json({ mensaje: 'Eliminado correctamente' });
        });
      }
      good = false;

    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({ error: "Error al procesar la solicitud." });
    }
  });
});

//Añade permisos de acceso a un archivo
app.get('/add_permisos/:usuario/:compartido/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivo = req.params.archivo;
  const propietario = req.params.usuario;
  const compartido = req.params.compartido;
  const nombreArchivo = propietario + '_' + compartido + '_' + archivo + '.zip.json.enc';
  let good = false; 

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error a la hora de leer el archivo de usuarios." });
    }

    try {
      const jsonData = JSON.parse(data);

      // Obtener el usuario propietario
      const otroUsuario = jsonData.usuarios.find(user => user.nombre === compartido);

      if (otroUsuario) {
          const compartidoObjeto = otroUsuario.compartido.find(objeto => Object.keys(objeto)[0] === propietario);
          if (compartidoObjeto) {
              compartidoObjeto[propietario].push(nombreArchivo);
          } else {
              otroUsuario.compartido.push({ [propietario]: [nombreArchivo] });
          }
      } else {
          console.log('Usuario no encontrado');
      }
      
      // Escribir el JSON actualizado de nuevo en el archivo
      fs.writeFile('./assets/db/usuarios.json', JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          console.error("Error al escribir el archivo:", err);
          return res.status(500).json({ error: "Error al escribir el archivo de usuarios." });
        }
       
        res.status(200).json({ mensaje: 'Añadido correctamente' });
      });
    
    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({ error: "Error al procesar la solicitud." });
    }
  });
});

//Elimina todo registro de compartición de un archivo con más usuarios. Necesario para actualizar la lista de compartidos
app.get('/eliminar_compartidos/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {
  let nombreBaseArchivo = req.params.archivo;
  
  const propietario = req.params.usuario;
  
  nombreBaseArchivo = nombreBaseArchivo.replace(`${propietario}_`, '');

  let good = false; 

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error a la hora de leer el archivo de usuarios." });
    }

    try {
      let jsonData = JSON.parse(data);

      // Iterar sobre todos los usuarios en el JSON
      jsonData.usuarios.forEach(usuario => {
        // Verificar cada lista de compartidos
        usuario.compartido.forEach(compartido => {
          Object.keys(compartido).forEach(key => {
            const archivosCompartidos = compartido[key];
            const indicesParaEliminar = [];
            archivosCompartidos.forEach((archivoCompartido, index) => {
              // Verificar si el nombre del archivo compartido incluye el nombre base y los nombres de los usuarios involucrados
              if (archivoCompartido.includes(nombreBaseArchivo) && archivoCompartido.includes(propietario) && archivoCompartido.includes(key)) {
                indicesParaEliminar.push(index);
                good = true;
              }
            });
            // Eliminar los índices recopilados de atrás hacia adelante para evitar desplazamientos de índice
            for (let i = indicesParaEliminar.length - 1; i >= 0; i--) {
              archivosCompartidos.splice(indicesParaEliminar[i], 1);
            }
            if (archivosCompartidos.length === 0) {
              delete compartido[key]; // Elimina la propiedad si ya no tiene archivos
            }
          });
        });
      });

      jsonData.usuarios.forEach(usuario => {
        // Verificar cada lista de compartidos
        usuario.compartido.forEach(compartido => {
          Object.keys(compartido).forEach(key => {
            const archivosCompartidos = compartido[key];
            const indicesParaEliminar = [];
            archivosCompartidos.forEach((archivoCompartido, index) => {
              // Verificar si el nombre del archivo compartido incluye el nombre base y los nombres de los usuarios involucrados
              if (archivoCompartido.includes(nombreBaseArchivo) && archivoCompartido.includes(propietario) && archivoCompartido.includes(key)) {
                indicesParaEliminar.push(index);
              }
            });
            // Eliminar los índices recopilados de atrás hacia adelante para evitar desplazamientos de índice
            for (let i = indicesParaEliminar.length - 1; i >= 0; i--) {
              archivosCompartidos.splice(indicesParaEliminar[i], 1);
            }
            if (archivosCompartidos.length === 0) {
              delete compartido[key]; // Elimina la propiedad si ya no tiene archivos
            }
          });
        });
        // Si después de procesar todos los compartidos el arreglo está vacío, significa que ya no hay más archivos compartidos con ese nombre base
        if (usuario.compartido.every(comp => Object.values(comp).every(arch => arch.length === 0))) {
          good = true;
        }
      });

      if (good) {
        // Escribir el JSON actualizado de nuevo en el archivo
        jsonData = cleanEmptyShares(jsonData); //borramos los corchetes vacíos. 
        fs.writeFile('./assets/db/usuarios.json', JSON.stringify(jsonData, null, 2), (err) => {
          if (err) {
            console.error("Error al escribir el archivo:", err);
            return res.status(500).json({ error: "Error al escribir el archivo de usuarios." });
          }
          
          res.status(200).json({ mensaje: 'Eliminado correctamente' });
        });
      } else {
        console.log("Archivo no encontrado en los registros compartidos");
        res.status(404).json({ error: 'Archivo no encontrado en los registros compartidos' });
      }
    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({ error: "Error al procesar la solicitud." });
    }
  });
});

function cleanEmptyShares(data) {
  data.usuarios.forEach(usuario => {
      // Filtramos los elementos del array `compartido` que no estén vacíos
      usuario.compartido = usuario.compartido.filter(compartido => Object.keys(compartido).length > 0);
  });
  return data;
}

//Actualiza la lista de compartidos de un archivo.
app.post('/compartir_archivos/:usuario/:usuarioCompartido/:titulo', verificarTokenMiddleware, (req, res) => {
  writeLogWithTimestamp(req.socket.remoteAddress, `Solicitud para almacenar archivos`);

  const usuarioNombre = req.params.usuario;
  const usuarioCompartido = req.params.usuarioCompartido;
  const titulo = req.params.titulo;
  const filePath = `./assets/files/${titulo}`;

  const fileStream = fs.createWriteStream(filePath);

  req.pipe(fileStream);

  fileStream.on('finish', () => {
    console.log('File has been written successfully.');
    fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
      if (err) {
        console.error("Error al leer el archivo:", err);
        return res.status(500).json({ error: "Error al leer el archivo de usuarios." });
      }

      try {
        const jsonData = JSON.parse(data);
        const usuarioActual = jsonData.usuarios.find(usuario => usuario.nombre === usuarioCompartido);

        if (!usuarioActual) {
          return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const indexUsuario = usuarioActual.compartido.findIndex(item => Object.keys(item)[0] === usuarioNombre);

        if (indexUsuario !== -1) {
          const tuplaCompartido = usuarioActual.compartido[indexUsuario];
          const archivosUsuario = tuplaCompartido[usuarioNombre];
          
          if (!archivosUsuario.includes(titulo)) {
            archivosUsuario.push(titulo);
          }
        } else {
          const nuevaEntrada = {};
          nuevaEntrada[usuarioNombre] = [titulo];
          usuarioActual.compartido.push(nuevaEntrada);
        }

        const nuevoContenido = JSON.stringify(jsonData, null, 2);

        fs.writeFile('./assets/db/usuarios.json', nuevoContenido, (err) => {
          if (err) {
            console.error('Error al escribir en el archivo:', err);
            return res.status(500).json({ error: "Error al escribir en el archivo de usuarios." });
          }
          res.status(200).json({ message: 'Archivo y clave almacenados exitosamente.' });
        });

      } catch (error) {
        console.error('Error al parsear el JSON:', error);
        res.status(500).json({ error: "Error interno al procesar el JSON de usuarios." });
      }
    });
  });

  fileStream.on('error', error => {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Error writing file'});
  });

  req.on('error', error => {
    console.error('Error in request stream:', error);
    res.status(500).json({ error: 'Error in request stream'});
  });
});

//obtener clave privada del usuario
app.get('/obtenerClavePrivada/:usuario' , (req, res)=>{
  const usuario = req.params.usuario;
  
  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error a la hora de leer el archivo de usuarios." });
    }

    try {
      const jsonData = JSON.parse(data);

      const user = jsonData.usuarios.find(usu => usu.nombre === usuario);
      return res.status(200).json({clavePrivadaCifrada: user.clavePrivadaRSA});

    }catch(error){
      return res.status(500).json({error: `No se ha podido obtener la clave privada cifrada del usuario ${usuario}`});
    }  
  });
});

//Elimina un archivo y los que tiene asociado
app.get('/eliminar_archivo/:usuario/:archivo', verificarTokenMiddleware, (req, res) => {
  const archivoo = req.params.archivo;
  const usuario = req.params.usuario;

  fs.readFile('./assets/db/usuarios.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error al leer el archivo:", err);
      return res.status(500).json({ error: "Error a la hora de leer el archivo de usuarios." });
    }

    try {
      const jsonData = JSON.parse(data);

      const propietario = jsonData.usuarios.find(user => user.nombre === usuario);
      const indiceFin = archivoo.indexOf(".");
      const nombreArchivo = archivoo.substring(0, indiceFin + 1);

      // Eliminar archivo del propietario
      for (let i = propietario.archivos.length - 1; i >= 0; i--) {
        const archivo = propietario.archivos[i];
        const indiceInicio1 = archivo.indexOf("_");
        const indiceFin1 = archivo.indexOf(".");
        const archivoAlmacenado = archivo.substring(indiceInicio1, indiceFin1 + 1);
        if (archivoAlmacenado === ('_' + nombreArchivo)) {
          propietario.archivos.splice(i, 1);
        }
      }

      // Eliminar archivo de otros usuarios compartidos
      const otrosUsuarios = jsonData.usuarios.filter(user => user.nombre !== usuario);
      otrosUsuarios.forEach(otroUsuario => {
        otroUsuario.compartido.forEach(compartido => {
          const nombresCompartidos = Object.keys(compartido);
          nombresCompartidos.forEach(nombreCompartido => {
            const archivosCompartidos = compartido[nombreCompartido];
            for (let i = archivosCompartidos.length - 1; i >= 0; i--) {
              const archivo = archivosCompartidos[i];
              const indiceInicio1 = archivo.indexOf("_");
              const indiceFin1 = archivo.indexOf(".");
              const archivoCompartido = archivo.substring(indiceInicio1, indiceFin1 + 1);
              if (archivoCompartido === ('_' + nombreArchivo)) {
                archivosCompartidos.splice(i, 1);
              }
            }
          });
        });
      });

            // Eliminar archivos físicos
      const filesDirectory = path.join(__dirname, 'assets', 'files');
      fs.readdir(filesDirectory, (err, files) => {
        if (err) {
          console.error("Error al leer el directorio de archivos:", err);
          return res.status(500).json({ error: "Error al leer el directorio de archivos." });
        }
        files.forEach(file => {
          if (file.includes('_' + nombreArchivo)) {
            const filePath = path.join(filesDirectory, file);
            fs.unlink(filePath, err => {
              if (err) {
                console.error("Error al eliminar el archivo físico:", err);
              } else {
                console.log('Archivo físico eliminado:', file);
              }
            });
          }
        });
      });

      // Escribir los cambios en el archivo JSON
      fs.writeFile('./assets/db/usuarios.json', JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          console.error("Error al escribir el archivo:", err);
          return res.status(500).json({ error: "Error al escribir el archivo de usuarios." });
        }
        res.status(200).json({ mensaje: 'Eliminado correctamente' });
      });

    } catch (error) {
      console.error("Error al parsear el JSON:", error);
      res.status(500).json({ error: "Error al procesar la solicitud." });
    }
  });
});


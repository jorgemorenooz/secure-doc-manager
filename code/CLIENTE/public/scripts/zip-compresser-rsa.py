# pip install pycryptodome

import sys
import json
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP, PKCS1_OAEP
from base64 import b64decode
from Crypto.Util.Padding import pad, unpad
import os

def encrypt(zipName, zipName_Encrypted, public_key_file):
    # Leer la clave pública del archivo JSON
    with open(public_key_file, 'r') as f:
        public_key_data = json.load(f)
        public_key_str = public_key_data['key']
        
        # Importar la clave pública RSA
        public_key = RSA.import_key(public_key_str)


    # Configurar el cifrado RSA con relleno OAEP
    cifrado = PKCS1_OAEP.new(public_key)

    # Leer el contenido del archivo ZIP original
    with open(zipName, 'rb') as f:
        textoClaro = f.read()

    # Cifrar el texto plano
    textoCifrado = cifrado.encrypt(textoClaro)

    # Escribir el texto cifrado en un nuevo archivo
    with open(zipName_Encrypted, 'wb') as f:
        f.write(textoCifrado)
    
def decrypt(encrypted_file, decrypted_file, private_key_file):
    # Leer la clave privada
    with open(private_key_file, 'rb') as f:
        private_key_data = json.load(f)
        private_key_str = private_key_data['key']
        #print(private_key_str)

        private_key = RSA.import_key(private_key_str)

    # Configurar un nuevo objeto para descifrar usando la clave privada
    descifrado = PKCS1_OAEP.new(private_key)

    # Leer el contenido del archivo cifrado
    with open(encrypted_file, 'rb') as f:
        textoCifrado = f.read()

    # Descifrar el texto cifrado
    textoClaro = descifrado.decrypt(textoCifrado)

    # Escribir el texto plano en un nuevo archivo
    with open(decrypted_file, 'wb') as f:
        f.write(textoClaro)
    
    print(decrypted_file) #CUTRE! Pero es la única manera que he encontrado de devolver un valor a Node de vuelta. El return no parece funcionar. 
    return decrypted_file

zipName = sys.argv[1]
zipName_Encrypted = zipName + '.enc'
option = sys.argv[3]

if option == '-e':
    public_key_file = sys.argv[2]    
    encrypt(zipName, zipName_Encrypted, public_key_file)

elif option == '-d':
    private_key_file = sys.argv[2]
    zipName_Encrypted = zipName
    decrypted = zipName.split('.zip')[0] + '_decrypted.zip.json'
    rutaClave = decrypt(zipName_Encrypted, decrypted, private_key_file)


# la llamada sería algo así:
# python3 zip-compresser-rsa.py [archivo] [clave_publica] [clave_privada] [opciones/modo]
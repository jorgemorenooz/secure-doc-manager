# pip install pycryptodome

import sys
import json
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import os
  
def decrypt(encrypted_file, decrypted_file, password):
    # Leer el contenido del archivo cifrado
    with open(encrypted_file, 'rb') as f:
        textoCifrado = f.read()

    # Extraer el IV del comienzo del archivo cifrado
    iv = textoCifrado[:16]
    #iv = get_random_bytes(16)
    textoCifrado = textoCifrado[16:]

    print("Tamaño del archivo cifrado:", os.path.getsize(encrypted_file))
    print(len(iv))

    # Configurar un nuevo objeto AES para descifrar usando la misma contraseña y IV
    cifrado = AES.new(password, AES.MODE_CBC,iv)

    # Descifrar el texto cifrado
    textoClaro = cifrado.decrypt(textoCifrado)

    # Eliminar el relleno agregado durante el cifrado
    padding_length = textoClaro[-1]
    textoClaro = textoClaro[:-padding_length]

    # Escribir el texto plano en un nuevo archivo
    with open(decrypted_file, 'wb') as f:
        f.write(textoClaro)

zipName_Encrypted = sys.argv[1]
password_file = sys.argv[2]
desencriptado = sys.argv[3]


with open(password_file) as file:
    info_keys = json.load(file)
    password = info_keys['key']

    #hay que pasar la key a formato bytes
    key_bytes = password.encode('utf-8')

assert os.path.isfile(zipName_Encrypted)
decrypt(zipName_Encrypted, desencriptado, key_bytes)
    
# https://pycryptodome.readthedocs.io/en/latest/src/cipher/aes.html
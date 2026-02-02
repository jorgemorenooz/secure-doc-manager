# pip install pycryptodome

import sys
import json
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

def encrypt(zipName, zipName_Encrypted, password):
    # Generar un IV aleatorio de 16 bytes
    iv = get_random_bytes(16)

    # Configurar el cifrado AES con modo CBC
    cifrado = AES.new(password, AES.MODE_CBC, iv)

    # Leer el contenido del archivo ZIP original
    with open(zipName, 'rb') as f:
        textoClaro = f.read()

    # Calcular el tamaño del relleno para hacer que la longitud sea un múltiplo de 16
    #? Al parecer si no se le mete esto el bloque tendría que ser exacto (no lo es)
    padding_length = 16 - (len(textoClaro) % 16)
    padded_textoClaro = textoClaro + bytes([padding_length] * padding_length)

    # Cifrar el texto plano
    textoCifrado = iv + cifrado.encrypt(padded_textoClaro)

    # Escribir el texto cifrado en un nuevo archivo ZIP
    with open(zipName_Encrypted, 'wb') as f:
        f.write(textoCifrado)
        
def decrypt(encrypted_file, decrypted_file, password):
    # Leer el contenido del archivo cifrado
    with open(encrypted_file, 'rb') as f:
        textoCifrado = f.read()

    # Extraer el IV del comienzo del archivo cifrado
    iv = textoCifrado[:16]
    textoCifrado = textoCifrado[16:]

    # Configurar un nuevo objeto AES para descifrar usando la misma contraseña y IV
    cifrado = AES.new(password, AES.MODE_CBC, iv)

    # Descifrar el texto cifrado
    textoClaro = cifrado.decrypt(textoCifrado)

    # Eliminar el relleno agregado durante el cifrado
    padding_length = textoClaro[-1]
    textoClaro = textoClaro[:-padding_length]

    # Escribir el texto plano en un nuevo archivo
    with open(decrypted_file, 'wb') as f:
        f.write(textoClaro)

zipName = sys.argv[1]
password_file = sys.argv[2]
zipName_Encrypted = zipName + '.enc'
option = sys.argv[3]

if(option != '-i'):
    with open(password_file) as file:
        info_keys = json.load(file)
        password = info_keys['key']

        #hay que pasar la key a formato bytes
        key_bytes = password.encode('utf-8')
    

if(option == '-e'):
    encrypt(zipName, zipName_Encrypted, key_bytes)
elif(option == '-d'):
    zipName_Encrypted = zipName
    desencriptado = zipName.split('.zip')[0] + '.zip'
    decrypt(zipName_Encrypted, desencriptado, key_bytes)
elif(option == '-i'):
    zipName_Encrypted = zipName
    desencriptado = zipName.split('.zip')[0] + '.zip'
    password = sys.argv[2]
    key_bytes = password.encode('utf-8')
    key_bytes = key_bytes.ljust(32, b' ')[:32]
    decrypt(zipName_Encrypted, desencriptado, key_bytes)
    
# https://pycryptodome.readthedocs.io/en/latest/src/cipher/aes.html
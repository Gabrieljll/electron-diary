# electron-diary

## Pasos para instalación y ejecución

### Requisitos
1.  Node.js v16.15.1
2.  Mysql Server

### Configuración de la DB
1. Importar dump que se encuentra en: `/dump/electron_diary.sql`, a nuestra base de datos
2. Copiar el archivo `.env.dist` y pegarlo en la misma ubicación con el nombre `.env`
3. Configurar el archivo `.env` con los datos correspondientes, de la siguiente forma:

    ```bash
    DB_HOST='host de la db'
    DB_USER='usuario con acceso'
    DB_PASSWORD='clave de usuario'
    DB_NAME='nombre de la db'
    ```
### Instalación de dependencias
- Abrir una terminal en el directorio root de la aplicación (`/electron-diary`) y ejecutar el siguiente comando:

    ```bash
    npm install
    ```
### Ejecución de app
- Abrir una terminal en el directorio root de la aplicación (`/electron-diary`) y ejecutar el siguiente comando:
    ```bash
        npm start
    ```

### Generar instalador (Opcional)

#### Abrir una terminal en el directorio root de la aplicación (`/electron-diary`) y ejecutar el siguiente comando:

- En caso de generar en Windows
    ```bash
        electron-builder --win --x64
    ```
- En caso de generar en Linux
    ```bash
        electron-builder --linux --x64
    ```

## Fin
const {createWindow} = require('./main')
const {app} = require('electron')
require('./database')

//reiniciar cada vez que se guarda un cambio en el código
require('electron-reload')(__dirname)

app.allowRendererProcessReuse = false;
app.whenReady().then(createWindow);

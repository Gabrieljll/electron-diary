const { remote, ipcRenderer } = require('electron');

module.exports = {
  main: remote.require('./main'),
  ipcRenderer: ipcRenderer
};
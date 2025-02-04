const { app, BrowserWindow, WebContentsView} = require('electron')
const path = require('path')
const processMonitor = require('../src/index')

const createWindow = (title) => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // electron 20 以后，这里必须手动指定，https://github.com/electron/electron/pull/35125
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      // preload: __dirname + '/preload.js',
    }
  })

  win.loadFile('index.html')
  setTimeout(() => {
    win.setTitle(title)
  }, 1000)
  return win
}

/** 创建 WebContentsView */
const createWebContentsView = (win) => {
  const view = new WebContentsView({
    webPreferences: {
      // electron 20 以后，这里必须手动指定，https://github.com/electron/electron/pull/35125
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      // preload: __dirname + '/preload.js',
    },})
    console.log('View created')
  view.setBounds({ x: 0, y: 100, width: 800, height: 500 })
  win.contentView.addChildView(view)
  view.webContents.loadFile(path.join(__dirname, 'webcontentview.html'))
  // 监听加载完成事件
  view.webContents.on('did-finish-load', () => {
    console.log('WebContents loaded successfully')
  })
  
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorDescription)
  })
}


app.whenReady().then(() => {
  const win1 = createWindow('demo')
  const win2 = createWindow('demo2')
  const win3 = createWindow('demo3')
  createWebContentsView(win1)
  createWebContentsView(win2)
  createWebContentsView(win3)

  processMonitor.open()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
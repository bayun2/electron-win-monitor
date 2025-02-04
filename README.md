electron 应用进程监控器

用于开发阶段在使用 BrowserWindow 和 WebContentsView 时，关注多进程的内存、CPU 使用情况，以及方便的唤起对应进程的 devtools 进行调试。


## 使用

```bash
npm install electron-process-monitor
```

在 electron 项目的 main.js 中引入

```js
const processMonitor = require('electron-process-monitor')
processMonitor.open()
```

demo 目录下有参考，效果如下

![image](./demo/demo.gif)
electron 应用进程监控器

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
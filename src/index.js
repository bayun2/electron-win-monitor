const { BrowserWindow, ipcMain, app, webContents } = require('electron');
const path = require('path');
const psList = (...args) => import('ps-list').then(module => module.default(...args));

class ProcessMonitor {
    constructor() {
        this.window = null;
        // 获取主应用的路径
        this.lastCPUTimes = new Map(); // 存储上一次的 CPU 时间

        // 添加 IPC 监听器
        ipcMain.on('open-devtools', (_, webContentsId) => {
          const contents = webContents.fromId(webContentsId);
          console.log('contents', contents);
          if (contents) {
              contents.openDevTools();
          }
        });
    }

    // 计算 CPU 使用率
    async calculateCPUUsage(pid, currentCPUTime) {
        const lastCPUTime = this.lastCPUTimes.get(pid) || currentCPUTime;
        this.lastCPUTimes.set(pid, currentCPUTime);
        
        const cpuDiff = currentCPUTime - lastCPUTime;
        const timeDiff = 1000; // 我们的更新间隔是 1 秒
        return ((cpuDiff / timeDiff) * 100).toFixed(1);
    }

    // 格式化内存大小
    formatMemory(bytes) {
        const mb = bytes / (1024 * 1024);
        return `${Math.round(mb)} MB`;
    }

    async getProcessMemoryInfo(win) {
        try {
            const memoryInfo = await win.webContents.getProcessMemoryInfo();
            // 返回私有内存使用量（以字节为单位）
            return memoryInfo.private;
        } catch (error) {
            console.error('Error getting memory info:', error);
            return 0;
        }
    }

    buildProcessTree(processes) {
        // 创建进程树结构
        const processMap = new Map();
        const rootProcesses = [];

        // 首先创建所有进程节点
        processes.forEach(proc => {
            proc.children = [];
            processMap.set(proc.pid, proc);
        });

        // 构建树结构
        processes.forEach(proc => {
            if (processMap.has(proc.parentPid)) {
                const parent = processMap.get(proc.parentPid);
                parent.children.push(proc);
            } else {
                rootProcesses.push(proc);
            }
        });

        return rootProcesses;
    }

    async findParentPid(pid) {
        try {
            const processes = await psList();
            const process = processes.find(p => p.pid === pid);
            return process ? process.ppid : null;
        } catch (error) {
            console.error('Error getting parent pid:', error);
            return null;
        }
    }

    async getProcessInfo() {
        const processes = await app.getAppMetrics();
        const processesWithChildren = [];
        const processMap = new Map();
        let processInfoMap

        // 获取所有系统进程信息
        let allProcesses = [];
        try {
            allProcesses = await psList();
            // 创建一个查找映射，方便后续使用
            processInfoMap = new Map(
                allProcesses.map(proc => [proc.pid, proc])
            );
        } catch (error) {
            console.error('Error getting process list:', error);
        }

        processes.forEach(process => {
            // 从系统进程列表中获取对应进程的额外信息
            const systemProcessInfo = processInfoMap.get(process.pid) || {};
            
            const processInfo = {
                pid: process.pid,
                type: process.type,
                cpu: process.cpu.percentCPUUsage.toFixed(1) + '%',
                memory: (process.memory.workingSetSize / (1024)).toFixed(1) + ' MB',
                sandboxed: process.sandboxed,
                name: systemProcessInfo.name || process.type, // 使用系统进程名称，如果没有则使用 type
                started: new Date(process.creationTime).toLocaleTimeString(),
                state: 'running',
                children: [],
                parentPid: systemProcessInfo.ppid || null,
                webContentsId: '-',
                winId: '-'
            };

            if (process.type === 'Tab') {
                const allWebContents = webContents.getAllWebContents();
                // console.log('allWebContents', allWebContents.map(wc => wc.getOSProcessId() ));
                const webContent = allWebContents.find(wc => wc.getOSProcessId() === process.pid);
                if (webContent) {
                    processInfo.webContentsId = webContent.id.toString();
                    let win = BrowserWindow.fromWebContents(webContent);
                    // 如果没有找到窗口，尝试在所有窗口的 BrowserViews 中查找
                    if (!win) {
                      const allWindows = BrowserWindow.getAllWindows();
                      for (const window of allWindows) {
                        const views = window.getBrowserViews();
                        console.log('Window ID:', window.id, 'Views count:', views.length);
                        console.log('Views webContents IDs:', views.map(v => v.webContents.id));
                          if (views.some(view => view.webContents.id === webContent.id)) {
                              win = window;
                              console.log('Found matching window:', window.id);
                              break;
                          }
                      }
                    }
                    if (win) {
                      processInfo.winId = win.id.toString();
                    }
                }
            }

            processMap.set(process.pid, processInfo);
            processesWithChildren.push(processInfo);
        });

        // Build process tree
        processesWithChildren.forEach(process => {
            if (process.parentPid) {
                const parentProcess = processMap.get(process.parentPid);
                if (parentProcess) {
                    parentProcess.children.push(process);
                }
            }
        });

        // Filter to only return root processes (those without parents in our list)
        return processesWithChildren.filter(process => !process.parentPid || !processMap.has(process.parentPid));
    }

    open() {
        if (this.window) {
            this.window.focus();
            return;
        }

        this.window = new BrowserWindow({
            width: 930,
            height: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        this.window.loadFile(path.join(__dirname, 'monitor.html'));
        this.window.on('closed', () => {
            this.window = null;
        });

        // 开始定期更新进程数据
        this.startMonitoring();
    }

    startMonitoring() {
        const updateInterval = setInterval(async () => {
            if (!this.window) {
                clearInterval(updateInterval);
                return;
            }

            const processData = await this.getProcessInfo();
            this.window.webContents.send('update-process-data', processData);
        }, 1000);
    }
}

module.exports = new ProcessMonitor();

// workOrders.js — 内容工单数据层（主进程）
// 读取 brand-content 仓库的 orders/*/manifest.json 与工单资产文件，
// 供内容工坊/工作台渲染。管线本体（写稿/核查/发布）仍由 Hermes CLI 执行，
// 这里只做承接与呈现。
import { ipcMain } from "electron";
import fs from "fs";
import path from "path";

// 设置存储：工单目录路径（默认指向管线仓库）
const SETTINGS_KEY = "workOrderRoot";
function getWorkOrderRoot() {
  const app = require("electron").app;
  const p = path.join(app.getPath("userData"), "workbench-settings.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(p, "utf-8"));
    return cfg[SETTINGS_KEY] || path.join(process.env.HOME || "", "Projects/brand-content/orders");
  } catch (_) {
    return path.join(process.env.HOME || "", "Projects/brand-content/orders");
  }
}

function setWorkOrderRoot(dir) {
  const app = require("electron").app;
  const p = path.join(app.getPath("userData"), "workbench-settings.json");
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(p, "utf-8")); } catch (_) {}
  cfg[SETTINGS_KEY] = dir;
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

// 状态 → 界面分组
const GROUPS = {
  SELECTED: "进行中",
  DRAFTING: "进行中",
  CHECKED: "待把关", // gate② 审读定稿
  FINAL: "待把关", // 等待包装确认（简化视图归入待把关）
  PACKAGED: "草稿箱", // 已推草稿箱（xhs/gzh draft）
  PUBLISHED: "已发布",
  EVIDENCE_READY: "进行中",
  READBACK: "已发布",
  ARCHIVED: "已归档",
};

function listOrderDirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{8}_/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();
}

function readOrder(root, id) {
  const dir = path.join(root, id);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    return { id, error: "manifest 解析失败: " + e.message };
  }
  // 资产清单（存在的才返回）
  const assets = {};
  const assetFiles = {
    selection: ["01_选题卡.md", "01_选题卡.yaml"],
    draft: ["02_初稿.md"],
    titles: ["03_标题候选.md"],
    check: ["04_核查报告.md"],
    final: ["05_定稿.md"],
  };
  for (const [key, names] of Object.entries(assetFiles)) {
    for (const n of names) {
      const fp = path.join(dir, n);
      if (fs.existsSync(fp)) {
        assets[key] = { file: n, content: fs.readFileSync(fp, "utf-8") };
        break;
      }
    }
  }
  // 发布包
  const pkgDir = path.join(dir, "06_发布包");
  const pkg = { files: [] };
  if (fs.existsSync(pkgDir)) {
    pkg.files = fs
      .readdirSync(pkgDir)
      .filter((f) => !f.startsWith("."))
      .map((f) => {
        const fp = path.join(pkgDir, f);
        const st = fs.statSync(fp);
        return { name: f, size: st.size, isImage: /\.(png|jpe?g|webp|gif)$/i.test(f) };
      });
  }
  return { id, manifest, assets, pkg, dir };
}

function listOrders(root) {
  const out = [];
  for (const id of listOrderDirs(root)) {
    const dir = path.join(root, id);
    const mp = path.join(dir, "manifest.json");
    if (!fs.existsSync(mp)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mp, "utf-8"));
      out.push({
        id,
        title: m.title || id,
        line: m.line || "hotspot",
        column: m.column || "",
        state: m.state || "SELECTED",
        group: GROUPS[m.state] || "进行中",
        updatedAt: m.updated_at || null,
        channels: m.channels || [],
        gateHistory: m.gate_history || [],
      });
    } catch (_) {
      /* 跳过坏 manifest */
    }
  }
  return out;
}

export function registerWorkOrderIpc() {
  ipcMain.handle("workorders:list", async () => {
    const root = getWorkOrderRoot();
    return { root, orders: listOrders(root) };
  });

  ipcMain.handle("workorders:detail", async (_e, orderId) => {
    return readOrder(getWorkOrderRoot(), orderId);
  });

  ipcMain.handle("workorders:getRoot", async () => getWorkOrderRoot());

  ipcMain.handle("workorders:setRoot", async (_e, dir) => {
    if (!dir || !fs.existsSync(dir)) return { ok: false, error: "目录不存在: " + dir };
    setWorkOrderRoot(dir);
    return { ok: true };
  });

  // gate 操作：通过 order.py 状态机执行（唯一写路径，保证 gate 留痕）
  ipcMain.handle("workorders:advance", async (_e, { orderId, target, gate, by, note }) => {
    const { execFile } = require("child_process");
    const root = getWorkOrderRoot();
    const repoDir = path.dirname(root); // orders 的上级 = 仓库根
    const py = path.join(repoDir, ".venv/bin/python");
    const script = path.join(repoDir, "scripts/order.py");
    if (!fs.existsSync(py) || !fs.existsSync(script)) {
      return { ok: false, error: `状态机脚本不存在: ${script}` };
    }
    const args = ["scripts/order.py", "advance", orderId, target];
    if (gate) args.push("--gate", gate);
    args.push("--by", by || "matrixmedia-gui");
    if (note) args.push("--note", note);
    return new Promise((resolve) => {
      execFile(py, args, { cwd: repoDir, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, error: (stderr || err.message).slice(0, 500) });
        } else {
          resolve({ ok: true, output: stdout.slice(0, 500) });
        }
      });
    });
  });
}

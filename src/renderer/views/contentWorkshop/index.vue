<template>
  <div class="page-shell workshop-page">
    <div class="page-header">
      <h1 class="page-title">内容工坊</h1>
      <p class="page-desc">图文工单从选题到草稿箱的全生命周期。机器跑流程，你只出现在三个关口。</p>
    </div>

    <div class="workshop-body">
      <!-- 左栏：工单列表 -->
      <div class="wo-list" v-loading="loading">
        <div v-if="rootMissing" class="wo-root-missing">
          <p>还没找到工单目录</p>
          <el-button size="small" type="primary" plain @click="showRootDialog = true">设置工单目录</el-button>
        </div>
        <template v-else>
          <div v-for="g in groups" :key="g.name" class="wo-group">
            <div class="wo-group-head" :class="{ 'has-urgent': g.name === '待把关' && g.items.length }">
              {{ g.name }}
              <span class="wo-group-count">{{ g.items.length }}</span>
            </div>
            <div
              v-for="o in g.items"
              :key="o.id"
              class="wo-item"
              :class="{ active: current && current.id === o.id }"
              @click="openOrder(o.id)"
            >
              <div class="wo-item-title">{{ o.title }}</div>
              <div class="wo-item-meta">
                <span class="wo-line" :class="o.line">{{ o.line === "company" ? "公司线" : "热点线" }}</span>
                <span class="mono-num">{{ o.updatedAt ? o.updatedAt.slice(0, 10) : "" }}</span>
              </div>
            </div>
            <div v-if="!g.items.length" class="wo-group-empty">{{ emptyHint(g.name) }}</div>
          </div>
        </template>
      </div>

      <!-- 右栏：工单详情 -->
      <div class="wo-detail">
        <template v-if="current">
          <div class="wo-detail-head">
            <div>
              <div class="wo-detail-title">{{ current.title }}</div>
              <div class="wo-detail-sub">
                <span class="wo-line" :class="current.line">{{ current.line === "company" ? "公司线" : "热点线" }}</span>
                <span v-if="current.column" class="wo-column">{{ current.column }}</span>
                <span class="mono-num">{{ current.id }}</span>
              </div>
            </div>
            <span class="wo-state" :class="stateClass(current.state)">{{ stateText(current.state) }}</span>
          </div>

          <!-- 资产折叠卡片 -->
          <div class="wo-assets">
            <div v-for="a in assetCards" :key="a.key" class="wo-asset">
              <div class="wo-asset-head" @click="toggleAsset(a.key)">
                <span class="wo-asset-caret" :class="{ open: openedAssets[a.key] }">▸</span>
                {{ a.label }}
                <span class="wo-asset-file mono-num">{{ a.file }}</span>
              </div>
              <pre v-show="openedAssets[a.key]" class="wo-asset-body">{{ a.content }}</pre>
            </div>
          </div>

          <!-- 发布包 -->
          <div v-if="current.pkg && current.pkg.files.length" class="wo-pkg">
            <div class="wo-sec-title">发布包 <span class="mono-num">{{ current.pkg.files.length }} 个文件</span></div>
            <div class="wo-pkg-grid">
              <div v-for="f in current.pkg.files" :key="f.name" class="wo-pkg-file" @click="previewPkgFile(f)">
                <img v-if="f.isImage" :src="pkgFileUrl(f.name)" class="wo-pkg-img" />
                <span v-else class="wo-pkg-name">{{ f.name }}</span>
              </div>
            </div>
          </div>

          <!-- 发布回执 -->
          <div v-if="current.channels && current.channels.length" class="wo-channels">
            <div class="wo-sec-title">发布回执</div>
            <div v-for="(c, i) in current.channels" :key="i" class="wo-channel-row">
              <span class="wo-channel-target">{{ channelLabel(c.target) }}</span>
              <span class="wo-channel-status" :class="c.status">{{ channelStatusText(c.status) }}</span>
              <span class="mono-num">{{ c.ref || "" }}</span>
              <span class="wo-channel-time mono-num">{{ shortTime(c.request_id) }}</span>
            </div>
          </div>

          <!-- 底部动作条：一个状态只有一个主动作 -->
          <div class="wo-actionbar">
            <span class="wo-action-hint">{{ actionHint }}</span>
            <el-button
              v-if="nextAction"
              :type="nextAction.type"
              size="medium"
              @click="doNextAction"
            >{{ nextAction.label }}</el-button>
          </div>
        </template>
        <div v-else-if="!loading" class="wo-detail-empty">
          <p>左边选一张工单</p>
          <p class="wo-detail-empty-sub">进行中的会显示走到哪一步、卡在谁手里；草稿箱里的可以直接去发布。</p>
        </div>
      </div>
    </div>

    <!-- 工单目录设置 -->
    <el-dialog title="工单目录" :visible.sync="showRootDialog" width="480px" append-to-body>
      <el-input v-model="rootInput" placeholder="orders 目录的绝对路径，如 /Users/xxx/Projects/brand-content/orders" />
      <p class="wo-root-hint">指向 brand-content 仓库的 orders/ 目录。工单由 Hermes CLI 管线生成，这里只读。</p>
      <span slot="footer">
        <el-button @click="showRootDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRoot">保存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: "ContentWorkshop",
  data() {
    return {
      loading: false,
      root: "",
      orders: [],
      current: null,
      openedAssets: {},
      showRootDialog: false,
      rootInput: "",
      channelNames: { "xhs-draft": "小红书草稿箱", "gzh-draft": "公众号草稿箱", "gzh-html": "公众号（HTML 粘贴）" },
    };
  },
  computed: {
    rootMissing() {
      return !this.loading && !this.orders.length && !this.root;
    },
    groups() {
      const names = ["待把关", "进行中", "草稿箱", "已发布", "已归档"];
      return names.map((name) => ({
        name,
        items: this.orders.filter((o) => o.group === name),
      }));
    },
    assetCards() {
      if (!this.current || !this.current.assets) return [];
      const map = [
        ["selection", "选题卡"],
        ["draft", "初稿"],
        ["titles", "标题候选"],
        ["check", "核查报告"],
        ["final", "定稿"],
      ];
      return map
        .filter(([key]) => this.current.assets[key])
        .map(([key, label]) => ({
          key,
          label,
          file: this.current.assets[key].file,
          content: this.current.assets[key].content,
        }));
    },
    nextAction() {
      const s = this.current && this.current.state;
      if (s === "CHECKED") return { label: "通过并定稿", type: "primary", act: { target: "FINAL", gate: "final_review" } };
      if (s === "FINAL") return { label: "通过并包装", type: "primary", act: { target: "PACKAGED" } };
      return null; // PACKAGED/进行中：动作在管线或渠道页，这里只读
    },
    actionHint() {
      const s = this.current && this.current.state;
      if (s === "SELECTED" || s === "DRAFTING" || s === "EVIDENCE_READY") return "机器在跑，写完会回到待把关";
      if (s === "CHECKED") return "核查已过，你审读后决定";
      if (s === "FINAL") return "定稿确认后进发布包";
      if (s === "PACKAGED") return "已入草稿箱，发布键在平台侧由你按";
      return "";
    },
  },
  async mounted() {
    await this.loadOrders();
  },
  methods: {
    getIpc() {
      try {
        // eslint-disable-next-line
        const { ipcRenderer } = require("electron");
        return ipcRenderer;
      } catch (_) {
        return null;
      }
    },
    async loadOrders() {
      const ipc = this.getIpc();
      if (!ipc) return;
      this.loading = true;
      try {
        const data = await ipc.invoke("workorders:list");
        if (data) {
          this.root = data.root;
          this.orders = data.orders || [];
        }
      } finally {
        this.loading = false;
      }
      if (this.orders.length && !this.current) {
        // 默认打开待把关的第一张，否则最新一张
        const urgent = this.orders.find((o) => o.group === "待把关");
        this.openOrder((urgent || this.orders[0]).id);
      }
    },
    async openOrder(id) {
      const ipc = this.getIpc();
      if (!ipc) return;
      this.current = await ipc.invoke("workorders:detail", id);
      this.openedAssets = {};
    },
    toggleAsset(key) {
      this.openedAssets[key] = !this.openedAssets[key];
    },
    pkgFileUrl(name) {
      return "file://" + this.current.dir + "/06_发布包/" + encodeURIComponent(name);
    },
    previewPkgFile() {/* M3: 详情预览 */},
    channelLabel(t) { return this.channelNames[t] || t; },
    channelStatusText(s) { return s === "pushed" ? "已推入" : s; },
    shortTime(requestId) {
      const m = (requestId || "").match(/updated_at["']?[:\s]*([^"]*)/);
      return m ? m[1].slice(0, 16).replace("T", " ") : "";
    },
    stateText(s) {
      return { SELECTED: "待确认", DRAFTING: "写稿中", EVIDENCE_READY: "证据已备", CHECKED: "待你审读", FINAL: "待包装", PACKAGED: "草稿箱", PUBLISHED: "已发布", READBACK: "已回读", ARCHIVED: "已归档" }[s] || s;
    },
    stateClass(s) {
      return { CHECKED: "warn", FINAL: "warn", PACKAGED: "ok" }[s] || "idle";
    },
    emptyHint(name) {
      return { 待把关: "没有要你拍板的", 进行中: "机器空闲", 草稿箱: "还没有成品" }[name] || "空";
    },
    async doNextAction() {
      const ipc = this.getIpc();
      if (!ipc) return;
      const { label, act } = this.nextAction;
      const needNote = act.target === "FINAL"; // 定稿确认是 gate②，留痕
      let note = "matrixmedia GUI 确认";
      if (needNote) {
        const input = await this.$prompt("确认这篇定稿？可填写审读备注（可留空）", "审读定稿", { inputValue: "", confirmButtonText: "通过", cancelButtonText: "再看看" }).catch(() => null);
        if (!input) return;
        note = input.value || note;
      }
      const r = await ipc.invoke("workorders:advance", { orderId: this.current.id, ...act, by: "matrixmedia-gui", note });
      if (r.ok) {
        this.$message.success(label + "完成");
        await this.loadOrders();
        await this.openOrder(this.current.id);
      } else {
        this.$message.error(r.error || "操作失败：" + label);
      }
    },
    async saveRoot() {
      const ipc = window.require("electron").ipcRenderer;
      const r = await ipc.invoke("workorders:setRoot", this.rootInput.trim());
      if (r.ok) {
        this.showRootDialog = false;
        this.current = null;
        await this.loadOrders();
      } else {
        this.$message.error(r.error);
      }
    },
  },
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@import "@/styles/variables.scss";

.workshop-page { display: flex; flex-direction: column; height: 100%; }
.workshop-body { flex: 1; min-height: 0; display: flex; gap: 18px; }

/* 左栏 */
.wo-list { width: 300px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid $line2; padding-right: 16px; }
.wo-group { margin-bottom: 18px; }
.wo-group-head {
  font-size: 12px; color: $ink3; letter-spacing: 1px; margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
  &.has-urgent { color: $warnColor; font-weight: 600; }
}
.wo-group-count { font-family: $mono; font-size: 11px; background: var(--line-2, #eef0f2); border-radius: 8px; padding: 0 6px; }
.wo-group.has-urgent .wo-group-count { background: $warnDim; }
.wo-group-empty { font-size: 12px; color: #b0b6bf; padding: 4px 10px; }
.wo-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 2px;
  border: 1px solid transparent;
  &:hover { background: #f0f0ec; }
  &.active { background: $accentDim; border-color: #c6d6ff; }
}
.wo-item-title { font-size: 13.5px; color: $ink; line-height: 1.45; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.wo-item-meta { margin-top: 5px; display: flex; gap: 8px; align-items: center; }
.wo-line { font-size: 11px; padding: 0 6px; border-radius: 4px; font-weight: 550; &.company { background: $accentDim; color: #2f6bff; } &.hotspot { background: $warnDim; color: $warnColor; } }
.wo-column { font-size: 11px; color: $ink3; }
.wo-root-missing { text-align: center; padding: 40px 12px; color: $ink3; p { margin-bottom: 12px; font-size: 13px; } }

/* 右栏 */
.wo-detail { flex: 1; min-width: 0; overflow-y: auto; display: flex; flex-direction: column; }
.wo-detail-empty { margin: auto; text-align: center; color: $ink3; font-size: 14px; }
.wo-detail-empty-sub { font-size: 12.5px; margin-top: 6px; color: #b0b6bf; }
.wo-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.wo-detail-title { font-size: 17px; font-weight: 650; color: $ink; line-height: 1.4; }
.wo-detail-sub { margin-top: 6px; display: flex; gap: 10px; align-items: center; }
.wo-state { font-size: 12px; padding: 3px 10px; border-radius: 12px; font-weight: 600; white-space: nowrap;
  &.ok { background: $okDim; color: $okColor; }
  &.warn { background: $warnDim; color: $warnColor; }
  &.idle { background: #eef0f2; color: $ink3; }
}
.wo-sec-title { font-size: 13px; font-weight: 600; color: $ink2; margin: 18px 0 8px; }

/* 资产折叠 */
.wo-asset { border: 1px solid $line2; border-radius: 8px; margin-bottom: 6px; background: #fff; }
.wo-asset-head { padding: 9px 14px; cursor: pointer; font-size: 13px; color: $ink2; display: flex; align-items: center; gap: 8px; user-select: none;
  &:hover { background: #fafaf8; } }
.wo-asset-caret { display: inline-block; transition: transform .15s; color: #b0b6bf; font-size: 11px; &.open { transform: rotate(90deg); } }
.wo-asset-file { margin-left: auto; color: #b0b6bf; }
.wo-asset-body { padding: 12px 16px; border-top: 1px solid $line2; font-family: inherit; font-size: 13px; line-height: 1.7; color: $ink2; white-space: pre-wrap; word-break: break-word; max-height: 420px; overflow-y: auto; margin: 0; }

/* 发布包 */
.wo-pkg-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.wo-pkg-file { border: 1px solid $line2; border-radius: 8px; padding: 6px; cursor: pointer; background: #fff;
  &:hover { border-color: #c6d6ff; } }
.wo-pkg-img { width: 96px; height: 128px; object-fit: cover; display: block; border-radius: 4px; }
.wo-pkg-name { display: inline-block; padding: 8px 12px; font-size: 12.5px; color: $ink2; }

/* 回执 */
.wo-channel-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid $line2; border-radius: 8px; margin-bottom: 6px; font-size: 13px; background: #fff; }
.wo-channel-target { font-weight: 600; color: $ink; min-width: 110px; }
.wo-channel-status { &.pushed { color: $okColor; } color: $ink3; }
.wo-channel-time { margin-left: auto; color: #b0b6bf; }

/* 动作条 */
.wo-actionbar {
  margin-top: auto; padding: 14px 0 2px; border-top: 1px solid $line2; margin-top: 22px;
  display: flex; align-items: center; justify-content: space-between;
}
.wo-action-hint { font-size: 12.5px; color: $ink3; }
.wo-root-hint { font-size: 12px; color: $ink3; margin-top: 10px; }
</style>

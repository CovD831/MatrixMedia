<template>
  <div class="page-shell workbench-page">
    <div class="page-header">
      <h1 class="page-title">工作台</h1>
      <p class="page-desc" v-if="greeting">{{ greeting }}</p>
    </div>

    <div v-if="!loaded" class="wb-loading" v-loading="true" element-loading-text="读工单目录" />

    <template v-else>
      <!-- 区块一：今天要你拍板的 -->
      <div class="wb-gates">
        <div class="wb-gate" :class="{ empty: gates.topics === 0 }" @click="go('待把关')">
          <div class="wb-gate-num" :class="{ zero: gates.topics === 0 }">{{ gates.topics }}</div>
          <div class="wb-gate-label">待确认选题</div>
          <div class="wb-gate-hint">{{ gates.topics ? "看完素材点确认" : "没有要你拍板的" }}</div>
        </div>
        <div class="wb-gate" :class="{ empty: gates.reviews === 0 }" @click="go('待把关')">
          <div class="wb-gate-num" :class="{ zero: gates.reviews === 0, urgent: gates.reviews > 0 }">{{ gates.reviews }}</div>
          <div class="wb-gate-label">待审读定稿</div>
          <div class="wb-gate-hint">{{ gates.reviews ? "核查已过，等你读" : "机器空闲" }}</div>
        </div>
        <div class="wb-gate" :class="{ empty: gates.publish === 0 }" @click="go('草稿箱')">
          <div class="wb-gate-num" :class="{ zero: gates.publish === 0 }">{{ gates.publish }}</div>
          <div class="wb-gate-label">草稿箱待发</div>
          <div class="wb-gate-hint">{{ gates.publish ? "发布键在平台侧由你按" : "还没有成品" }}</div>
        </div>
      </div>

      <!-- 区块二：机器在跑的 -->
      <div class="wb-section">
        <div class="wb-sec-head">机器在跑</div>
        <div class="wb-sec-body">
          <div class="wb-kv">
            <span class="wb-kv-k">工单目录</span>
            <span class="wb-kv-v mono-num">{{ root || "未设置" }}</span>
            <el-button type="text" size="mini" @click="goWorkshop">去内容工坊</el-button>
          </div>
          <div class="wb-kv">
            <span class="wb-kv-k">进行中</span>
            <span class="wb-kv-v">{{ gates.running }} 张工单在管线里</span>
          </div>
          <div class="wb-kv">
            <span class="wb-kv-k">素材采集</span>
            <span class="wb-kv-v">每日 08:00 / 18:00 由 Hermes cron 自动入池（选题清单发到聊天）</span>
          </div>
        </div>
      </div>

      <!-- 区块三：最近发出去的 -->
      <div class="wb-section">
        <div class="wb-sec-head">最近发出</div>
        <div class="wb-sec-body">
          <div v-if="!recent.length" class="wb-empty">还没有发布记录。第一篇会出现在这里。</div>
          <div v-for="o in recent" :key="o.id" class="wb-recent-row" @click="goWorkshop">
            <span class="wb-recent-title">{{ o.title }}</span>
            <span class="wb-recent-channels">
              <span v-for="(c, i) in o.channels" :key="i" class="wb-recent-channel">{{ channelLabel(c.target) }}</span>
            </span>
            <span class="mono-num wb-recent-date">{{ o.updatedAt ? o.updatedAt.slice(0, 10) : "" }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: "Workbench",
  data() {
    return { loaded: false, root: "", orders: [] };
  },
  computed: {
    greeting() {
      const h = new Date().getHours();
      if (h < 6) return "夜深了。机器在跑，明早看结果。";
      if (h < 12) return "早上好。选题清单 08:00 已发到聊天。";
      if (h < 18) return "下午好。";
      return "晚上好。今天该把关的都处理了吗？";
    },
    gates() {
      const by = (state) => this.orders.filter((o) => o.state === state).length;
      const inGroup = (g) => this.orders.filter((o) => o.group === g).length;
      return {
        topics: by("SELECTED"),
        reviews: by("CHECKED") + by("FINAL"),
        publish: by("PACKAGED"),
        running: inGroup("进行中"),
      };
    },
    recent() {
      return this.orders
        .filter((o) => ["PACKAGED", "PUBLISHED"].includes(o.state) && o.channels && o.channels.length)
        .slice(0, 5);
    },
  },
  async mounted() {
    const ipc = this.getIpc();
    if (!ipc) return;
    const data = await ipc.invoke("workorders:list");
    this.root = data.root;
    this.orders = data.orders || [];
    this.loaded = true;
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
    go(groupName) {
      this.$router.push("/content-workshop");
    },
    goWorkshop() {
      this.$router.push("/content-workshop");
    },
    channelLabel(t) {
      return { "xhs-draft": "小红书草稿箱", "gzh-draft": "公众号草稿箱", "gzh-html": "公众号" }[t] || t;
    },
  },
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@import "@/styles/variables.scss";

.workbench-page { max-width: 860px; }
.wb-loading { min-height: 300px; }

/* gate 卡片 */
.wb-gates { display: flex; gap: 14px; margin: 8px 0 30px; }
.wb-gate {
  flex: 1; background: $cardBg; border: 1px solid $borderColor; border-radius: 10px;
  padding: 20px 22px; cursor: pointer; transition: border-color .15s;
  &:hover { border-color: #c6d6ff; }
  &.empty { cursor: default; &:hover { border-color: $borderColor; } }
}
.wb-gate-num {
  font-family: $mono; font-size: 34px; font-weight: 700; color: $ink; line-height: 1;
  &.urgent { color: $warnColor; }
  &.zero { color: #c9cdd3; }
}
.wb-gate-label { font-size: 13.5px; font-weight: 600; color: $ink; margin-top: 10px; }
.wb-gate-hint { font-size: 12px; color: $ink3; margin-top: 3px; }

/* 区块 */
.wb-section { margin-bottom: 26px; }
.wb-sec-head { font-size: 13px; font-weight: 600; color: $ink2; margin-bottom: 10px; letter-spacing: .5px; }
.wb-sec-body { background: $cardBg; border: 1px solid $borderColor; border-radius: 10px; padding: 6px 18px; }
.wb-kv { display: flex; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid $line2;
  &:last-child { border-bottom: none; } }
.wb-kv-k { font-size: 12.5px; color: $ink3; min-width: 64px; }
.wb-kv-v { font-size: 13px; color: $ink2; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-empty { padding: 20px 0; font-size: 13px; color: #b0b6bf; }
.wb-recent-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid $line2; cursor: pointer;
  &:last-child { border-bottom: none; }
  &:hover .wb-recent-title { color: #2f6bff; } }
.wb-recent-title { font-size: 13.5px; color: $ink; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-recent-channels { display: flex; gap: 6px; }
.wb-recent-channel { font-size: 11px; background: $okDim; color: $okColor; border-radius: 4px; padding: 1px 7px; font-weight: 550; }
.wb-recent-date { color: #b0b6bf; }
</style>

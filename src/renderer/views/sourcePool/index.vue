<template>
  <div class="page-shell source-pool-page">
    <div class="page-header">
      <h1 class="page-title">素材池</h1>
      <p class="page-desc">定时采集的候选素材在这里选择与消费，选中后进入内容生成管线</p>
    </div>

    <div class="toolbar section-card el-card is-never-shadow">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <span class="toolbar-label">操作</span>
          <el-button type="primary" @click="addDialogVisible = true"
            >添加素材</el-button
          >
          <el-button type="success" plain @click="loadPool">刷新</el-button>
          <el-button
            type="warning"
            plain
            :disabled="!selectedItems.length"
            @click="batchMarkSelected"
            >批量选中</el-button
          >
        </div>
        <div class="toolbar-right">
          <el-radio-group v-model="statusFilter" size="small" @change="loadPool">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="new">待选</el-radio-button>
            <el-radio-button label="selected">已选</el-radio-button>
            <el-radio-button label="done">完成</el-radio-button>
            <el-radio-button label="skipped">跳过</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <div class="info-box">
      <el-card
        class="section-card record-card"
        shadow="never"
      >
        <div slot="header" class="card-header">
          <span class="date-label">候选素材</span>
          <span class="card-sub">共 {{ poolItems.length }} 条</span>
        </div>
        <el-table
          v-loading="loading"
          :data="poolItems"
          border
          style="width: 100%"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="44" />
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column prop="channel" label="来源" width="110" />
          <el-table-column prop="kind" label="类型" width="80">
            <template slot-scope="scope">
              <el-tag size="mini" :type="kindTagType(scope.row.kind)">{{
                kindLabel(scope.row.kind)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template slot-scope="scope">
              <el-tag size="mini" :type="statusTagType(scope.row.status)">{{
                statusLabel(scope.row.status)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="加入时间" width="160">
            <template slot-scope="scope">{{
              formatTime(scope.row.createdAt)
            }}</template>
          </el-table-column>
          <el-table-column label="链接" min-width="200" show-overflow-tooltip>
            <template slot-scope="scope">
              <a
                :href="scope.row.url"
                target="_blank"
                class="source-link"
                @click.stop
                >{{ scope.row.url }}</a
              >
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template slot-scope="scope">
              <el-button
                v-if="scope.row.status === 'new'"
                type="success"
                size="mini"
                @click="markStatus(scope.row, 'selected')"
                >选择</el-button
              >
              <el-button
                v-if="scope.row.status === 'selected'"
                type="warning"
                size="mini"
                @click="markStatus(scope.row, 'done')"
                >完成</el-button
              >
              <el-button
                v-if="scope.row.status === 'new' || scope.row.status === 'selected'"
                type="info"
                size="mini"
                plain
                @click="markStatus(scope.row, 'skipped')"
                >跳过</el-button
              >
              <el-button
                v-if="scope.row.status !== 'new' && scope.row.status !== 'selected'"
                type="primary"
                size="mini"
                plain
                @click="markStatus(scope.row, 'new')"
                >恢复</el-button
              >
              <el-button
                type="danger"
                size="mini"
                plain
                @click="removeItem(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog
      title="添加素材"
      :visible.sync="addDialogVisible"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form ref="addForm" :model="addForm" label-width="88px">
        <el-form-item label="链接" required>
          <el-input v-model="addForm.url" placeholder="https://www.youtube.com/watch?v=..." />
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="addForm.title" placeholder="素材标题" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="addForm.channel" placeholder="频道/作者名" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="addForm.kind" style="width: 100%">
            <el-option label="视频" value="video" />
            <el-option label="文章" value="article" />
            <el-option label="书籍" value="book" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="addForm.tags" placeholder="空格分隔，如：拖延症 自我提升" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAdd">添加</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import dataRequest from "@/utils/dataRequest";

const STATUS_LABEL = {
  new: "待选",
  selected: "已选",
  done: "完成",
  skipped: "跳过",
};
const STATUS_TAG = {
  new: "warning",
  selected: "success",
  done: "info",
  skipped: "info",
};
const KIND_LABEL = {
  video: "视频",
  article: "文章",
  book: "书籍",
};

export default {
  name: "SourcePool",
  data() {
    return {
      poolItems: [],
      loading: false,
      adding: false,
      addDialogVisible: false,
      statusFilter: "all",
      selectedItems: [],
      addForm: {
        url: "",
        title: "",
        channel: "",
        kind: "video",
        tags: "",
      },
    };
  },
  mounted() {
    this.loadPool();
  },
  methods: {
    async loadPool() {
      this.loading = true;
      try {
        const res = await dataRequest({
          type: "config",
          fileName: "sourcePool",
          item: { action: "get" },
        });
        const raw = (res && res.data) || {};
        let items = Array.isArray(raw.items) ? raw.items : [];
        if (this.statusFilter !== "all") {
          items = items.filter((it) => it && it.status === this.statusFilter);
        }
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        this.poolItems = items;
      } catch (e) {
        console.error("加载素材池失败:", e);
        this.$message.error("加载素材池失败");
      } finally {
        this.loading = false;
      }
    },
    async savePool(items) {
      const res = await dataRequest({
        type: "config",
        fileName: "sourcePool",
        item: {
          action: "update",
          data: { items },
        },
      });
      if (!res || res.success !== true) {
        throw new Error("保存素材池失败");
      }
    },
    async getAllItems() {
      const res = await dataRequest({
        type: "config",
        fileName: "sourcePool",
        item: { action: "get" },
      });
      const raw = (res && res.data) || {};
      return Array.isArray(raw.items) ? raw.items : [];
    },
    statusLabel(s) {
      return STATUS_LABEL[s] || s || "-";
    },
    statusTagType(s) {
      return STATUS_TAG[s] || "info";
    },
    kindLabel(k) {
      return KIND_LABEL[k] || k || "-";
    },
    kindTagType(k) {
      if (k === "book") return "danger";
      if (k === "article") return "success";
      return "";
    },
    formatTime(ms) {
      if (!ms) return "-";
      const d = new Date(Number(ms));
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    },
    onSelectionChange(rows) {
      this.selectedItems = rows || [];
    },
    async markStatus(row, status) {
      try {
        const items = await this.getAllItems();
        const target = items.find((it) => String(it.id) === String(row.id));
        if (!target) {
          this.$message.warning("条目不存在，可能已被删除，已刷新列表");
          this.loadPool();
          return;
        }
        target.status = status;
        if (status === "done") target.doneAt = Date.now();
        await this.savePool(items);
        this.$message.success(
          `已${status === "selected" ? "选择" : status === "done" ? "标记完成" : status === "skipped" ? "跳过" : "恢复"}：${row.title}`
        );
        this.loadPool();
      } catch (e) {
        console.error("更新素材状态失败:", e);
        this.$message.error("更新素材状态失败");
      }
    },
    async batchMarkSelected() {
      try {
        const items = await this.getAllItems();
        const ids = new Set(this.selectedItems.map((r) => String(r.id)));
        let count = 0;
        items.forEach((it) => {
          if (ids.has(String(it.id)) && it.status === "new") {
            it.status = "selected";
            count += 1;
          }
        });
        await this.savePool(items);
        this.$message.success(`已选中 ${count} 条素材`);
        this.loadPool();
      } catch (e) {
        console.error("批量选中失败:", e);
        this.$message.error("批量选中失败");
      }
    },
    async removeItem(row) {
      try {
        await this.$confirm(`确认删除「${row.title}」？`, "删除素材", {
          confirmButtonText: "删除",
          cancelButtonText: "取消",
          type: "warning",
        });
      } catch (_) {
        return;
      }
      try {
        const items = await this.getAllItems();
        const next = items.filter((it) => String(it.id) !== String(row.id));
        await this.savePool(next);
        this.$message.success("已删除");
        this.loadPool();
      } catch (e) {
        console.error("删除素材失败:", e);
        this.$message.error("删除素材失败");
      }
    },
    async handleAdd() {
      if (!this.addForm.url.trim() || !this.addForm.title.trim()) {
        this.$message.warning("链接和标题必填");
        return;
      }
      this.adding = true;
      try {
        const items = await this.getAllItems();
        if (items.some((it) => String(it.url) === this.addForm.url.trim())) {
          this.$message.warning("该链接已在素材池中");
          return;
        }
        items.push({
          id: String(Date.now()),
          url: this.addForm.url.trim(),
          title: this.addForm.title.trim(),
          channel: this.addForm.channel.trim(),
          kind: this.addForm.kind,
          tags: this.addForm.tags.trim(),
          status: "new",
          createdAt: Date.now(),
          note: "",
        });
        await this.savePool(items);
        this.$message.success("已添加素材");
        this.addDialogVisible = false;
        this.addForm = { url: "", title: "", channel: "", kind: "video", tags: "" };
        this.loadPool();
      } catch (e) {
        console.error("添加素材失败:", e);
        this.$message.error("添加素材失败");
      } finally {
        this.adding = false;
      }
    },
  },
};
</script>

<style scoped>
.source-pool-page .source-link {
  color: #2f6bff;
  text-decoration: none;
  word-break: break-all;
}
.source-pool-page .source-link:hover {
  text-decoration: underline;
}
</style>

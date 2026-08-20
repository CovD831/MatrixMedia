import path from "path";
import maybeClosePublishWindow from "./closeWindow.js";
import {
  isCreativeStatementNone,
  resolveXhsCreativeStatementLabel,
} from "../../../shared/creativeStatement.js";
import {
  WAIT_SELECTOR_APPEAR_MS,
  WAIT_UPLOAD_PROCESSING_MS,
  pollPageUntil,
} from "./uploadTimeouts.js";
import { getRandomDelayMs, getXhsSecondClickDelayMs } from "../../../shared/xhsPublishPolicy.js";

function getRandomInt(min, max) {
  const safeMin = Number(min) || 0;
  const safeMax = Math.max(safeMin, Number(max) || safeMin);
  return Math.round(safeMin + Math.random() * (safeMax - safeMin));
}

function xhsTypeDelay() {
  return getRandomDelayMs(80, 180);
}

async function waitXhs(page, min = 1500, max = 4000) {
  await page.waitForTimeout(getRandomDelayMs(min, max));
}

async function selectXhsCreativeStatement(page, data) {
  const value = data.data && data.data.creativeStatement;
  console.log("[xhs-image] creativeStatement 值 =", value);
  if (isCreativeStatementNone(value)) {
    console.log("[xhs-image] 无标注，小红书保持不选");
    return;
  }
  const label = resolveXhsCreativeStatementLabel(value);
  const XHS_SUPPORTED_STATEMENT_LABELS = new Set([
    "笔记含AI合成内容",
    "虚构演绎，仅供娱乐",
    "内容包含营销广告",
  ]);
  if (!XHS_SUPPORTED_STATEMENT_LABELS.has(label)) {
    console.warn(`[xhs-image] 当前声明值 "${value}" 在小红书没有对应选项，跳过`);
    return;
  }
  console.log("[xhs-image] 准备选择内容类型声明:", label);

  const triggerId = await page.evaluate(
    "(function(){var ps=document.querySelectorAll('.d-select-placeholder');for(var i=0;i<ps.length;i++){if((ps[i].textContent||'').replace(/\\s+/g,'').trim()==='添加内容类型声明'){var sel=ps[i].closest('.d-select')||ps[i].parentElement;if(!sel)return '';var id='__xhs_stmt_'+Date.now();sel.setAttribute('id',id);return id;}}return '';})()"
  );
  if (!triggerId) {
    console.warn("未找到小红书「添加内容类型声明」入口，跳过");
    return;
  }
  try {
    await page.click("#" + triggerId, { delay: 80 });
    console.log("[xhs-image] 已 page.click 打开内容类型声明下拉");
  } catch (e) {
    console.warn("[xhs-image] page.click 失败，尝试 DOM 派发 mousedown:", e?.message || e);
    await page.evaluate(
      "(function(id){var el=document.getElementById(id);if(!el)return;var r=el.getBoundingClientRect();var o={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0};el.dispatchEvent(new MouseEvent('mousedown',o));el.dispatchEvent(new MouseEvent('mouseup',o));el.dispatchEvent(new MouseEvent('click',o));})(" +
        JSON.stringify(triggerId) +
        ")"
    );
  }

  try {
    await page.waitForFunction(
      "(function(){var ns=document.querySelectorAll('.d-options-wrapper .d-option-name');for(var i=0;i<ns.length;i++){if((ns[i].textContent||'').replace(/\\s+/g,'').trim()===" +
        JSON.stringify(label.replace(/\s+/g, "").trim()) +
        ")return true;}return false;})()",
      { timeout: WAIT_SELECTOR_APPEAR_MS }
    );
  } catch (e) {
    console.warn("小红书声明下拉项未出现:", e?.message || e);
    return;
  }

  const optId = await page.evaluate(
    "(function(){var target=" +
      JSON.stringify(label.replace(/\s+/g, "").trim()) +
      ";var items=document.querySelectorAll('.d-options-wrapper .d-option-name');for(var i=0;i<items.length;i++){var t=(items[i].textContent||'').replace(/\\s+/g,'').trim();if(t!==target)continue;var row=items[i].closest('.d-grid-item');if(!row)return '';var ga=row.getAttribute('style')||'';var m=ga.match(/grid-area:\\s*(\\d+)/);var rowNum=m?m[1]:'';var handler=null;if(rowNum&&row.parentElement){var sibs=row.parentElement.querySelectorAll('.d-grid-item');for(var s=0;s<sibs.length;s++){var sga=sibs[s].getAttribute('style')||'';var sm=sga.match(/grid-area:\\s*(\\d+)/);if(sm&&sm[1]===rowNum){var h=sibs[s].querySelector('.d-option-handler');if(h){handler=h;break;}}}}if(!handler)handler=items[i].closest('.d-option')||row;var id='__xhs_opt_'+Date.now();handler.setAttribute('id',id);return id;})()"
  );
  if (!optId) {
    console.warn("未找到小红书声明选项: " + label);
    return;
  }
  try {
    await page.click("#" + optId, { delay: 80 });
  } catch (e) {
    console.warn("[xhs-image] 点击选项 page.click 失败，DOM 派发:", e?.message || e);
    await page.evaluate(
      "(function(id){var el=document.getElementById(id);if(!el)return;var r=el.getBoundingClientRect();var o={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0};el.dispatchEvent(new MouseEvent('mousedown',o));el.dispatchEvent(new MouseEvent('mouseup',o));el.dispatchEvent(new MouseEvent('click',o));})(" +
        JSON.stringify(optId) +
        ")"
    );
  }
  await page.waitForTimeout(400);

  const selectedNow = await page.evaluate(
    "(function(id){var sel=document.getElementById(id);if(!sel)return '';var d=sel.querySelector('.d-select-description');var dt=d?(d.textContent||'').replace(/\\s+/g,'').trim():'';if(dt)return dt;var p=sel.querySelector('.d-select-placeholder');var pt=p?(p.textContent||'').replace(/\\s+/g,'').trim():'';if(pt&&pt!=='添加内容类型声明')return pt;return '';})(" +
      JSON.stringify(triggerId) +
      ")"
  );
  if (selectedNow) {
    console.log("[xhs-image] 已选择内容类型声明: " + label + "（页面显示=" + selectedNow + "）");
  } else {
    console.warn("[xhs-image] 点了选项但未观察到 placeholder 被替换，可能没真正选中: " + label);
  }
}

async function closeCheckedXhsPkCoverSwitch(page) {
  const switchId = await page.evaluate(
    "(function(){var input=document.querySelector('.pk-cover-title-wrapper input[type=\"checkbox\"]');if(!input||!input.checked)return '';var id='__xhs_pk_cover_switch_'+Date.now();input.setAttribute('id',id);return id;})()"
  );
  if (!switchId) {
    console.log("[xhs-image] PK封面开关未开启，无需关闭");
    return;
  }

  try {
    await page.click("#" + switchId, { delay: 80 });
  } catch (e) {
    console.warn("[xhs-image] page.click 关闭PK封面失败，DOM 派发:", e?.message || e);
    await page.evaluate(
      "(function(id){var el=document.getElementById(id);if(!el)return;var r=el.getBoundingClientRect();var o={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0};el.dispatchEvent(new MouseEvent('mousedown',o));el.dispatchEvent(new MouseEvent('mouseup',o));el.dispatchEvent(new MouseEvent('click',o));})(" +
        JSON.stringify(switchId) +
        ")"
    );
  }
  await page.waitForTimeout(300);

  const stillChecked = await page.evaluate(
    "(function(id){var el=document.getElementById(id);if(!el)return false;var input=el.matches('input[type=\"checkbox\"]')?el:el.querySelector('input[type=\"checkbox\"]');return !!(input&&input.checked);})(" +
      JSON.stringify(switchId) +
      ")"
  );
  if (stillChecked) {
    console.warn("[xhs-image] 已点击PK封面开关，但页面仍显示开启");
  } else {
    console.log("[xhs-image] 已关闭PK封面开关");
  }
}

function normalizeTagList(rawTagText = "") {
  const tagText = String(rawTagText).trim();
  if (!tagText) return [];

  return tagText
    .split(/[\s,，;；、]+/)
    .flatMap((tag) => tag.split(/(?=#)/))
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

export default async function (page, data, window, event) {
  const isDraftMode = data.publishMode === "draft" || data.publishToDraft === true;
  console.log("[xhs-image] 图文上传开始:", data);

  try {
    const uploadSelector = "input.upload-input[type='file']";
    await page.waitForSelector(uploadSelector, {
      timeout: WAIT_SELECTOR_APPEAR_MS,
    });
    const uploadInput = await page.$(uploadSelector);
    if (!uploadInput) throw new Error("未找到上传 input");
    await uploadInput.uploadFile(path.resolve(data.filePath));
  } catch (err) {
    console.error("❌ 小红书图片上传失败:", err);
    throw new Error(`小红书图片上传失败：${err?.message || err}`);
  }

  try {
    const titleSelector =
      ".publish-page-content-base .edit-container .d-input input.d-text";
    await page.waitForSelector(titleSelector, {
      timeout: WAIT_SELECTOR_APPEAR_MS,
    });
    const titleInput = await page.$(titleSelector);
    if (!titleInput) throw new Error("未找到标题输入框");
    const rawTitle = (data.data?.bt1 || data.data?.bt2 || "").trim();
    const titleText = rawTitle.slice(0, 20);
    if (rawTitle.length > 20) {
      console.warn(
        `[xhs-image] ⚠️ 标题共${rawTitle.length}字，超过20字限制，已截断为: "${titleText}"`
      );
    }
    await titleInput.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    if (titleText) {
      await page.type(titleSelector, titleText, { delay: xhsTypeDelay() });
    }
  } catch (err) {
    console.error("❌ 小红书图片标题填写失败:", err);
    throw new Error(`小红书图片标题填写失败：${err?.message || err}`);
  }

  await waitXhs(page);

  try {
    const editorSelector = ".tiptap.ProseMirror";
    await page.waitForSelector(editorSelector, {
      timeout: WAIT_SELECTOR_APPEAR_MS,
    });
    const editor = await page.$(editorSelector);
    if (!editor) throw new Error("未找到正文编辑器");

    const descText = String(data.data?.bt2 || "").trim();
    const tags = normalizeTagList(data.data?.bq || "");

    await editor.click({ clickCount: 2 });
    await waitXhs(page, 1500, 2500);
    await page.evaluate(
      "(function(){var el=document.querySelector(" +
        JSON.stringify(editorSelector) +
        ");if(el)el.focus();})()"
    );
    await waitXhs(page, 1500, 2500);

    if (descText) {
      await page.keyboard.type(descText, { delay: xhsTypeDelay() });
      await waitXhs(page);
      const ok = await page.evaluate(
        "(function(){var el=document.querySelector(" +
          JSON.stringify(editorSelector) +
          ");return !!(el && (el.textContent||'').trim());})()"
      );
      if (!ok) {
        console.warn("[xhs-image] keyboard.type 未写入正文，尝试 execCommand 兜底");
        await page.evaluate(
          "(function(){var el=document.querySelector(" +
            JSON.stringify(editorSelector) +
            ");if(!el)return;el.focus();document.execCommand('insertText',false," +
            JSON.stringify(descText) +
            ");})()"
        );
        await waitXhs(page, 1500, 2500);
      }
    }

    if (tags.length) {
      if (descText) {
        await page.keyboard.press("Enter");
        await waitXhs(page);
      }
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        await page.keyboard.type("#" + tag, { delay: xhsTypeDelay() });
        await waitXhs(page);
        await page.keyboard.press("Enter");
        await waitXhs(page, 1500, 3000);
        if (i < tags.length - 1) {
          await page.keyboard.type(" ", { delay: xhsTypeDelay() });
        }
      }
    }
  } catch (err) {
    console.error("❌ 小红书图片正文/标签填写失败:", err);
    throw new Error(`小红书图片正文/标签填写失败：${err?.message || err}`);
  }

  await waitXhs(page);

  try {
    await closeCheckedXhsPkCoverSwitch(page);
  } catch (err) {
    console.warn("小红书图片PK封面开关处理未完成:", err?.message || err);
  }

  try {
    await selectXhsCreativeStatement(page, data);
  } catch (e) {
    console.warn("小红书图片内容类型声明选择未完成:", e?.message || e);
  }

  try {
    await pollPageUntil(
      page,
      "(function(){var actions=document.querySelectorAll('.video-plugin-title-action');for(var i=0;i<actions.length;i++){var t=(actions[i].textContent||'').replace(/\\s+/g,'').trim();if(t.indexOf('重新上传')!==-1)return true;}var vs=document.querySelectorAll('img');for(var j=0;j<vs.length;j++){var s=vs[j].getAttribute('src')||vs[j].currentSrc||'';if(String(s).trim().length>0)return true;}return false;})()",
      WAIT_UPLOAD_PROCESSING_MS
    );
    console.log("[xhs-image] 图片上传完成");
  } catch (_) {
    console.log("[xhs-image] 图片上传等待超时，继续走发布流程");
  }

  console.log("[xhs-image] 等 xhs-publish-btn 宿主出现...");
  let hostHandle = null;
  try {
    hostHandle = await page.waitForSelector("xhs-publish-btn", {
      visible: true,
      timeout: 30 * 1000,
    });
  } catch (e) {
    console.warn("[xhs-image] 未找到 xhs-publish-btn 宿主元素:", e?.message || e);
  }
  if (!hostHandle) {
    hostHandle = await page.$(".publish-page-publish-btn");
  }
  if (!hostHandle) throw new Error("未找到任何可点击的发布按钮容器");

  if (!isDraftMode) {
    console.log("[xhs-image] 等发布按钮 enable...");
    try {
      await pollPageUntil(
        page,
        "(function(){var h=document.querySelector('xhs-publish-btn');if(!h)return false;return h.getAttribute('submit-disabled')==='false';})()",
        30 * 1000
      );
      console.log("[xhs-image] 发布按钮已可用");
    } catch (_) {
      console.log("[xhs-image] 等发布按钮 enable 超时（30s），强行点击");
    }
  }

  const box = await hostHandle.boundingBox();
  if (!box) throw new Error("发布按钮宿主无 boundingBox（未渲染或被遮挡）");
  console.log(
    "[xhs-image] 宿主 box=",
    JSON.stringify({ x: box.x, y: box.y, w: box.width, h: box.height })
  );
  const jitterX = getRandomInt(-12, 12);
  const jitterY = getRandomInt(-8, 8);
  const baseX = isDraftMode ? 300 : 450;
  const baseY = 40;
  const cx = box.x + baseX + jitterX;
  const cy = box.y + baseY + jitterY;

  const targetText = isDraftMode ? "暂存离开" : "发布";
  let clickedOk = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const preX = cx + getRandomInt(-20, 20);
    const preY = cy + getRandomInt(-15, 15);
    await page.mouse.move(preX, preY, { steps: getRandomInt(3, 8) });
    await page.waitForTimeout(getRandomInt(30, 80));
    await page.mouse.click(cx, cy, { delay: 80 });
    console.log(
      `[xhs-image] 第 ${attempt} 次点击「${targetText}」at (${Math.round(cx)},${Math.round(cy)})`
    );
    if (attempt < 2) {
      const secondClickDelay = getXhsSecondClickDelayMs();
      console.log(`[xhs-image] 等待 ${secondClickDelay}ms 后判断是否第二次点击`);
      await page.waitForTimeout(secondClickDelay);
    } else {
      await waitXhs(page, 2500, 4500);
    }
    const stillThere = await page.evaluate(
      "(function(){return !!document.querySelector('xhs-publish-btn');})()"
    );
    if (!stillThere) {
      console.log(`[xhs-image] xhs-publish-btn 宿主已消失，发布动作生效`);
      clickedOk = true;
      break;
    }
  }

  if (!clickedOk) {
    const attrDump = await page.evaluate(
      "(function(){var h=document.querySelector('xhs-publish-btn');if(!h)return 'host-gone';var o={};for(var i=0;i<h.attributes.length;i++){o[h.attributes[i].name]=h.attributes[i].value;}return o;})()"
    );
    console.warn("[xhs-image] 2 次点击后宿主仍在，属性:", JSON.stringify(attrDump));
    throw new Error(`未能成功点击「${targetText}」按钮`);
  }

  console.log(
    isDraftMode ? "✅ 小红书图文已保存草稿" : "✅ 小红书图文上传成功"
  );
  setTimeout(() => {
    event.reply("puppeteerFile-done", {
      ...data,
      status: true,
      message: isDraftMode ? "保存草稿成功" : "上传成功",
    });
    maybeClosePublishWindow(
      isDraftMode ? { ...data, closeWindowAfterPublish: true } : data,
      window
    );
  }, 5000);
}

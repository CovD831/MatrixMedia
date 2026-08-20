import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { runCli } from "../runner.js";

// 小红书是当前唯一有 uploadImage 图文通道的平台
const IMAGE_PLATFORM_CN: Record<string, string> = {
  xhs: "小红书",
};

function derivePartition(phone: string, platform: string): string {
  const cn = IMAGE_PLATFORM_CN[platform] ?? platform;
  return `persist:${phone}${cn}`;
}

export const publishImageTool: Tool = {
  name: "publish_image",
  description:
    "Publish an image (图文/笔记) to a target platform via MatrixMedia. " +
    "Currently supports 小红书 (xhs) which has a dedicated image upload channel. " +
    "Requires a logged-in account identified by phone number. " +
    "Long-running -- emits progress notifications when a progressToken is supplied.",
  inputSchema: {
    type: "object",
    properties: {
      platform: {
        type: "string",
        enum: ["xhs"],
        description: "Target platform. Currently only xhs=小红书 supports image publishing.",
      },
      file: {
        type: "string",
        description:
          "Absolute path to the image file (.jpg/.jpeg/.png/.gif/.webp) to upload.",
      },
      title: {
        type: "string",
        description: "Image note title / 标题.",
      },
      phone: {
        type: "string",
        description:
          "Phone number of the account to publish with. Used to derive the session partition automatically.",
      },
      bt2: {
        type: "string",
        description: "Optional secondary title / 概括短标题.",
      },
      tags: {
        type: "string",
        description: "Optional tags, space or # separated.",
      },
      publishAt: {
        type: "string",
        description: 'Optional scheduled publish time, format "YYYY-MM-DD HH:mm".',
      },
      show: {
        type: "boolean",
        description: "If true, show the underlying browser window.",
      },
      draft: {
        type: "boolean",
        description:
          "If true, save the image to the platform draft box instead of publishing it.",
      },
      creativeStatement: {
        type: "string",
        description: "Optional creative statement / 创作声明.",
      },
    },
    required: ["platform", "file", "title", "phone"],
  },
};

export async function handlePublishImage(
  args: Record<string, unknown>,
  onProgress?: (elapsed: number) => void
): Promise<string> {
  const platform = args.platform;
  const file = args.file;
  const title = args.title;
  const phone = args.phone;
  const bt2 = args.bt2;
  const tags = args.tags;
  const publishAt = args.publishAt;
  const show = args.show;
  const draft = args.draft;
  const creativeStatement =
    args.creativeStatement == null ? "" : String(args.creativeStatement).trim();

  if (typeof phone !== "string" || phone.length === 0) {
    throw new Error("phone must be non-empty string");
  }
  if (typeof file !== "string" || file.length === 0) {
    throw new Error("file must be non-empty string");
  }
  if (!/\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(file)) {
    throw new Error(
      "file must be an image (.jpg/.jpeg/.png/.gif/.webp/.bmp/.heic): " + file
    );
  }
  if (String(platform) !== "xhs") {
    throw new Error(
      "目前仅小红书(xhs)支持图片发布，收到 platform=" + String(platform)
    );
  }

  const partition = derivePartition(phone, String(platform));

  const cliArgs: string[] = [
    "publish",
    "-p",
    String(platform),
    "-f",
    file,
    "-t",
    String(title),
    "--partition",
    partition,
    ...(bt2 ? ["--bt2", String(bt2)] : []),
    ...(tags ? ["--tags", String(tags)] : []),
    ...(publishAt ? ["--publish-at", String(publishAt)] : []),
    ...(show ? ["--show"] : []),
    ...(draft ? ["--draft"] : []),
    ...(creativeStatement ? ["--creative-statement", creativeStatement] : []),
  ];

  const result = await runCli(cliArgs, { onProgress });

  if (result.exitCode === 0) {
    const lastJson = result.lastJson;
    if (
      lastJson !== null &&
      typeof lastJson === "object" &&
      (lastJson as { scheduled?: unknown }).scheduled === true
    ) {
      return JSON.stringify({
        status: "scheduled",
        id: (lastJson as any).id,
        publishAt: (lastJson as any).publishAt,
        message: (lastJson as any).message,
      });
    }
    return JSON.stringify({
      status: (result.lastJson as any)?.resultStatus ?? "success",
      publishMode: (result.lastJson as any)?.publishMode,
      message: (result.lastJson as any)?.message ?? "上传成功",
    });
  }

  if (result.exitCode === 3) {
    throw new Error(
      (result.lastJson as any)?.message ?? "发布失败(登录态异常)"
    );
  }
  if (result.exitCode === 1) {
    throw new Error("发布超时或失败: " + result.stderr.slice(0, 300));
  }
  if (result.exitCode === 2) {
    throw new Error("参数错误: " + result.stderr.slice(0, 200));
  }
  throw new Error("未知错误 exit " + String(result.exitCode));
}

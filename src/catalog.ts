/**
 * WorkBuddy model catalog: a static fallback list, replaced by the upstream's
 * dynamic catalog once it loads, and filtered by the user's explicit selection.
 *
 * 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
 *   — 「上次刷新的完整目录（lastCatalog）与用户勾选分离，运行时目录由两者
 *     推导」的模型来自该项目。它让卡片永远展示最新目录而不是陈旧快照，
 *     并让上游刷新成为草稿操作（用户点保存才生效）。
 *   静态 fallback 目录的做法来自
 *     corrinehu/dsh-workbuddy-connect（MIT）：上游不可用时 provider 不为空。
 * 改动：WorkBuddy 直接用各模型的 `maxInputTokens` 声明实际上下文窗口；
 *   上游没有独立的长上下文开关或第二个模型 id，因此不会虚构 `@1m` 变体。
 *   本目录额外承载上游给出的积分倍率、多模态与推理档位。
 *
 * @module dsh-connect-workbuddy/catalog
 */

import type { WorkBuddyUpstreamModel } from './upstream.ts'

/** One model entry the adapter exposes. */
export type WorkBuddyModelInfo = WorkBuddyUpstreamModel

/**
 * Static CLI models captured from the CN endpoint (2026-08-30). The upstream
 * refresh replaces this list at startup; it exists so the provider registers
 * with a usable catalog even while the first fetch is in flight or offline.
 */
export const FALLBACK_WORKBUDDY_MODELS: readonly WorkBuddyModelInfo[] = [
  {
    "id": "auto",
    "name": "Auto",
    "contextWindow": 168000,
    "maxTokens": 32000,
    "descriptionZh": "平衡效果与速度。自动为每个任务匹配最优模型，积分倍率随之浮动",
    "descriptionEn": "Balances quality and speed. Automatically selects the best model for each task, with a variable credit multiplier.",
    "supportsToolCall": true
  },
  {
    "id": "hy3",
    "name": "Hy3",
    "contextWindow": 192000,
    "maxTokens": 64000,
    "creditMultiplier": 0,
    "descriptionZh": "混元思考模型，具有增强的推理能力",
    "descriptionEn": "Hunyuan's thinking model with enhanced reasoning capabilities",
    "supportsToolCall": true
  },
  {
    "id": "hy3-x",
    "name": "Hy3",
    "contextWindow": 192000,
    "maxTokens": 64000,
    "creditMultiplier": 0.05,
    "reasoning": {
      "supportedEfforts": [
        "low",
        "high"
      ],
      "defaultEffort": "high",
      "canDisableThinking": false
    },
    "descriptionZh": "混元思考模型，具有增强的推理能力",
    "descriptionEn": "Hunyuan's thinking model with enhanced reasoning capabilities",
    "supportsToolCall": true
  },
  {
    "id": "hy4-preview",
    "name": "Hy4 preview",
    "contextWindow": 1000000,
    "maxTokens": 64000,
    "creditMultiplier": 0,
    "reasoning": {
      "supportedEfforts": [
        "high"
      ],
      "defaultEffort": "high",
      "canDisableThinking": false
    },
    "descriptionZh": "混元思考模型，具有增强的推理能力",
    "descriptionEn": "Hunyuan's thinking model with enhanced reasoning capabilities",
    "supportsToolCall": true
  },
  {
    "id": "hy4-preview-x",
    "name": "Hy4 preview",
    "contextWindow": 1000000,
    "maxTokens": 64000,
    "creditMultiplier": 0.29,
    "reasoning": {
      "supportedEfforts": [
        "high"
      ],
      "defaultEffort": "high",
      "canDisableThinking": false
    },
    "descriptionZh": "混元思考模型，具有增强的推理能力",
    "descriptionEn": "Hunyuan's thinking model with enhanced reasoning capabilities",
    "supportsToolCall": true
  },
  {
    "id": "default",
    "name": "Default",
    "contextWindow": 200000,
    "maxTokens": 24000,
    "creditMultiplier": 2.2,
    "supportsToolCall": true
  },
  {
    "id": "glm-5v-turbo",
    "name": "GLM-5v-Turbo",
    "contextWindow": 200000,
    "maxTokens": 64000,
    "creditMultiplier": 0.71,
    "descriptionZh": "原生多模态模型",
    "descriptionEn": "Native Multimodal Model",
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "glm-5.3",
    "name": "GLM-5.3",
    "contextWindow": 1000000,
    "maxTokens": 48000,
    "creditMultiplier": 0.79,
    "reasoning": {
      "supportedEfforts": [
        "low",
        "high",
        "xhigh"
      ],
      "defaultEffort": "high",
      "canDisableThinking": true
    },
    "descriptionZh": "能力均衡，适合日常使用",
    "descriptionEn": "Great for daily use",
    "supportsToolCall": true
  },
  {
    "id": "glm-5.3-flash",
    "name": "GLM-5.3-Flash",
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "creditMultiplier": 0.06,
    "reasoning": {
      "supportedEfforts": [
        "low",
        "high",
        "max"
      ],
      "defaultEffort": "high",
      "canDisableThinking": true
    },
    "descriptionZh": "原生多模态，擅长处理复杂的长程自主任务。",
    "descriptionEn": "Native multimodal, excelling at complex, long-horizon autonomous tasks.",
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "glm-5.2",
    "name": "GLM-5.2",
    "contextWindow": 1000000,
    "maxTokens": 48000,
    "creditMultiplier": 0.79,
    "descriptionZh": "1M 上下文，擅长长程任务",
    "descriptionEn": "1M context, built for long-horizon tasks.",
    "supportsToolCall": true
  },
  {
    "id": "glm-5.1",
    "name": "GLM-5.1",
    "contextWindow": 200000,
    "maxTokens": 48000,
    "creditMultiplier": 0.79,
    "descriptionZh": "能力均衡，适合日常使用",
    "descriptionEn": "Great for daily use",
    "supportsToolCall": true
  },
  {
    "id": "glm-5.0",
    "name": "GLM-5.0",
    "contextWindow": 200000,
    "maxTokens": 48000,
    "creditMultiplier": 0.8,
    "supportsToolCall": true
  },
  {
    "id": "glm-4.7",
    "name": "GLM-4.7",
    "contextWindow": 200000,
    "maxTokens": 48000,
    "creditMultiplier": 0.23,
    "supportsToolCall": true
  },
  {
    "id": "glm-4.6",
    "name": "GLM-4.6",
    "contextWindow": 168000,
    "maxTokens": 32000,
    "creditMultiplier": 0.23,
    "supportsToolCall": true
  },
  {
    "id": "glm-4.6v",
    "name": "GLM-4.6V",
    "contextWindow": 128000,
    "maxTokens": 32000,
    "creditMultiplier": 0.11,
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "minimax-m3",
    "name": "MiniMax-M3",
    "contextWindow": 512000,
    "maxTokens": 128000,
    "creditMultiplier": 0.25,
    "descriptionZh": "原生多模态，擅长代码、智能体任务",
    "descriptionEn": "Native multimodal model for coding and agents tasks",
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "minimax-m2.5",
    "name": "MiniMax-M2.5",
    "contextWindow": 200000,
    "maxTokens": 48000,
    "creditMultiplier": 0.18,
    "supportsToolCall": true
  },
  {
    "id": "kimi-k3-1",
    "name": "Kimi-K3",
    "contextWindow": 1000000,
    "maxTokens": 32000,
    "creditMultiplier": 1.62,
    "descriptionZh": "擅长处理复杂的长程自主任务，前端开发能力突出，同时在知识工作与科研推理上表现出色。",
    "descriptionEn": "Excels at complex, long-horizon autonomous tasks, with standout front-end skills and strong knowledge work and scientific reasoning",
    "supportsToolCall": true
  },
  {
    "id": "kimi-k2.7",
    "name": "Kimi-K2.7-Code",
    "contextWindow": 256000,
    "maxTokens": 32000,
    "creditMultiplier": 0.57,
    "descriptionZh": "多模态模型，适合日常任务",
    "descriptionEn": "A multimodal model, good for daily use.",
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "kimi-k2.6",
    "name": "Kimi-K2.6",
    "contextWindow": 256000,
    "maxTokens": 32000,
    "creditMultiplier": 0.52,
    "descriptionZh": "多模态模型，适合日常任务",
    "descriptionEn": "A multimodal model, good for daily use.",
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "kimi-k2.5",
    "name": "Kimi-K2.5",
    "contextWindow": 164000,
    "maxTokens": 32000,
    "creditMultiplier": 0.45,
    "supportsToolCall": true,
    "supportsImages": true,
    "multimodal": true
  },
  {
    "id": "kimi-k2-thinking",
    "name": "Kimi-K2-Thinking",
    "contextWindow": 164000,
    "maxTokens": 32000,
    "creditMultiplier": 0.54,
    "supportsToolCall": true
  },
  {
    "id": "deepseek-v4-flash",
    "name": "Deepseek-V4-Flash",
    "contextWindow": 1000000,
    "maxTokens": 50000,
    "creditMultiplier": 0.17,
    "descriptionZh": "DeepSeek 旗舰模型，支持 1M 上下文窗口",
    "descriptionEn": "DeepSeek flagship model, supporting 1M context window",
    "supportsToolCall": true
  },
  {
    "id": "deepseek-v4-pro",
    "name": "Deepseek-V4-Pro",
    "contextWindow": 1000000,
    "maxTokens": 50000,
    "creditMultiplier": 0.51,
    "descriptionZh": "DeepSeek 旗舰模型，支持 1M 上下文窗口",
    "descriptionEn": "DeepSeek flagship model, supporting 1M context window",
    "supportsToolCall": true
  },
  {
    "id": "deepseek-v3-2-volc",
    "name": "DeepSeek-V3.2",
    "contextWindow": 96000,
    "maxTokens": 32000,
    "creditMultiplier": 0.29,
    "supportsToolCall": true
  },
  {
    "id": "hunyuan-2.0-thinking",
    "name": "Hunyuan-2.0-Thinking",
    "contextWindow": 128000,
    "maxTokens": 24000,
    "creditMultiplier": 0.04,
    "supportsToolCall": true
  },
  {
    "id": "hunyuan-chat",
    "name": "Hunyuan-Turbos",
    "contextWindow": 200000,
    "maxTokens": 8192,
    "supportsToolCall": true
  },
  {
    "id": "hunyuan-image-v3.0",
    "name": "Hunyuan Image V3",
    "contextWindow": 4096,
    "maxTokens": 4096
  }
]

/**
 * Derive the runtime catalog from the last-refreshed directory plus the
 * user's selection. This is the single source of truth for what DSH exposes,
 * so saving only the selection is enough to rebuild it after a restart.
 *
 * An empty selection falls back to the whole directory: a plugin that has
 * never been configured must still serve models rather than nothing.
 */
export type WorkBuddyContextBudget = number

/** Apply the saved local DSH budget; models above 200K default to their native context. */
export function applyContextBudgets(
  catalog: readonly WorkBuddyModelInfo[],
  budgets: Readonly<Record<string, WorkBuddyContextBudget | undefined>> = {},
): WorkBuddyModelInfo[] {
  return catalog.map(model => ({
    ...model,
    contextWindow: model.contextWindow > 200_000
      ? Math.min(model.contextWindow, budgets[model.id] ?? model.contextWindow)
      : model.contextWindow,
  }))
}

export function deriveCatalog(
  catalog: readonly WorkBuddyModelInfo[],
  enabled: ReadonlySet<string>,
  budgets: Readonly<Record<string, WorkBuddyContextBudget | undefined>> = {},
): WorkBuddyModelInfo[] {
  const defaultSelected = catalog.filter(model => model.contextWindow >= 1_000_000)
  const selected = enabled.size === 0
    ? (defaultSelected.length > 0 ? defaultSelected : catalog)
    : catalog.filter(model => enabled.has(model.id))
  return applyContextBudgets(selected, budgets)
}

/** Mutable catalog shared by the shim's `/v1/models` and the adapter. */
export class WorkBuddyCatalog {
  private models: readonly WorkBuddyModelInfo[] = FALLBACK_WORKBUDDY_MODELS

  /** Current entries; the fallback list until the upstream answer lands. */
  current(): readonly WorkBuddyModelInfo[] {
    return this.models
  }

  /** Replace the list; callers invalidate their adapter snapshot after this. */
  set(models: readonly WorkBuddyModelInfo[]): void {
    if (models.length === 0) throw new Error('workbuddy model catalog cannot be empty')
    this.models = models.map(model => ({ ...model }))
  }
}

/**
 * WorkBuddy models for DeepSeek Harness, reusing the WorkBuddy desktop
 * app's sign-in. Registers the `workbuddy` provider; streaming, tool calls,
 * compaction, and permissions stay Harness-owned.
 *
 * 参考：corrinehu/dsh-workbuddy-connect（MIT，Copyright (c) 2026 Corrine Hu）
 *   — 宿主的装配顺序（先起 shim，拿到端口后才构造 provider，
 *     再注册 adapter 与可配置 provider，最后异步刷新目录）由其设计并验证；
 *     `installSettingsSection` 的用法、webServer 为可选服务（无头 profile
 *     下宿主仍工作）的处理，亦沿用其做法。
 * 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
 *   — 配置 schema 的字段划分（lastCatalog 目录 + enabledModelIds 勾选分离）、
 *     `displayModels` 与 `configuredModels` 的区分、
 *     `registerModelDiscovery` 与 `discoverModels` 返回草稿目录的做法，
 *     均来自该项目。
 * 改动：账号选择严格绑定用户显式选择的账号（不按积分自动切换），
 *   并移除与本项目上游无关的 1M 变体逻辑。
 *
 * @module dsh-connect-workbuddy
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkBuddyCredentialStore } from './auth.ts'
import { deriveCatalog, fallbackModelsFor, FALLBACK_WORKBUDDY_MODELS, WorkBuddyCatalog } from './catalog.ts'
import type { WorkBuddyContextBudget, WorkBuddyModelInfo } from './catalog.ts'
import { createWorkBuddyAdapter, workBuddyModelDisplayName, workBuddyModelInput, WORKBUDDY_PROVIDER } from './adapter.ts'
import { createWorkBuddyShim } from './shim.ts'
import { regionOf, WorkBuddyUpstreamClient } from './upstream.ts'
import type { WorkBuddyRegion } from './upstream.ts'
import { registerWorkBuddyStatusRoute } from './web-status.ts'
import { clearHostHeartbeat, writeHostHeartbeat } from './host-heartbeat.ts'

export { WORKBUDDY_PROVIDER, WORKBUDDY_STREAM_IDLE_TIMEOUT_MS, createWorkBuddyAdapter, workBuddyModelDisplayName, workBuddyModelInput, workBuddyThinkingLevelMap, type WorkBuddyAdapter } from './adapter.ts'
export { createWorkBuddyShim, type WorkBuddyShim } from './shim.ts'
export {
  deriveCatalog,
  fallbackModelsFor,
  FALLBACK_WORKBUDDY_MODELS,
  FALLBACK_WORKBUDDY_MODELS_GLOBAL,
  WorkBuddyCatalog,
  type WorkBuddyModelInfo,
} from './catalog.ts'
export {
  authFileName,
  defaultDesktopAuthCandidates,
  defaultDesktopAuthDirs,
  defaultDesktopAuthPath,
  parseWorkBuddyAuth,
  WORKBUDDY_AUTH_FILE_ENV,
  WORKBUDDY_AUTH_FILENAME,
  workbuddyAccountId,
  WorkBuddyCredentialStore,
  workbuddyOwnAuthPath,
  type WorkBuddyAccountChoice,
  type WorkBuddyAuthStatus,
  type WorkBuddyCredential,
  type WorkBuddyStoreOptions,
} from './auth.ts'
export {
  classifyUpstreamError,
  parseCreditMultiplier,
  parseReasoning,
  parseUpstreamModel,
  prepareChatBody,
  regionOf,
  WorkBuddyUpstreamClient,
  type UpstreamErrorKind,
  type WorkBuddyChatResult,
  type WorkBuddyCreditPackage,
  type WorkBuddyCredits,
  type WorkBuddyReasoning,
  type WorkBuddyRefreshOutcome,
  type WorkBuddyUpstreamModel,
} from './upstream.ts'
export {
  WORKBUDDY_HOST_HEARTBEAT_FILENAME,
  clearHostHeartbeat,
  isHeartbeatProcessAlive,
  processStartTimeMs,
  readHostHeartbeat,
  writeHostHeartbeat,
  workbuddyHostHeartbeatPath,
  type WorkBuddyHostHeartbeat,
} from './host-heartbeat.ts'
export { WORKBUDDY_CONNECT_VERSION } from './version.ts'
export {
  registerWorkBuddyStatusRoute,
  workBuddyWebStatus,
  type WorkBuddyStatusRouteOptions,
} from './web-status.ts'
export {
  WORKBUDDY_ACCOUNTS_REFRESH_PATH,
  WORKBUDDY_CHECKIN_PATH,
  WORKBUDDY_MODELS_REFRESH_PATH,
  WORKBUDDY_USAGE_PATH,
  type WorkBuddyWebAccount,
  type WorkBuddyWebCheckin,
  type WorkBuddyWebCredits,
  type WorkBuddyWebModel,
  type WorkBuddyWebPackage,
  type WorkBuddyWebUsage,
} from './status-paths.ts'

/** Stable Cordis plugin name. */
export const name = 'dsh-connect-workbuddy'

/** The model registry required before the provider can register. */
export const inject = ['llm', 'settings']

/** Settings namespace for the plugin configuration card. */
export const WORKBUDDY_SETTINGS_NS = 'workbuddy' as SettingsNamespace

/** One region's model directory and the user's selection within it. */
export interface WorkBuddyRegionState {
  /** The last-refreshed directory for this region; what the card displays. */
  lastCatalog?: WorkBuddyModelInfo[]
  /** The user's selection in this region, as model ids. */
  enabledModelIds?: string[]
  /** Model ids the user explicitly opted into image input. */
  imageModelIds?: string[]
  /** Local DSH context budget per model in this region. */
  contextBudgets?: Record<string, WorkBuddyContextBudget>
}

/** Plugin configuration. */
export interface Config {
  /** Explicit WorkBuddy desktop auth-file path, overriding env and platform defaults. */
  authFile?: string
  /** Stable local account selector; tokens remain outside settings. */
  accountId?: string
  /**
   * Per-region model state, keyed `cn` | `global`. The CN app and the
   * international WorkBuddy AI app expose different rosters, so each keeps its
   * own directory and selection and switching accounts never drops the other
   * region's picks.
   */
  regions?: Partial<Record<WorkBuddyRegion, WorkBuddyRegionState>>
  /**
   * @deprecated Legacy single-slot fields from before the region split. They
   * predate international support and are read as the CN region's state when
   * `regions.cn` is absent; new writes go to `regions`.
   */
  lastCatalog?: WorkBuddyModelInfo[]
  /** @deprecated See {@link Config.lastCatalog}. */
  enabledModelIds?: string[]
  /** @deprecated See {@link Config.lastCatalog}. */
  imageModelIds?: string[]
  /** @deprecated See {@link Config.lastCatalog}. */
  contextBudgets?: Record<string, WorkBuddyContextBudget>
}

const modelConfig = z.object({
  id: z.string().required(),
  name: z.string().required(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
})

const regionStateConfig = z.object({
  lastCatalog: z.array(modelConfig).default([]),
  enabledModelIds: z.array(z.string()).default([]),
  imageModelIds: z.array(z.string()).default([]),
  contextBudgets: z.dict(z.number().step(1).min(1)).default({}),
})

export const Config: z<Config> = z.object({
  authFile: z.string().description('WorkBuddy desktop auth file (defaults to the app\'s own location)'),
  accountId: z.string().description('Selected local WorkBuddy account id (never a token)'),
  regions: z.dict(regionStateConfig).default({}).description('Per-region model directory and selection, keyed cn | global'),
  lastCatalog: z.array(modelConfig).description('Deprecated: pre-region-split CN model directory') as z<WorkBuddyModelInfo[]>,
  enabledModelIds: z.array(z.string()).default([]).description('Deprecated: pre-region-split CN selection'),
  imageModelIds: z.array(z.string()).default([]).description('Deprecated: pre-region-split CN image opt-in'),
  contextBudgets: z.dict(z.number().step(1).min(1)).default({}).description('Deprecated: pre-region-split CN context budgets'),
})

/**
 * One region's saved model state. A config written before the region split has
 * only the flat fields: those were always captured from the CN endpoint (the
 * plugin had no international support), so they are read as the CN state and
 * only when no explicit CN slot exists. The global region never inherits them —
 * that inheritance is exactly the bug where a stale CN directory was
 * intersected with the international catalog and silently dropped the user's
 * picks.
 */
export function regionStateOf(config: Config, region: WorkBuddyRegion): WorkBuddyRegionState {
  const stored = config.regions?.[region]
  if (stored !== undefined) return stored
  if (region !== 'cn') return {}
  return {
    ...config.lastCatalog === undefined ? {} : { lastCatalog: config.lastCatalog },
    ...config.enabledModelIds === undefined ? {} : { enabledModelIds: config.enabledModelIds },
    ...config.imageModelIds === undefined ? {} : { imageModelIds: config.imageModelIds },
    ...config.contextBudgets === undefined ? {} : { contextBudgets: config.contextBudgets },
  }
}

/**
 * Start the loopback endpoint, register the `workbuddy` provider, and
 * refresh the model catalog from the upstream once credentials allow it.
 * The static fallback catalog serves from the first moment, so an offline
 * upstream never leaves the provider empty.
 */
export function apply(ctx: Context, config: Config): void {
  const client = new WorkBuddyUpstreamClient()
  const store = new WorkBuddyCredentialStore({
    ...config.authFile === undefined ? {} : { desktopPath: config.authFile },
    refresh: credential => client.refreshToken(credential),
  })
  if (config.accountId !== undefined) store.selectAccount(config.accountId)
  const catalog = new WorkBuddyCatalog()
  const shim = createWorkBuddyShim({ store, client, catalog, logger: ctx.logger })

  const enabledSet = (value: Config): ReadonlySet<string> => new Set(value.enabledModelIds ?? [])
  const imageSet = (value: Config): ReadonlySet<string> => new Set(value.imageModelIds ?? [])
  // Stamp image capability onto a model list. When the user has configured
  // explicit image choices (imageModelIds), those take precedence. Otherwise,
  // the upstream supportsImages/multimodal flag is preserved as the default.
  const withImageSelection = (
    models: readonly WorkBuddyModelInfo[],
    images: ReadonlySet<string>,
  ): readonly WorkBuddyModelInfo[] =>
    models.map(model => ({
      ...model,
      multimodal: images.size === 0
        ? (model.supportsImages === true || model.multimodal === true)
        : images.has(model.id),
    }))
  // Runtime catalog derives from the last-refreshed directory plus the user's
  // selection; an empty selection serves the whole directory so a never-
  // configured plugin still exposes models. Image input is the user's explicit
  // opt-in (`imageModelIds`) and never inferred from upstream capability flags.
  const configuredModels = (value: Config, region: WorkBuddyRegion): readonly WorkBuddyModelInfo[] => {
    const state = regionStateOf(value, region)
    return withImageSelection(
      deriveCatalog(
        state.lastCatalog?.length ? state.lastCatalog : fallbackModelsFor(region),
        new Set(state.enabledModelIds ?? []),
        state.contextBudgets ?? {},
      ),
      new Set(state.imageModelIds ?? []),
    )
  // What the card displays: the last-refreshed directory, so the user re-reads
  let discoveredCatalog: readonly WorkBuddyModelInfo[] | undefined

  // What the card displays: the last-refreshed directory, or the discovered
  // upstream catalog, falling back to the static catalog.
  const displayModels = (value: Config): readonly WorkBuddyModelInfo[] =>
    value.lastCatalog?.length ? value.lastCatalog : (discoveredCatalog ?? FALLBACK_WORKBUDDY_MODELS)

  let current = () => config
  let invalidateCatalog = (): void => {}
  /**
   * Region of the selected account, tracked so a settings change can recompute
   * the runtime catalog without re-resolving the credential synchronously.
   * Every path that reads the credential (startup seed, discovery, card route)
   * refreshes it, so it converges on the real region.
   */
  let currentRegion: WorkBuddyRegion = 'cn'
  const regionOfCredential = async (): Promise<WorkBuddyRegion> => {
    try {
      currentRegion = regionOf((await store.resolve()).domain)
    } catch {
      // Unsigned/unresolvable credential: keep the last known region so the
      // catalog still reflects the account the user last had selected.
    }
    return currentRegion
  }
  const discoverModels = async (signal?: AbortSignal): Promise<readonly WorkBuddyModelInfo[]> => {
    const credential = await store.resolve()
    const fetched = await client.fetchModels(credential, signal)
    discoveredCatalog = fetched
    return fetched
  }

  const saveSettings = async (payload: import('./web-status.ts').WorkBuddySettingsPayload): Promise<void> => {
    const prev = current()
    const next: Config = {
      ...prev,
      ...payload.lastCatalog !== undefined ? { lastCatalog: [...payload.lastCatalog] } : {},
      ...payload.enabledModelIds !== undefined ? { enabledModelIds: [...payload.enabledModelIds] } : {},
      ...payload.imageModelIds !== undefined ? { imageModelIds: [...payload.imageModelIds] } : {},
      ...payload.contextBudgets !== undefined ? { contextBudgets: { ...payload.contextBudgets } } : {},
    }
    catalog.set(configuredModels(next))
    invalidateCatalog()
    await ctx.settings.update(WORKBUDDY_SETTINGS_NS, payload)
  }

  // Same-origin routes backing the Plugin-configuration card. `webServer`
  // can mount after this row, so wait reactively for it instead of sampling
  // ctx.get() once during apply (which silently loses all routes on Desktop).
  ctx.inject(['webServer'], (webCtx) => registerWorkBuddyStatusRoute(webCtx, {
    store,
    client,
    displayModels: region => displayModels(current(), region),
    enabledModelIds: region => regionStateOf(current(), region).enabledModelIds ?? [],
    imageModelIds: region => regionStateOf(current(), region).imageModelIds ?? [],
    contextBudgets: region => regionStateOf(current(), region).contextBudgets ?? {},
    discoverModels,
    saveSettings,
  }))

  ctx.settings.installSection(ctx, WORKBUDDY_SETTINGS_NS, Config, config, {
    setSource(source: () => Config) { current = source },
    onChange() {
      const next = current()
      store.setDesktopPath(next.authFile)
      store.selectAccount(next.accountId)
      catalog.set(configuredModels(next, currentRegion))
      invalidateCatalog()
      // The account may have changed region (CN ↔ international); converge the
      // runtime catalog on the selected credential's own region.
      void regionOfCredential().then(region => {
        catalog.set(configuredModels(current(), region))
        invalidateCatalog()
      })
    },
  })

  let stopped = false
  ctx.effect(() => () => {
    stopped = true
    void shim.close()
    void clearHostHeartbeat()
  })

  void shim.ready
    .then(async () => {
      if (stopped) return

      let invalidate: (() => void) | undefined
      try {
        // Constructed only once the listener holds a port: the provider's
        // models read the shim origin at construction time.
        const workbuddy = createWorkBuddyAdapter({
          shim,
          store,
          catalog,
          resolveAttachments: () => ctx.get('attachments'),
        })
        invalidate = workbuddy.invalidate
        invalidateCatalog = () => { workbuddy.invalidate() }

        let releaseAdapter: (() => void) | undefined
        let releaseDirectory: (() => void) | undefined
        try {
          releaseAdapter = ctx.llm.registerAdapter([WORKBUDDY_PROVIDER], workbuddy.adapter)
          releaseDirectory = ctx.llm.registerConfigurableProviders([{
            provider: WORKBUDDY_PROVIDER,
            displayName: 'WorkBuddy',
            settingsNs: WORKBUDDY_SETTINGS_NS,
            settingsPath: [],
            declared: false,
          }])
        } finally {
          if (releaseAdapter === undefined || releaseDirectory === undefined) {
            // Registration threw; release whichever half landed.
            releaseAdapter?.()
            releaseDirectory?.()
          }
        }
        try {
          ctx.effect(() => () => {
            releaseAdapter?.()
            releaseDirectory?.()
          })
        } catch {
          // The plugin was disposed during registration; release immediately —
          // the plugin-level disposer already closed the shim.
          releaseAdapter?.()
          releaseDirectory?.()
        }

        ctx.llm.registerModelDiscovery(WORKBUDDY_SETTINGS_NS, async (request, signal) => {
          if (request.provider !== WORKBUDDY_PROVIDER) return []
          const discovered = await discoverModels(signal)
          const region = currentRegion
          const state = regionStateOf(current(), region)
          const next = withImageSelection(
            deriveCatalog(
              discovered,
              new Set(state.enabledModelIds ?? []),
              state.contextBudgets ?? {},
            ),
            new Set(state.imageModelIds ?? []),
          )
          return next.map(model => ({
            id: model.id,
            name: workBuddyModelDisplayName(model),
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
            inputModalities: workBuddyModelInput(model),
          }))
        })

        // The host bundle is live: write a heartbeat so the status CLI can
        // report host health without a browser. Cleared on disposal; a stale
        // heartbeat after a crash is detected by PID in the reader.
        void writeHostHeartbeat()
      } catch (error: unknown) {
        ctx.logger.error('dsh-connect-workbuddy: provider registration failed', error)
        return
      }

      // Seed the catalog from the currently selected account (or the live
      // sign-in default when nothing is selected yet).
      if (stopped) return

      void (async () => {
        try {
          const credential = await store.resolve()
          if (stopped) return
          currentRegion = regionOf(credential.domain)
          const models = await client.fetchModels(credential)
          if (stopped) return
          discoveredCatalog = models
          catalog.set(withImageSelection(
            deriveCatalog(models, new Set(state.enabledModelIds ?? []), state.contextBudgets ?? {}),
            new Set(state.imageModelIds ?? []),
          ))
          invalidate?.()
          // `lastCatalog` is deliberately NOT seeded here: it belongs to the
          // user's saved selection, written only by the card's explicit save
          // (via settingsScope). Until then the card shows the live fallback
          // directory and one press of "Refresh" captures the real one.
        } catch (error: unknown) {
          ctx.logger.warn(
            'dsh-connect-workbuddy: dynamic model catalog unavailable; serving the static fallback list',
            error,
          )
        }
      })()
    })
    .catch((error: unknown) => {
      ctx.logger.error('dsh-connect-workbuddy: loopback endpoint failed to start; provider not registered', error)
    })
}

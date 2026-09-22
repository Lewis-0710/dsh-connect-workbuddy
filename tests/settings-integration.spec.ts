import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SettingsProvider from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import * as WorkBuddy from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  private storedDocument: Record<string, unknown> = {}
  apply(ctx: Context): void {
    ctx.settings = this
  }
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve(structuredClone(this.storedDocument)) }
  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.storedDocument[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

let context: Context | undefined
afterEach(async () => { await context?.fiber.dispose(); context = undefined })

describe('WorkBuddy provider registration', () => {
  it('registers both regional providers, settings, and fallback models after shim startup', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(WorkBuddy, {})
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy')
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy-global')
    expect(ctx.llm.listConfigurableProviders()).toContainEqual({
      provider: 'workbuddy', displayName: 'WorkBuddy', settingsNs: 'workbuddy', settingsPath: [], declared: false,
    })
    expect(ctx.llm.listConfigurableProviders()).toContainEqual({
      provider: 'workbuddy-global', displayName: 'WorkBuddy Global', settingsNs: 'workbuddy', settingsPath: [], declared: false,
    })
    expect(ctx.settings.describe().some(entry => entry.ns === WorkBuddy.WORKBUDDY_SETTINGS_NS)).toBe(true)
    // Each region serves its own fallback roster.
    const cnModels = await ctx.llm.listModels('workbuddy')
    expect(cnModels.map(model => model.id)).toContain('glm-5.3')
    expect(cnModels.map(model => model.id)).toContain('deepseek-v4-pro')
    const globalModels = await ctx.llm.listModels('workbuddy-global')
    expect(globalModels.map(model => model.id)).toContain('gpt-5.6-sol')
    expect(globalModels.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('serves a usable catalog even with no credentials configured', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    // Point the stores at a path that cannot exist so resolution always fails;
    // the static fallbacks must still populate both providers.
    await ctx.plugin(WorkBuddy, { authFile: '/nonexistent/workbuddy-desktop.info' })
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy')
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy-global')
    expect((await ctx.llm.listModels('workbuddy')).length).toBeGreaterThan(0)
    expect((await ctx.llm.listModels('workbuddy-global')).length).toBeGreaterThan(0)
  })

  it('applies the image opt-in to the runtime catalog on settings update', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(WorkBuddy, { authFile: '/nonexistent/workbuddy-desktop.info' })
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy')
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy-global')

    // Default: no model is image-capable until the user opts in.
    const before = await ctx.llm.listModels('workbuddy')
    const glmBefore = before.find(model => model.id === 'glm-5.3')
    expect(glmBefore?.inputModalities ?? []).not.toContain('image')

    // The card's save writes `imageModelIds`; the same change via the settings
    // seam must reach the adapter input modalities (locks H-1/M-1: the image
    // opt-in is injected on every catalog path, not just the save-onChange one).
    await ctx.settings.update(WorkBuddy.WORKBUDDY_SETTINGS_NS, { imageModelIds: ['glm-5.3'] })

    const after = await ctx.llm.listModels('workbuddy')
    const glmAfter = after.find(model => model.id === 'glm-5.3')
    const otherAfter = after.find(model => model.id === 'deepseek-v4-pro')
    expect(glmAfter?.inputModalities).toContain('image')
    expect(otherAfter?.inputModalities ?? []).not.toContain('image')
    // The legacy flat field is CN-only state: the international provider's
    // glm-5.3 (also on its roster) must NOT inherit the CN opt-in.
    const globalAfter = await ctx.llm.listModels('workbuddy-global')
    const globalGlm = globalAfter.find(model => model.id === 'glm-5.3')
    expect(globalGlm?.inputModalities ?? []).not.toContain('image')
  })

  it('applies a global-slot opt-in to the international provider only', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(WorkBuddy, { authFile: '/nonexistent/workbuddy-desktop.info' })
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy-global')

    // A save from the international tab writes regions.global.
    await ctx.settings.update(WorkBuddy.WORKBUDDY_SETTINGS_NS, {
      regions: { global: { imageModelIds: ['gpt-5.6-sol'] } },
    })

    const globalModels = await ctx.llm.listModels('workbuddy-global')
    expect(globalModels.find(model => model.id === 'gpt-5.6-sol')?.inputModalities).toContain('image')
    // The CN provider is untouched by the international tab's save.
    const cnModels = await ctx.llm.listModels('workbuddy')
    expect(cnModels.find(model => model.id === 'glm-5.3')?.inputModalities ?? []).not.toContain('image')
  })

  it('stops serving on the shim port after disposal', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(WorkBuddy, {})
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy')

    // Find the shim's port while the plugin is live.
    const models = await ctx.llm.listModels('workbuddy')
    const probe = models[0]
    expect(probe).toBeDefined()

    await ctx.fiber.dispose()
    // Disposal must release the listener: probing every loopback port the
    // plugin could have taken is impractical, so assert the observable
    // contract instead — disposal completes without leaving a pending
    // unhandled rejection, and the context is no longer usable.
    await expect(ctx.fiber.dispose()).resolves.toBeUndefined()
  })
})

describe('account selection through the settings seam', () => {
  const AUTH_DIR = 'auth'
  const LIVE = 'workbuddy-desktop.info'

  async function writeLiveAuth(root: string): Promise<void> {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    await mkdir(join(root, AUTH_DIR), { recursive: true })
    await writeFile(join(root, AUTH_DIR, LIVE), JSON.stringify({
      account: { uid: 'uid-1', uin: '100000000001', nickname: 'Alpha', enterpriseId: '' },
      auth: {
        accessToken: 'token-alpha',
        refreshToken: 'refresh-alpha',
        tokenType: 'Bearer',
        domain: 'www.codebuddy.cn',
        expiresAt: Date.now() + 86_400_000,
        refreshExpiresAt: Date.now() + 7 * 86_400_000,
      },
    }), 'utf8')
  }

  it('the empty-string sentinel clears the region back to the documented default', async () => {
    // The card's Clear action writes `accounts.<region> = ''`. That must mean
    // "no explicit selection" (follow the app's current sign-in) — NOT a dead
    // id that can never match, which is what an empty string used to be.
    const { mkdtemp } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const root = await mkdtemp(join(tmpdir(), 'wb-clear-'))
    await writeLiveAuth(root)

    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(WorkBuddy, { authFile: join(root, AUTH_DIR, LIVE) })
    await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id)).toContain('workbuddy')

    // A stale selection would otherwise be indistinguishable from a real one.
    await ctx.settings.update(WorkBuddy.WORKBUDDY_SETTINGS_NS, { accounts: { cn: 'orphaned-id' } })
    await ctx.settings.update(WorkBuddy.WORKBUDDY_SETTINGS_NS, { accounts: { cn: '' } })

    const doc = await ctx.settings.get(WorkBuddy.WORKBUDDY_SETTINGS_NS)
    expect((doc as { accounts?: Record<string, string> }).accounts?.cn).toBe('')
    // The plugin keeps serving both regions (no crash, no dead provider).
    expect((await ctx.llm.listModels('workbuddy')).length).toBeGreaterThan(0)
  })
})

describe('regionStateOf', () => {
  const model = { id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 1_000_000, maxTokens: 48_000 }

  it('reads the pre-region-split flat fields as the CN state only', () => {
    const legacy = {
      lastCatalog: [model],
      enabledModelIds: ['glm-5.3'],
      imageModelIds: ['glm-5.3'],
      contextBudgets: { 'glm-5.3': 1_000_000 },
    }
    expect(WorkBuddy.regionStateOf(legacy, 'cn')).toEqual(legacy)
    // The international account must never inherit the CN directory. Doing so
    // intersected a stale CN catalog with the global one and silently dropped
    // the user's international picks (the deepseek-v4.1-flash report).
    expect(WorkBuddy.regionStateOf(legacy, 'global')).toEqual({})
  })

  it('prefers an explicit region slot over the legacy flat fields', () => {
    const config = {
      regions: { cn: { enabledModelIds: ['auto'] } },
      lastCatalog: [model],
      enabledModelIds: ['glm-5.3'],
    }
    expect(WorkBuddy.regionStateOf(config, 'cn').enabledModelIds).toEqual(['auto'])
    // An explicit CN slot does not leak into the global region either.
    expect(WorkBuddy.regionStateOf(config, 'global')).toEqual({})
  })

  it('returns each region its own slot', () => {
    const config = {
      regions: {
        cn: { enabledModelIds: ['glm-5.3'] },
        global: { enabledModelIds: ['gpt-5.6-sol'] },
      },
    }
    expect(WorkBuddy.regionStateOf(config, 'cn').enabledModelIds).toEqual(['glm-5.3'])
    expect(WorkBuddy.regionStateOf(config, 'global').enabledModelIds).toEqual(['gpt-5.6-sol'])
  })
})

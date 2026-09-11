import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkBuddyCredential } from '../src/auth.ts'
import {
  WorkBuddyUpstreamClient,
  classifyUpstreamError,
  parseCreditMultiplier,
  parseReasoning,
  parseUpstreamModel,
  prepareChatBody,
  regionOf,
} from '../src/upstream.ts'

describe('prepareChatBody', () => {
  it('forces streaming and flattens object tool_choice', () => {
    const prepared = JSON.parse(prepareChatBody(JSON.stringify({
      model: 'glm-5.3',
      stream: false,
      tool_choice: { type: 'function', function: { name: 'read' } },
    }))) as Record<string, unknown>
    expect(prepared['stream']).toBe(true)
    expect(prepared['tool_choice']).toBe('read')
  })

  it('normalizes DSH developer messages to WorkBuddy system messages', () => {
    const prepared = JSON.parse(prepareChatBody(JSON.stringify({
      messages: [
        { role: 'developer', content: 'system prompt' },
        { role: 'user', content: 'hello' },
      ],
    }))) as { messages: { role: string; content: string }[] }
    expect(prepared.messages.map(message => message.role)).toEqual(['system', 'user'])
  })

  it('drops tools when tool_choice is none', () => {
    const prepared = JSON.parse(prepareChatBody(JSON.stringify({
      tool_choice: 'none',
      tools: [{ type: 'function', function: { name: 'read' } }],
    }))) as Record<string, unknown>
    expect(prepared['tool_choice']).toBeUndefined()
    expect(prepared['tools']).toBeUndefined()
  })

  it('passes non-JSON bodies through untouched', () => {
    expect(prepareChatBody('not json')).toBe('not json')
  })
})

describe('classifyUpstreamError', () => {
  it('maps credit exhaustion from Chinese markers', () => {
    expect(classifyUpstreamError(400, '积分不足')).toBe('hard_credit')
  })

  it('maps dead sessions ahead of generic client errors', () => {
    expect(classifyUpstreamError(400, 'Offline user session not found')).toBe('session_dead')
  })

  it('maps rate limits and server faults', () => {
    expect(classifyUpstreamError(429, '')).toBe('soft_rate')
    expect(classifyUpstreamError(503, '')).toBe('server')
    expect(classifyUpstreamError(404, '')).toBe('not_found')
  })
})

describe('regionOf', () => {
  it('routes workbuddy.ai to global and everything else to cn', () => {
    expect(regionOf('www.workbuddy.ai')).toBe('global')
    expect(regionOf('app.workbuddy.ai')).toBe('global')
    expect(regionOf('www.codebuddy.cn')).toBe('cn')
    expect(regionOf('www.workbuddy.cn')).toBe('cn')
    expect(regionOf('')).toBe('cn')
  })
})

describe('WorkBuddyUpstreamClient.fetchModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function credential(domain: string): WorkBuddyCredential {
    return {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAtMs: 0,
      domain,
      uid: 'u',
      source: 'desktop',
      filePath: '/tmp/workbuddy-desktop.info',
    }
  }

  /** Run fetchModels against a stubbed upstream; return the URL it called. */
  async function fetchModelsUrl(domain: string): Promise<string> {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          msg: 'OK',
          data: {
            models: [{ id: 'glm-5.3', name: 'GLM-5.3', maxInputTokens: 200_000, maxOutputTokens: 48_000 }],
            agents: [{ name: 'cli', models: ['glm-5.3'] }],
          },
        }),
      } as unknown as Response
    })
    const models = await new WorkBuddyUpstreamClient().fetchModels(credential(domain))
    expect(models.map(model => model.id)).toEqual(['glm-5.3'])
    expect(urls).toHaveLength(1)
    const url = urls[0]
    if (url === undefined) throw new Error('fetchModels performed no upstream request')
    return url
  }

  it('auto-routes CN and global accounts by credential domain', async () => {
    // CN reads the shared personal-models path on its chat gateway. The global
    // gateway serves the account's chat roster as the DESKTOP channel's product
    // config at /v3/config: its personal-models path returns HTTP 500 there,
    // and the CLI channel's config omits chat-usable models
    // (deepseek-v4.1-flash, gpt-6-astra) — so the desktop user agent is what
    // selects the right document. This pins the international-version fixes.
    expect(await fetchModelsUrl('www.codebuddy.cn'))
      .toBe('https://copilot.tencent.com/v2/enterprises/personal/models')
    expect(await fetchModelsUrl('www.workbuddy.cn'))
      .toBe('https://copilot.tencent.com/v2/enterprises/personal/models')
    expect(await fetchModelsUrl('www.workbuddy.ai'))
      .toBe('https://www.workbuddy.ai/v3/config')
  })

  it('sends the desktop user agent on the global config request', async () => {
    const seen: Record<string, string> = {}
    vi.stubGlobal('fetch', async (_url: string, init: { headers: Record<string, string> }) => {
      Object.assign(seen, init.headers)
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          msg: 'OK',
          data: {
            models: [{ id: 'deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash', maxInputTokens: 1_000_000, maxOutputTokens: 128_000, credits: 'x0.00' }],
            agents: [{ name: 'cli', models: ['deepseek-v4.1-flash'] }],
          },
        }),
      } as unknown as Response
    })
    const models = await new WorkBuddyUpstreamClient().fetchModels(credential('www.workbuddy.ai'))
    // The CLI user agent returns a 35-model roster without this model; only the
    // desktop channel's document carries the account's real chat list.
    expect(seen['User-Agent']).toBe('WorkBuddy/5.5.2')
    expect(seen['X-Product']).toBe('SaaS')
    expect(models.map(model => model.id)).toEqual(['deepseek-v4.1-flash'])
    expect(models[0]?.creditMultiplier).toBe(0)
  })

  it('keeps the CLI user agent on the CN gateway', async () => {
    const seen: Record<string, string> = {}
    vi.stubGlobal('fetch', async (_url: string, init: { headers: Record<string, string> }) => {
      Object.assign(seen, init.headers)
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          msg: 'OK',
          data: {
            models: [{ id: 'glm-5.3', name: 'GLM-5.3', maxInputTokens: 1_000_000, maxOutputTokens: 48_000 }],
            agents: [{ name: 'cli', models: ['glm-5.3'] }],
          },
        }),
      } as unknown as Response
    })
    await new WorkBuddyUpstreamClient().fetchModels(credential('www.codebuddy.cn'))
    // The CN desktop config carries no `cli` roster at all, so its gateway must
    // keep receiving the CLI agent the plugin actually chats as.
    expect(seen['User-Agent']).toBe('CLI/2.63.2 CodeBuddy/2.63.2')
  })
})

describe('parseCreditMultiplier', () => {
  it('parses the observed upstream spellings', () => {
    expect(parseCreditMultiplier('x0.79 credits')).toBe(0.79)
    expect(parseCreditMultiplier('x0.05')).toBe(0.05)
    expect(parseCreditMultiplier('x0.00 credits')).toBe(0)
  })

  it('returns undefined rather than guessing', () => {
    expect(parseCreditMultiplier(undefined)).toBeUndefined()
    expect(parseCreditMultiplier('free')).toBeUndefined()
    expect(parseCreditMultiplier(0.5)).toBeUndefined()
  })
})

describe('parseReasoning', () => {
  it('keeps declared effort levels', () => {
    expect(parseReasoning({ supportedEfforts: ['low', 'high', 'xhigh'], defaultEffort: 'high' })).toEqual({
      supportedEfforts: ['low', 'high', 'xhigh'],
      defaultEffort: 'high',
    })
  })

  it('drops an empty reasoning object instead of reporting a capability', () => {
    expect(parseReasoning({})).toBeUndefined()
    expect(parseReasoning({ unsupported: 1 })).toBeUndefined()
  })
})

describe('parseUpstreamModel', () => {
  it('carries the fields the plugin card displays', () => {
    const model = parseUpstreamModel({
      id: 'glm-5.3',
      name: 'GLM-5.3',
      maxInputTokens: 1_000_000,
      maxOutputTokens: 48_000,
      credits: 'x0.79',
      supportsImages: true,
      reasoning: { supportedEfforts: ['low', 'high'], defaultEffort: 'high' },
      descriptionZh: '能力均衡',
    })
    expect(model).toMatchObject({
      id: 'glm-5.3',
      contextWindow: 1_000_000,
      maxTokens: 48_000,
      creditMultiplier: 0.79,
      descriptionZh: '能力均衡',
    })
    expect(model?.reasoning?.supportedEfforts).toEqual(['low', 'high'])
  })

  it('never infers multimodal from the upstream image flags', () => {
    // The upstream `supportsImages`/`disabledMultimodal` flags are not reliable,
    // so image input is decided by the user's explicit opt-in (imageModelIds).
    expect(parseUpstreamModel({
      id: 'a',
      maxInputTokens: 1,
      maxOutputTokens: 1,
      supportsImages: true,
    })?.multimodal).toBeUndefined()
    expect(parseUpstreamModel({
      id: 'b',
      maxInputTokens: 1,
      maxOutputTokens: 1,
      supportsImages: false,
    })?.multimodal).toBeUndefined()
    expect(parseUpstreamModel({
      id: 'c',
      maxInputTokens: 1,
      maxOutputTokens: 1,
      supportsImages: true,
      disabledMultimodal: true,
    })?.multimodal).toBeUndefined()
    expect(parseUpstreamModel({
      id: 'd',
      maxInputTokens: 1,
      maxOutputTokens: 1,
    })?.multimodal).toBeUndefined()
  })

  it('rejects disabled models and models without token limits', () => {
    expect(parseUpstreamModel({ id: 'a', disabled: true, maxInputTokens: 1, maxOutputTokens: 1 })).toBeUndefined()
    expect(parseUpstreamModel({ id: 'b', maxInputTokens: 0, maxOutputTokens: 1 })).toBeUndefined()
    expect(parseUpstreamModel({ id: '', maxInputTokens: 1, maxOutputTokens: 1 })).toBeUndefined()
  })
})

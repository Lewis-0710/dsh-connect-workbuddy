import { describe, expect, it } from 'vitest'
import { workBuddyDisplayName, workBuddyModelInput, workBuddyThinkingLevelMap } from '../src/adapter.ts'
import type { WorkBuddyModelInfo } from '../src/catalog.ts'

function model(reasoning?: WorkBuddyModelInfo['reasoning'], multimodal?: boolean): WorkBuddyModelInfo {
  return {
    id: 'test',
    name: 'Test',
    contextWindow: 200_000,
    maxTokens: 32_000,
    ...multimodal === undefined ? {} : { multimodal },
    ...reasoning === undefined ? {} : { reasoning },
  }
}

describe('workBuddyModelInput', () => {
  it('offers images only for models the user opted into image input', () => {
    expect(workBuddyModelInput(model(undefined, true))).toEqual(['text', 'image'])
    expect(workBuddyModelInput(model(undefined, false))).toEqual(['text'])
    expect(workBuddyModelInput(model())).toEqual(['text'])
  })
})

describe('workBuddyDisplayName', () => {
  it('spells the credit multiplier the way WorkBuddy own selector does', () => {
    expect(workBuddyDisplayName({ ...model(), creditMultiplier: 0.79 })).toBe('Test · x0.79')
    expect(workBuddyDisplayName({ ...model(), creditMultiplier: 0.05 })).toBe('Test · x0.05')
    expect(workBuddyDisplayName({ ...model(), creditMultiplier: 0 })).toBe('Test · x0.00')
  })

  it('keeps the bare name when no multiplier was parsed', () => {
    expect(workBuddyDisplayName(model())).toBe('Test')
  })
})

describe('workBuddyThinkingLevelMap', () => {
  it('maps only upstream-advertised levels to identical wire values', () => {
    expect(workBuddyThinkingLevelMap(model({
      supportedEfforts: ['low', 'high', 'xhigh'],
      defaultEffort: 'high',
      canDisableThinking: true,
    }))).toEqual({
      minimal: null,
      low: 'low',
      medium: null,
      high: 'high',
      xhigh: 'xhigh',
      max: null,
    })
  })

  it('does not expose off when WorkBuddy says thinking cannot be disabled', () => {
    expect(workBuddyThinkingLevelMap(model({
      supportedEfforts: ['high'],
      canDisableThinking: false,
    }))).toMatchObject({ off: null, high: 'high' })
  })

  it('does not report reasoning without supported effort levels', () => {
    expect(workBuddyThinkingLevelMap(model())).toBeUndefined()
    expect(workBuddyThinkingLevelMap(model({ canDisableThinking: true }))).toBeUndefined()
  })

  it('drops unknown upstream effort spellings', () => {
    expect(workBuddyThinkingLevelMap(model({ supportedEfforts: ['unknown'] }))).toBeUndefined()
  })
})

describe('createWorkBuddyAdapter provider profile', () => {
  /** A shim stub: the adapter only ever asks it for the loopback origin and its secret. */
  function shimStub() {
    return { baseUrl: () => 'http://127.0.0.1:1', token: async () => 'shared-secret' }
  }

  it('carries an empty modelErrors map on the host line that requires it', async () => {
    // `ResolvedPiAiProviderProfile.modelErrors` became required in 0.1.5-rc.1
    // and is read on every request by `PiAiAdapter.modelOf`, which throws
    // INVALID_CONFIG for any model id the map lists. The workbuddy catalog is
    // built from live upstream reads, so the correct value is an EMPTY map:
    // a non-empty one would pre-condemn models the catalog supplies later.
    const { createWorkBuddyAdapter, WORKBUDDY_PROVIDER } = await import('../src/adapter.ts')
    const { WorkBuddyCatalog } = await import('../src/catalog.ts')

    const { adapter } = createWorkBuddyAdapter({
      shim: shimStub() as never,
      store: {} as never,
      catalog: new WorkBuddyCatalog(),
    })

    const profile = (adapter as unknown as { config: { profiles: () => ReadonlyMap<string, { modelErrors: Map<string,string>; provider: string; displayName: string }> } }).config.profiles().get(WORKBUDDY_PROVIDER)
    expect(profile).toBeDefined()
    expect(profile?.modelErrors).toBeInstanceOf(Map)
    expect(profile?.modelErrors.size).toBe(0)
    expect(profile?.provider).toBe(WORKBUDDY_PROVIDER)
    expect(profile?.displayName).toBe('WorkBuddy')
  })
})

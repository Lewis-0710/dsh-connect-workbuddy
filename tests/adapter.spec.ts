import { describe, expect, it } from 'vitest'
import { workBuddyModelDisplayName, workBuddyModelInput, workBuddyThinkingLevelMap } from '../src/adapter.ts'
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

describe('workBuddyModelDisplayName', () => {
  it('appends formatted credit multiplier suffix when present', () => {
    expect(workBuddyModelDisplayName({ id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 1_000_000, maxTokens: 48_000, creditMultiplier: 0.79 })).toBe('GLM-5.3 (0.79x)')
    expect(workBuddyModelDisplayName({ id: 'hy3', name: 'Hy3', contextWindow: 192_000, maxTokens: 64_000, creditMultiplier: 0 })).toBe('Hy3 (0.00x)')
    expect(workBuddyModelDisplayName({ id: 'hy4-preview-x', name: 'Hy4 preview', contextWindow: 1_000_000, maxTokens: 64_000, creditMultiplier: 0.29 })).toBe('Hy4 preview (0.29x)')
  })

  it('keeps original name when creditMultiplier is undefined', () => {
    expect(workBuddyModelDisplayName({ id: 'auto', name: 'Auto', contextWindow: 168_000, maxTokens: 32_000 })).toBe('Auto')
  })

  it('does not duplicate suffix if already present', () => {
    expect(workBuddyModelDisplayName({ id: 'test', name: 'Test (0.50x)', contextWindow: 200_000, maxTokens: 32_000, creditMultiplier: 0.5 })).toBe('Test (0.50x)')
  })
})

describe('workBuddyModelInput', () => {
  it('offers images only for models the user opted into image input', () => {
    expect(workBuddyModelInput(model(undefined, true))).toEqual(['text', 'image'])
    expect(workBuddyModelInput(model(undefined, false))).toEqual(['text'])
    expect(workBuddyModelInput(model())).toEqual(['text'])
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

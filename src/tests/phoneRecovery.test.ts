import { describe, it, expect } from 'vitest'
import { requestPhoneRecoveryToken, verifyPhoneRecoveryToken, resetPasswordWithPhone } from '../services/apiAuth'

describe('Phone Recovery Service', () => {
  it('should export phone recovery functions', () => {
    expect(requestPhoneRecoveryToken).toBeDefined()
    expect(verifyPhoneRecoveryToken).toBeDefined()
    expect(resetPasswordWithPhone).toBeDefined()
  })

  it('should be callable functions', () => {
    expect(typeof requestPhoneRecoveryToken).toBe('function')
    expect(typeof verifyPhoneRecoveryToken).toBe('function')
    expect(typeof resetPasswordWithPhone).toBe('function')
  })
})
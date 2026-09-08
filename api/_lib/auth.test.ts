import { describe,expect,it } from 'vitest'
import { accountKey,maskedLogin,tokenMatches } from './auth'

describe('MT5 API auth',()=>{
  it('compares tokens without plain-text equality',()=>{expect(tokenMatches('alpha','alpha')).toBe(true);expect(tokenMatches('alpha','beta')).toBe(false)})
  it('does not expose the full login',()=>expect(maskedLogin('12345678')).toBe('••••5678'))
  it('generates stable account keys',()=>expect(accountKey('XM','123')).toBe(accountKey('XM','123')))
})

import { describe, expect, it } from 'vitest'
import { codePinTropSimple } from './codePin'

describe('codePinTropSimple', () => {
  it.each(['1234', '4321', '0000', '999999', '345678', '987654'])(
    'refuse %s, qu’un collègue devinerait',
    (code) => {
      expect(codePinTropSimple(code)).toBe(true)
    },
  )

  it.each(['4827', '1123', '902134', '1357'])('accepte %s', (code) => {
    expect(codePinTropSimple(code)).toBe(false)
  })
})

/* eslint-env mocha */
import { expect } from 'chai'
import '../library/array-at-polyfill.mjs'

describe('Array.at polyfill', () => {
  it('works with positive indexes', () => {
    expect([1, 2, 3].at(0)).to.equal(1)
    expect([1, 2, 3].at(1)).to.equal(2)
    expect([1, 2, 3].at(2)).to.equal(3)
    expect([1, 2, 3].at(3)).to.equal(undefined)
  })

  it('works with negative indexes', () => {
    expect([1, 2, 3].at(-1)).to.equal(3)
    expect([1, 2, 3].at(-2)).to.equal(2)
    expect([1, 2, 3].at(-3)).to.equal(1)
    expect([1, 2, 3].at(-4)).to.equal(undefined)
  })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyChildBelongsToParent } from '../auth-guard'

test('Parent child ownership validation', () => {
  // Case 1: Matching primary child
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-1', []), true)
  
  // Case 2: Matching sibling by ID
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-2', ['siswa-1', 'siswa-2']), true)
  
  // Case 3: Unauthorized target child
  assert.equal(verifyChildBelongsToParent('siswa-1', 'siswa-999', ['siswa-1', 'siswa-2']), false)
  
  // Case 4: No primary child
  assert.equal(verifyChildBelongsToParent(null, 'siswa-1', []), false)
})

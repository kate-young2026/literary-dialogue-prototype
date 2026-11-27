import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentCode, codeDigest, verifyStudentCode } from '../lib/student-code.mjs';

test('학생 코드는 무작위로 생성하고 원본 없이 검증한다', () => {
  const first = createStudentCode(), second = createStudentCode();
  assert.match(first, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(first, second);
  const digest = codeDigest(first);
  assert.equal(verifyStudentCode(first, digest), true);
  assert.equal(verifyStudentCode(second, digest), false);
  assert.equal(verifyStudentCode('invalid', digest), false);
  assert.equal(verifyStudentCode(first, Buffer.alloc(1)), false);
});

import { describe, expect, it } from 'vitest';
import { getPasswordValidationError } from './password';

describe('password policy for new credentials', () => {
  it('accepts long passphrases without composition rules or trimming', () => {
    expect(getPasswordValidationError('velvet otters visit the moon')).toBeNull();
    expect(getPasswordValidationError('a varied password with spaces ')).toBeNull();
    expect(getPasswordValidationError('long'.repeat(16))).toBeNull();
  });
  it('requires fifteen Unicode code points and respects the bcrypt byte limit', () => {
    expect(getPasswordValidationError('short password')).toContain('15');
    expect(getPasswordValidationError('a'.repeat(73))).toContain('72');
    expect(getPasswordValidationError('🌙'.repeat(14))).toContain('15');
    expect(getPasswordValidationError('🌙'.repeat(19))).toContain('72');
    expect(getPasswordValidationError('明亮星光照耀寂静山谷中的河流')).toContain('15');
    expect(getPasswordValidationError('明亮星光照耀寂静山谷中的清澈河流')).toBeNull();
  });
  it('rejects common whole passwords, repetition and null bytes', () => {
    expect(getPasswordValidationError('passwordpassword')).toBeTruthy();
    expect(getPasswordValidationError('a'.repeat(20))).toBeTruthy();
    expect(getPasswordValidationError('a long\0password here')).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import { isEmailCode, normalizeEmailCode, readConfirmationToken } from './email-code';

describe('email verification inputs', () => {
  it('preserves leading zeros and accepts configured local/hosted numeric codes', () => {
    expect(normalizeEmailCode('0012 3456')).toBe('00123456');
    expect(isEmailCode('001234')).toBe(true);
    expect(isEmailCode('0012 3456')).toBe(true);
    expect(isEmailCode('12345')).toBe(false);
    expect(isEmailCode('12345678901')).toBe(false);
    expect(isEmailCode('12345x')).toBe(false);
  });
  it('accepts a bounded confirmation fragment without trusting redirect/type inputs', () => {
    const token = 'a'.repeat(56);
    expect(readConfirmationToken(`#token_hash=${token}&type=recovery&next=https://evil.test`)).toBe(token);
    expect(readConfirmationToken(`#token_hash=${token}&token_hash=${token}`)).toBeNull();
    expect(readConfirmationToken('#token_hash=<script>')).toBeNull();
    expect(readConfirmationToken(`#token_hash=${'a'.repeat(129)}`)).toBeNull();
    expect(readConfirmationToken('')).toBeNull();
  });
});

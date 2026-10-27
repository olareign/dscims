import { describe, expect, it } from 'vitest';
import { auditListQuery, inviteUserInput, loginInput, password, phone, purchaseDeviceInput, purchaseInput, sellerInput, userListQuery } from './schemas.js';

describe('schemas', () => {
  it('normalises emails and rejects phone numbers as login ids', () => {
    expect(loginInput.parse({ email: ' Ada@Example.NG ', password: 'x' }).email).toBe('ada@example.ng');
    expect(loginInput.safeParse({ email: '0803 123 4567', password: 'x' }).success).toBe(false);
  });
  it('enforces the password policy', () => {
    expect(password.safeParse('short1').success).toBe(false);
    expect(password.safeParse('onlyletterslong').success).toBe(false);
    expect(password.safeParse('Longenough123').success).toBe(true);
  });
  it('does not let an invite create an owner', () => {
    const base = { name: 'Ada Eze', email: 'ada@example.ng', shopId: '00000000-0000-4000-8000-000000000000' };
    expect(inviteUserInput.safeParse({ ...base, role: 'owner' }).success).toBe(false);
    expect(inviteUserInput.safeParse({ ...base, role: 'staff' }).success).toBe(true);
  });
  it('applies paging defaults and caps page size', () => {
    expect(userListQuery.parse({})).toMatchObject({ page: 1, pageSize: 10, sort: 'name' });
    expect(userListQuery.safeParse({ pageSize: '500' }).success).toBe(false);
  });
  it('validates audit date filters', () => {
    expect(auditListQuery.safeParse({ from: '27-10-2026' }).success).toBe(false);
    expect(auditListQuery.safeParse({ from: '2026-10-27' }).success).toBe(true);
  });
});

describe('phase 2 schemas', () => {
  const device = { imei: '352910112233444', brand: 'Apple', model: 'iPhone 13', condition: 'nigeria_used', costKobo: 52_000_000, sellingKobo: 64_000_000 } as const;
  const purchase = { sellerId: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f', devices: [device], paymentMethod: 'cash', declaration: true, declaredBy: 'Musa Danjuma' } as const;

  it('stores Nigerian phone numbers as 11 digits however they are typed', () => {
    expect(phone.parse('0803 456 7812')).toBe('08034567812');
    expect(phone.parse('+234 803 456 7812')).toBe('08034567812');
    expect(phone.safeParse('12345').success).toBe(false);
  });
  it('keeps NIN and BVN optional but 11 digits when given', () => {
    const base = { name: 'Chinedu Nnaji', phone: '0902 515 6677', address: '14 Allen Avenue, Ikeja' };
    expect(sellerInput.safeParse(base).success).toBe(true);
    expect(sellerInput.safeParse({ ...base, nin: '', bvn: '' }).success).toBe(true);
    expect(sellerInput.safeParse({ ...base, nin: '1234' }).success).toBe(false);
    expect(sellerInput.parse({ ...base, nin: '123 4567 8901' }).nin).toBe('12345678901');
  });
  it('rejects an IMEI that fails the Luhn check', () => {
    expect(purchaseDeviceInput.safeParse(device).success).toBe(true);
    expect(purchaseDeviceInput.safeParse({ ...device, imei: '352910112233445' }).success).toBe(false);
  });
  it('needs a document, reference and issuer for a certificate or police credentials', () => {
    const r = purchaseDeviceInput.safeParse({ ...device, proofType: 'certificate_of_ownership' });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['proofFileId', 'proofReference', 'proofAuthority']));
  });
  it('needs the seller declaration and a signature to complete a purchase', () => {
    expect(purchaseInput.safeParse(purchase).success).toBe(true);
    expect(purchaseInput.safeParse({ ...purchase, declaration: false }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...purchase, declaredBy: '' }).success).toBe(false);
  });
  it('rejects a repeated IMEI and an empty purchase', () => {
    expect(purchaseInput.safeParse({ ...purchase, devices: [device, device] }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...purchase, devices: [] }).success).toBe(false);
  });
  it('says plainly when a price has too many zeros', () => {
    const r = purchaseDeviceInput.safeParse({ ...device, costKobo: 99_999_999_999_999 });
    expect(r.success ? '' : r.error.issues[0]!.message).toBe('That amount is too large. Check the zeros');
  });
  it('wants a smaller paid amount for a part payment', () => {
    expect(purchaseInput.safeParse({ ...purchase, paymentMethod: 'part' }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...purchase, paymentMethod: 'part', paidKobo: 100 }).success).toBe(true);
    expect(purchaseInput.safeParse({ ...purchase, paymentMethod: 'part', paidKobo: 52_000_000 }).success).toBe(false);
  });
});

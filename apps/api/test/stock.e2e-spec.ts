import request from 'supertest';
import { isValidImei } from '@dscims/shared';
import { addUser, bearer, bootApp, onboardDealer, uniq, type Ctx, type Dealer } from './helpers.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);

let seed = 100000;
/** A 15-digit IMEI with a valid Luhn check digit, different every call. */
function imei(): string {
  const body = `35291011${String(seed++).padStart(6, '0')}`;
  for (let check = 0; check < 10; check++) if (isValidImei(body + check)) return body + check;
  throw new Error('no check digit');
}

describe('stock, sellers and purchases (Phase 2)', () => {
  let ctx: Ctx;
  let dealer: Dealer;
  let shopB: string;
  let manager: { id: string; token: string };
  let managerB: { id: string; token: string };
  let staff: { id: string; token: string };
  let sellerId: string;

  const owner = () => bearer(dealer.ownerToken);

  const upload = (token: string, kind: string, buffer = PNG, name = 'proof.png') =>
    request(ctx.http).post('/files').set(bearer(token)).field('kind', kind).attach('file', buffer, name);

  const deviceBody = (over: Record<string, unknown> = {}) => ({
    imei: imei(), brand: 'Apple', model: 'iPhone 13', storage: '128 GB', colour: 'Blue', condition: 'nigeria_used', costKobo: 52_000_000, sellingKobo: 64_000_000, proofType: 'receipt', ...over,
  });
  const purchaseBody = (devices: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
    sellerId, devices, paymentMethod: 'cash', declaration: true, declaredBy: 'Musa Danjuma', ...over,
  });
  const buy = (token: string, devices: Record<string, unknown>[], over: Record<string, unknown> = {}) =>
    request(ctx.http).post('/purchases').set(bearer(token)).send(purchaseBody(devices, { shopId: dealer.shopId, ...over }));

  beforeAll(async () => {
    ctx = await bootApp();
    dealer = await onboardDealer(ctx);
    const shop = await request(ctx.http).post('/shops').set(owner()).send({ name: 'Alaba shop', address: '12 Alaba Market Road, Lagos' }).expect(201);
    shopB = shop.body.id;
    manager = await addUser(ctx, dealer, 'manager', 'Tunde Manager');
    managerB = await addUser(ctx, dealer, 'manager', 'Funmi Manager', shopB);
    staff = await addUser(ctx, dealer, 'staff', 'Chioma Staff');
    const seller = await request(ctx.http).post('/sellers').set(owner()).send({ name: 'Musa Danjuma', phone: '0803 456 7812', address: '5 Allen Avenue, Ikeja', nin: '12345678901', bvn: '10987654321' }).expect(201);
    sellerId = seller.body.id;
  });
  afterAll(async () => { await ctx.app.close(); });

  describe('sellers', () => {
    it('stores NIN and BVN encrypted and only ever returns the last 4 digits', async () => {
      const res = await request(ctx.http).get(`/sellers/${sellerId}`).set(owner()).expect(200);
      expect(res.body).toMatchObject({ name: 'Musa Danjuma', phone: '08034567812', ninLast4: '8901', bvnLast4: '4321', hasId: false });
      expect(JSON.stringify(res.body)).not.toContain('12345678901');
      const row = (await ctx.ds.query('SELECT nin_encrypted, bvn_encrypted FROM sellers WHERE id = $1', [sellerId]))[0];
      expect(row.nin_encrypted).not.toContain('12345678901');
      expect(row.nin_encrypted.startsWith('v1.')).toBe(true);
    });

    it('keeps NIN and BVN optional and blocks a second seller with the same phone', async () => {
      await request(ctx.http).post('/sellers').set(owner()).send({ name: 'Blessing Akpan', phone: '0816 220 4431', address: '9 Bode Thomas Street, Surulere' }).expect(201);
      const dup = await request(ctx.http).post('/sellers').set(owner()).send({ name: 'Someone Else', phone: '+234 816 220 4431', address: '1 Some Street, Lagos' }).expect(409);
      expect(dup.body.code).toBe('SELLER_PHONE_TAKEN');
    });

    it('rejects a short NIN and a bad phone number', async () => {
      const res = await request(ctx.http).post('/sellers').set(owner()).send({ name: 'Bad Input', phone: '123', address: '1 Some Street, Lagos', nin: '12' }).expect(400);
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['phone', 'nin']));
    });

    it('lets owners and managers use sellers but not sales staff', async () => {
      await request(ctx.http).get('/sellers').set(bearer(manager.token)).expect(200);
      await request(ctx.http).get('/sellers').set(bearer(staff.token)).expect(403);
      await request(ctx.http).post('/sellers').set(bearer(staff.token)).send({ name: 'No Way', phone: '0701 000 1111', address: '1 Some Street, Lagos' }).expect(403);
    });

    it('filters by search and by missing ID', async () => {
      const found = await request(ctx.http).get('/sellers?search=0816').set(owner()).expect(200);
      expect(found.body.items.map((s: { name: string }) => s.name)).toEqual(['Blessing Akpan']);
      const noId = await request(ctx.http).get('/sellers?tag=no_id').set(owner()).expect(200);
      expect(noId.body.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('files', () => {
    it('accepts JPG, PNG and PDF by their contents and refuses anything else', async () => {
      await upload(dealer.ownerToken, 'proof', PNG).expect(201);
      await upload(dealer.ownerToken, 'proof', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(32)]), 'receipt.pdf').expect(201);
      const bad = await upload(dealer.ownerToken, 'proof', Buffer.from('<script>alert(1)</script>'), 'x.png').expect(415);
      expect(bad.body.code).toBe('FILE_TYPE');
      await upload(dealer.ownerToken, 'device_photo', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(32)]), 'x.pdf').expect(415);
    });

    it('refuses files over 10 MB', async () => {
      const big = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024 + 10)]);
      const res = await upload(dealer.ownerToken, 'proof', big, 'big.jpg');
      expect([413, 500]).not.toContain(200);
      expect(res.status).toBe(413);
    });

    it('serves seller IDs and proof only to the people who can buy, but device photos to all', async () => {
      const proof = await upload(dealer.ownerToken, 'proof', JPEG, 'p.jpg').expect(201);
      const photo = await upload(dealer.ownerToken, 'device_photo', JPEG, 'ph.jpg').expect(201);
      await request(ctx.http).get(`/files/${proof.body.id}`).set(bearer(manager.token)).expect(200);
      await request(ctx.http).get(`/files/${proof.body.id}`).set(bearer(staff.token)).expect(403);
      await request(ctx.http).get(`/files/${photo.body.id}`).set(bearer(staff.token)).expect(200);
    });

    it('does not let sales staff upload', async () => {
      await upload(staff.token, 'device_photo', JPEG).expect(403);
    });
  });

  describe('purchases', () => {
    it('creates the phones, a numbered receipt and the first timeline entries', async () => {
      const proof = await upload(dealer.ownerToken, 'proof', PNG).expect(201);
      const photo = await upload(dealer.ownerToken, 'device_photo', JPEG, 'front.jpg').expect(201);
      const res = await buy(dealer.ownerToken, [deviceBody({ proofFileId: proof.body.id, photoFileIds: [photo.body.id] })]).expect(201);
      expect(res.body).toMatchObject({ number: expect.stringMatching(/^PUR-\d{6}$/), sellerName: 'Musa Danjuma', totalKobo: 52_000_000, paidKobo: 52_000_000, recordedByName: 'Olu Owner' });
      expect(res.body.devices[0].status).toBe('in_stock');

      const device = await request(ctx.http).get(`/devices/${res.body.devices[0].id}`).set(owner()).expect(200);
      expect(device.body).toMatchObject({ status: 'in_stock', costKobo: 52_000_000, sellerName: 'Musa Danjuma', purchaseNumber: res.body.number, proofType: 'receipt', proofApproved: true });
      expect(device.body.photos).toHaveLength(1);
      expect(device.body.events.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['received', 'proof', 'price_set']));

      const pdf = await request(ctx.http).get(`/purchases/${res.body.id}/receipt`).set(owner()).expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('numbers purchases one after another for each dealer', async () => {
      const a = await buy(dealer.ownerToken, [deviceBody()]).expect(201);
      const b = await buy(dealer.ownerToken, [deviceBody()]).expect(201);
      expect(Number(b.body.number.slice(4))).toBe(Number(a.body.number.slice(4)) + 1);
    });

    it('does not let sales staff record a purchase', async () => {
      await buy(staff.token, [deviceBody()]).expect(403);
    });

    it('requires the seller declaration, a signature and a valid IMEI', async () => {
      await buy(dealer.ownerToken, [deviceBody()], { declaration: false }).expect(400);
      await buy(dealer.ownerToken, [deviceBody()], { declaredBy: '' }).expect(400);
      const bad = await buy(dealer.ownerToken, [deviceBody({ imei: '123456789012345' })]).expect(400);
      expect(bad.body.errors[0].path).toBe('devices.0.imei');
    });

    it('blocks a duplicate IMEI and creates nothing from that purchase', async () => {
      const first = deviceBody();
      await buy(dealer.ownerToken, [first]).expect(201);
      const before = await request(ctx.http).get('/devices/counts').set(owner()).expect(200);
      const fresh = deviceBody();
      const dup = await buy(dealer.ownerToken, [fresh, first]).expect(409);
      expect(dup.body.code).toBe('IMEI_EXISTS');
      const after = await request(ctx.http).get('/devices/counts').set(owner()).expect(200);
      expect(after.body.all).toBe(before.body.all);
      await buy(dealer.ownerToken, [fresh, { ...deviceBody(), imei: fresh.imei }]).expect(400);
    });

    it('checks an IMEI as it is typed', async () => {
      const used = deviceBody();
      await buy(dealer.ownerToken, [used]).expect(201);
      const taken = await request(ctx.http).get(`/devices/imei-check?imei=${used.imei}`).set(owner()).expect(200);
      expect(taken.body).toMatchObject({ valid: true, exists: true });
      const free = await request(ctx.http).get(`/devices/imei-check?imei=${imei()}`).set(owner()).expect(200);
      expect(free.body).toMatchObject({ valid: true, exists: false });
      const invalid = await request(ctx.http).get('/devices/imei-check?imei=12345').set(owner()).expect(200);
      expect(invalid.body.valid).toBe(false);
    });

    it('records one purchase when the same Idempotency-Key is sent twice', async () => {
      const body = purchaseBody([deviceBody()], { shopId: dealer.shopId });
      const key = uniq('idem');
      const one = await request(ctx.http).post('/purchases').set(owner()).set('Idempotency-Key', key).send(body).expect(201);
      const two = await request(ctx.http).post('/purchases').set(owner()).set('Idempotency-Key', key).send(body).expect(200);
      expect(two.body.id).toBe(one.body.id);
      const found = await request(ctx.http).get(`/devices?search=${body.devices[0].imei}`).set(owner()).expect(200);
      expect(found.body.total).toBe(1);
    });

    it('buys for a manager\'s own shop only, and needs a shop from the owner', async () => {
      const own = await request(ctx.http).post('/purchases').set(bearer(manager.token)).send(purchaseBody([deviceBody()])).expect(201);
      const device = await request(ctx.http).get(`/devices/${own.body.devices[0].id}`).set(owner()).expect(200);
      expect(device.body.shopId).toBe(dealer.shopId);
      await request(ctx.http).post('/purchases').set(bearer(manager.token)).send(purchaseBody([deviceBody()], { shopId: shopB })).expect(403);
      const noShop = await request(ctx.http).post('/purchases').set(owner()).send(purchaseBody([deviceBody()])).expect(400);
      expect(noShop.body.errors[0].path).toBe('shopId');
    });

    it('rejects a proof file that does not belong to this dealer', async () => {
      const other = await onboardDealer(ctx);
      const foreign = await upload(other.ownerToken, 'proof', PNG).expect(201);
      await buy(dealer.ownerToken, [deviceBody({ proofFileId: foreign.body.id, proofType: 'receipt' })]).expect(404);
    });
  });

  describe('proof of ownership approval (INV-1a)', () => {
    const certificate = async (token: string) => {
      const file = await upload(token, 'proof', PNG, 'cert.png').expect(201);
      return deviceBody({ proofType: 'certificate_of_ownership', proofFileId: file.body.id, proofReference: 'CERT-2291', proofAuthority: 'Lagos State Ministry of Commerce' });
    };

    it('needs the document, a reference and who issued it', async () => {
      const res = await buy(dealer.ownerToken, [deviceBody({ proofType: 'police_or_government_credentials' })]).expect(400);
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['devices.0.proofFileId', 'devices.0.proofReference', 'devices.0.proofAuthority']));
    });

    it('holds a manager\'s certificate purchase under review until the owner approves it', async () => {
      const res = await buy(manager.token, [await certificate(manager.token)]).expect(201);
      const id = res.body.devices[0].id;
      expect(res.body.devices[0].status).toBe('under_review');
      await request(ctx.http).post(`/devices/${id}/approve-proof`).set(bearer(manager.token)).expect(403);
      const approved = await request(ctx.http).post(`/devices/${id}/approve-proof`).set(owner()).expect(200);
      expect(approved.body).toMatchObject({ status: 'in_stock', proofApproved: true });
      expect(approved.body.events[0].type).toBe('proof_approved');
      await request(ctx.http).post(`/devices/${id}/approve-proof`).set(owner()).expect(409);
    });

    it('approves the owner\'s own certificate purchase on the spot', async () => {
      const res = await buy(dealer.ownerToken, [await certificate(dealer.ownerToken)]).expect(201);
      expect(res.body.devices[0].status).toBe('in_stock');
    });
  });

  describe('cost and seller are hidden from sales staff (AUTH-3)', () => {
    let imeiValue: string;
    let deviceId: string;
    beforeAll(async () => {
      const body = deviceBody({ model: 'Galaxy A54', brand: 'Samsung' });
      imeiValue = body.imei;
      deviceId = (await buy(dealer.ownerToken, [body]).expect(201)).body.devices[0].id;
    });

    it('leaves cost, seller and proof out of the list and detail responses', async () => {
      const list = await request(ctx.http).get(`/devices?search=${imeiValue}`).set(bearer(staff.token)).expect(200);
      expect(list.body.items[0]).toMatchObject({ model: 'Galaxy A54', sellingKobo: 64_000_000 });
      expect(list.body.items[0]).not.toHaveProperty('costKobo');
      expect(list.body.items[0]).not.toHaveProperty('sellerName');
      const detail = await request(ctx.http).get(`/devices/${deviceId}`).set(bearer(staff.token)).expect(200);
      for (const field of ['costKobo', 'sellerName', 'sellerId', 'purchaseNumber', 'proofType', 'proofFileId']) expect(detail.body).not.toHaveProperty(field);
      expect(JSON.stringify(detail.body)).not.toMatch(/Musa|PUR-|receipt/i);
      expect(detail.body.events.map((e: { type: string }) => e.type)).not.toContain('proof');
    });

    it('does not let staff find phones by seller name or purchase number', async () => {
      const bySeller = await request(ctx.http).get('/devices?search=Musa').set(bearer(staff.token)).expect(200);
      expect(bySeller.body.total).toBe(0);
      const byOwner = await request(ctx.http).get('/devices?search=Musa').set(owner()).expect(200);
      expect(byOwner.body.total).toBeGreaterThan(0);
    });

    it('shows stock value at cost to the owner and managers only', async () => {
      const staffCounts = await request(ctx.http).get('/devices/counts').set(bearer(staff.token)).expect(200);
      expect(staffCounts.body).not.toHaveProperty('stockAtCostKobo');
      const mgrCounts = await request(ctx.http).get('/devices/counts').set(bearer(manager.token)).expect(200);
      expect(mgrCounts.body.stockAtCostKobo).toBeGreaterThan(0);
    });

    it('lets managers see cost price, and only owners resolve flags or approve proof', async () => {
      const detail = await request(ctx.http).get(`/devices/${deviceId}`).set(bearer(manager.token)).expect(200);
      expect(detail.body.costKobo).toBe(52_000_000);
    });

    it('does not let staff edit prices', async () => {
      await request(ctx.http).patch(`/devices/${deviceId}`).set(bearer(staff.token)).send({ sellingKobo: 1_000_000 }).expect(403);
    });
  });

  describe('flags (INV-7, INV-8)', () => {
    let id: string;
    beforeEach(async () => {
      id = (await buy(dealer.ownerToken, [deviceBody()]).expect(201)).body.devices[0].id;
    });

    it('lets anyone flag, blocks the phone, and keeps the flag in its timeline', async () => {
      const res = await request(ctx.http).post(`/devices/${id}/flag`).set(bearer(staff.token)).send({ type: 'reported_stolen', reference: 'POL/22/1043', note: 'Customer says it was stolen last week' }).expect(200);
      expect(res.body.status).toBe('flagged');
      expect(res.body.openFlag).toMatchObject({ type: 'reported_stolen', reference: 'POL/22/1043', raisedByName: 'Chioma Staff' });
      expect(res.body.events[0].type).toBe('flagged');
      const again = await request(ctx.http).post(`/devices/${id}/flag`).set(owner()).send({ type: 'other', note: 'second flag' }).expect(409);
      expect(again.body.code).toBe('ALREADY_FLAGGED');
    });

    it('lets only the owner resolve, and Cleared restores the earlier status', async () => {
      await request(ctx.http).post(`/devices/${id}/flag`).set(bearer(manager.token)).send({ type: 'security_concern', note: 'IMEI check looked odd' }).expect(200);
      await request(ctx.http).post(`/devices/${id}/resolve-flag`).set(bearer(manager.token)).send({ outcome: 'cleared', note: 'Checked, fine' }).expect(403);
      await request(ctx.http).post(`/devices/${id}/resolve-flag`).set(owner()).send({ outcome: 'cleared', note: '' }).expect(400);
      const res = await request(ctx.http).post(`/devices/${id}/resolve-flag`).set(owner()).send({ outcome: 'cleared', note: 'Checked with the network, clean' }).expect(200);
      expect(res.body.status).toBe('in_stock');
      expect(res.body.openFlag).toBeNull();
      expect(res.body.flags[0]).toMatchObject({ outcome: 'cleared', resolvedByName: 'Olu Owner' });
      expect(res.body.events.map((e: { type: string }) => e.type).slice(0, 2)).toEqual(['flag_resolved', 'flagged']);
      await request(ctx.http).post(`/devices/${id}/resolve-flag`).set(owner()).send({ outcome: 'cleared', note: 'again' }).expect(409);
    });

    it('closes the record when the flag ends in a write-off or release to authority', async () => {
      await request(ctx.http).post(`/devices/${id}/flag`).set(owner()).send({ type: 'police_case', note: 'Police asked to hold it' }).expect(200);
      const res = await request(ctx.http).post(`/devices/${id}/resolve-flag`).set(owner()).send({ outcome: 'released_to_authority', note: 'Handed to Ikeja division' }).expect(200);
      expect(res.body.status).toBe('written_off');
      await request(ctx.http).post(`/devices/${id}/flag`).set(owner()).send({ type: 'other', note: 'too late' }).expect(409);
    });

    it('lists flagged phones under their own filter and count', async () => {
      await request(ctx.http).post(`/devices/${id}/flag`).set(owner()).send({ type: 'customer_complaint', note: 'Customer complained about the battery' }).expect(200);
      const flagged = await request(ctx.http).get('/devices?status=flagged').set(owner()).expect(200);
      expect(flagged.body.items.map((d: { id: string }) => d.id)).toContain(id);
      const counts = await request(ctx.http).get('/devices/counts').set(owner()).expect(200);
      expect(counts.body.flagged).toBeGreaterThan(0);
    });
  });

  describe('editing and photos', () => {
    it('lets managers change the price, records it, and caps photos at 6', async () => {
      const id = (await buy(dealer.ownerToken, [deviceBody()]).expect(201)).body.devices[0].id;
      const res = await request(ctx.http).patch(`/devices/${id}`).set(bearer(manager.token)).send({ sellingKobo: 66_000_000, colour: 'Midnight' }).expect(200);
      expect(res.body).toMatchObject({ sellingKobo: 66_000_000, colour: 'Midnight' });
      expect(res.body.events.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['price_set', 'edited']));
      for (let i = 0; i < 6; i++) {
        const photo = await upload(manager.token, 'device_photo', JPEG, `p${i}.jpg`).expect(201);
        await request(ctx.http).post(`/devices/${id}/photos`).set(bearer(manager.token)).send({ fileId: photo.body.id }).expect(201);
      }
      const extra = await upload(manager.token, 'device_photo', JPEG, 'p7.jpg').expect(201);
      const full = await request(ctx.http).post(`/devices/${id}/photos`).set(bearer(manager.token)).send({ fileId: extra.body.id }).expect(400);
      expect(full.body.code).toBe('PHOTO_LIMIT');
    });
  });

  describe('shop scope', () => {
    it('keeps a manager to their own shop and lets the owner see every shop', async () => {
      const inA = (await buy(dealer.ownerToken, [deviceBody()]).expect(201)).body.devices[0];
      await request(ctx.http).get(`/devices/${inA.id}`).set(bearer(managerB.token)).expect(404);
      await request(ctx.http).patch(`/devices/${inA.id}`).set(bearer(managerB.token)).send({ colour: 'Red' }).expect(404);
      const list = await request(ctx.http).get(`/devices?search=${inA.imei}`).set(bearer(managerB.token)).expect(200);
      expect(list.body.total).toBe(0);
      const mine = await request(ctx.http).post('/purchases').set(bearer(managerB.token)).send(purchaseBody([deviceBody()])).expect(201);
      const all = await request(ctx.http).get('/devices?pageSize=50').set(owner()).expect(200);
      const ids = all.body.items.map((d: { id: string }) => d.id);
      expect(ids).toContain(mine.body.devices[0].id);
      const onlyB = await request(ctx.http).get(`/devices?shopId=${shopB}`).set(owner()).expect(200);
      expect(onlyB.body.items.every((d: { shopId: string }) => d.shopId === shopB)).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    it('hides every record from another dealer and allows the same IMEI there', async () => {
      const other = await onboardDealer(ctx);
      const body = deviceBody();
      const mine = await buy(dealer.ownerToken, [body]).expect(201);
      const theirs = bearer(other.ownerToken);
      await request(ctx.http).get(`/devices/${mine.body.devices[0].id}`).set(theirs).expect(404);
      await request(ctx.http).get(`/sellers/${sellerId}`).set(theirs).expect(404);
      await request(ctx.http).get(`/purchases/${mine.body.id}`).set(theirs).expect(404);
      await request(ctx.http).post(`/devices/${mine.body.devices[0].id}/flag`).set(theirs).send({ type: 'other', note: 'not yours' }).expect(404);
      const list = await request(ctx.http).get('/devices').set(theirs).expect(200);
      expect(list.body.total).toBe(0);
      expect((await request(ctx.http).get('/devices/counts').set(theirs).expect(200)).body.all).toBe(0);
      const file = await upload(dealer.ownerToken, 'proof').expect(201);
      await request(ctx.http).get(`/files/${file.body.id}`).set(theirs).expect(404);
      // Their own seller and purchase of the same IMEI are fine.
      const seller = await request(ctx.http).post('/sellers').set(theirs).send({ name: 'Their Seller', phone: '0803 456 7812', address: '5 Allen Avenue, Ikeja' }).expect(201);
      await request(ctx.http).post('/purchases').set(theirs).send({ ...purchaseBody([body]), sellerId: seller.body.id, shopId: other.shopId }).expect(201);
    });
  });

  describe('audit and evidence', () => {
    it('records purchases, flags and seller registration in the audit log without NIN or BVN', async () => {
      const log = await request(ctx.http).get('/audit?category=stock&pageSize=50').set(owner()).expect(200);
      const actions = log.body.items.map((e: { action: string }) => e.action);
      expect(actions).toEqual(expect.arrayContaining(['seller.created', 'purchase.recorded', 'device.flagged', 'device.flag_resolved', 'device.proof_approved']));
      expect(JSON.stringify(log.body)).not.toMatch(/12345678901|10987654321/);
      await request(ctx.http).get('/audit?category=stock').set(bearer(manager.token)).expect(403);
    });

    it('keeps the device timeline append-only, even for the database owner', async () => {
      const id = (await buy(dealer.ownerToken, [deviceBody()]).expect(201)).body.devices[0].id;
      await expect(ctx.ds.query("UPDATE device_events SET title = 'changed' WHERE device_id = $1", [id])).rejects.toThrow(/append-only/);
      await expect(ctx.ds.query('DELETE FROM device_events WHERE device_id = $1', [id])).rejects.toThrow(/append-only/);
    });

    it('lists and counts by status, condition and age', async () => {
      const filtered = await request(ctx.http).get('/devices?condition=nigeria_used&status=in_stock&sort=price_high&pageSize=10').set(owner()).expect(200);
      expect(filtered.body.items.length).toBeGreaterThan(0);
      expect(filtered.body.items.every((d: { condition: string; status: string }) => d.condition === 'nigeria_used' && d.status === 'in_stock')).toBe(true);
      const over60 = await request(ctx.http).get('/devices?age=over60').set(owner()).expect(200);
      expect(over60.body.total).toBe(0);
      const counts = await request(ctx.http).get('/devices/counts').set(owner()).expect(200);
      expect(counts.body.over60Days).toBe(0);
    });
  });
});

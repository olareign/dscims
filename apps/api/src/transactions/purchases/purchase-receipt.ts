import PDFDocument from 'pdfkit';
import { PAYMENT_METHOD_LABELS, PROOF_LABELS, formatDateTime } from '@dscims/shared';
import type { PurchaseDto } from '@dscims/shared';
import { naira } from '../../inventory/events/device-events.service.js';

const RECEIPT_NOTE = 'This is a record of a purchase. It does not prove a device is not stolen.';

/** One-page purchase receipt. The dealer keeps it with the seller's declaration. */
export function purchaseReceiptPdf(purchase: PurchaseDto, businessName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Purchase receipt ${purchase.number}`, Author: businessName } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(businessName, { continued: false });
    doc.fontSize(11).fillColor('#475569').text(`Purchase receipt ${purchase.number}`).moveDown(0.8);
    doc.fillColor('#0F172A').fontSize(11);
    const row = (label: string, value: string) => { doc.fillColor('#64748B').text(label, { continued: true, width: 140 }).fillColor('#0F172A').text(`  ${value}`); };
    row('Seller', purchase.sellerName);
    row('Shop', purchase.shopName);
    row('Date', formatDateTime(purchase.createdAt));
    row('Recorded by', purchase.recordedByName);
    row('Payment', `${PAYMENT_METHOD_LABELS[purchase.paymentMethod]}, ${naira(purchase.paidKobo)} paid`);
    doc.moveDown(0.8).fontSize(12).text('Phones').moveDown(0.3).fontSize(10.5);
    for (const d of purchase.devices) {
      doc.text(`${d.brand} ${d.model}${d.storage ? ` ${d.storage}` : ''}${d.colour ? `, ${d.colour}` : ''}`, { continued: true }).text(`   ${naira(d.costKobo)}`, { align: 'right' });
      doc.fillColor('#64748B').text(`IMEI ${d.imei}. Proof: ${PROOF_LABELS[d.proofType]}`).fillColor('#0F172A').moveDown(0.3);
    }
    doc.moveDown(0.4).fontSize(12).text(`Total ${naira(purchase.totalKobo)}`, { align: 'right' }).moveDown(1);
    doc.fontSize(10.5).text(`Seller's declaration: ${purchase.declaredBy} confirmed on ${formatDateTime(purchase.declaredAt)} that the phone${purchase.devices.length === 1 ? ' is' : 's are'} theirs, not stolen, and that they may sell ${purchase.devices.length === 1 ? 'it' : 'them'}.`);
    doc.moveDown(1).fillColor('#64748B').fontSize(9).text(RECEIPT_NOTE);
    doc.end();
  });
}

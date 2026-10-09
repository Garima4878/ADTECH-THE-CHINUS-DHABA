// Makes one QR code per table, linking to the customer website with that table number.
//
//   npm run qr -- https://<website-address>              # tables T01-T10
//   npm run qr -- https://<website-address> --tables 12  # tables T01-T12
//   npm run qr -- http://192.168.1.5:8080                # phone testing with `npm run demo`
//
// Output in qr-codes/: T01.png ... and print.html (cards with the restaurant name and table number,
// ready to print on A4 and cut out). Table IDs match `npm run seed` and the dashboard's Tables page.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const OUT_DIR = path.join(__dirname, '..', 'qr-codes');

const parseArgs = (argv) => {
  const args = { url: null, tables: Number(process.env.SEED_TABLES) || 10 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tables') args.tables = Number(argv[(i += 1)]);
    else if (!args.url) args.url = argv[i];
  }
  return args;
};

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const printPage = (cards, baseUrl) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Table QR codes - The Chinu Family Restaurant &amp; Dhaba</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #2b1a14; }
  .note { margin: 12px; font-size: 13px; color: #555; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; padding: 4mm; }
  .card { border: 2px dashed #b9a597; border-radius: 10px; padding: 6mm; text-align: center; break-inside: avoid; }
  .name { font-size: 16px; font-weight: bold; color: #7a1f2b; }
  .tagline { font-size: 12px; margin-top: 2px; }
  .card img { width: 52mm; height: 52mm; margin: 4mm auto 2mm; display: block; }
  .scan { font-size: 15px; font-weight: bold; }
  .table { font-size: 30px; font-weight: bold; color: #7a1f2b; margin-top: 2mm; }
  .url { font-size: 9px; color: #777; word-break: break-all; margin-top: 2mm; }
  @media print { .note { display: none; } }
</style>
</head>
<body>
<p class="note">Printing tip: use A4, 100% scale. Cut along the dashed lines. Every code opens ${escapeHtml(baseUrl)}/?table=… Test one with your phone before printing all.</p>
<div class="grid">
${cards
  .map(
    (card) => `  <div class="card">
    <div class="name">The Chinu Family Restaurant &amp; Dhaba</div>
    <div class="tagline">स्वाद के साथ, समझौता नहीं</div>
    <img src="${card.dataUrl}" alt="QR code for table ${card.table}">
    <div class="scan">Scan to see the menu &amp; order</div>
    <div class="table">Table ${card.table}</div>
    <div class="url">${escapeHtml(card.url)}</div>
  </div>`
  )
  .join('\n')}
</div>
</body>
</html>
`;

const main = async () => {
  const { url, tables } = parseArgs(process.argv.slice(2));

  let base;
  try {
    base = new URL(url);
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error();
  } catch {
    console.error('Usage: npm run qr -- https://<website-address> [--tables 10]');
    process.exit(1);
  }
  if (!(Number.isInteger(tables) && tables >= 1 && tables <= 99)) {
    console.error('--tables must be a whole number from 1 to 99.');
    process.exit(1);
  }
  if (['localhost', '127.0.0.1'].includes(base.hostname)) {
    console.warn('Warning: phones cannot open "localhost". Use the website address, or your PC\'s Wi-Fi address shown by `npm run demo`.');
  }
  if (base.protocol === 'http:' && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base.hostname)) {
    console.warn('Warning: the live website should use https://.');
  }

  const baseUrl = `${base.origin}${base.pathname.replace(/\/+$/, '')}`;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cards = [];
  for (let number = 1; number <= tables; number += 1) {
    const table = `T${String(number).padStart(2, '0')}`;
    const link = `${baseUrl}/?table=${table}`;
    const options = { errorCorrectionLevel: 'M', margin: 2, width: 600 };
    await QRCode.toFile(path.join(OUT_DIR, `${table}.png`), link, options);
    cards.push({ table, url: link, dataUrl: await QRCode.toDataURL(link, options) });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'print.html'), printPage(cards, baseUrl));
  console.log(`Made ${tables} QR codes in ${OUT_DIR}`);
  console.log(`  ${cards[0].table}.png ... ${cards[cards.length - 1].table}.png -> ${cards[0].url}`);
  console.log('  print.html -> open in a browser and print (A4)');
};

main().catch((error) => {
  console.error('Could not make QR codes:', error.message);
  process.exit(1);
});

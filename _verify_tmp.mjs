import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

// Test 1: Helvetica encoding Chinese (txtToPdf / wordToPdf path)
try {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText('机密文件测试', { x: 50, y: 800, size: 12, font, color: rgb(0,0,0) });
  await doc.save();
  console.log('TEST1 Helvetica+Chinese: OK (no error)');
} catch (e) {
  console.log('TEST1 Helvetica+Chinese: THROWS ->', e.message.split('\n')[0]);
}

// Test 2: feed raw PDF bytes to sharp (pdfToImages path)
try {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const pdfBytes = await doc.save();
  const out = await sharp(Buffer.from(pdfBytes)).png().toBuffer();
  console.log('TEST2 sharp(pdfBytes): OK len=', out.length);
} catch (e) {
  console.log('TEST2 sharp(pdfBytes): THROWS ->', e.message.split('\n')[0]);
}

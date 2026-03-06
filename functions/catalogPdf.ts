import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const PDF_URLS = [
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/96f439ea9_exhibitors-handbook_p001-005.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/fa2d96f04_exhibitors-handbook_p006-010.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/44e40bba6_exhibitors-handbook_p011-015.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8f60bf7fc_exhibitors-handbook_p016-020.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/f1f8ef1c8_exhibitors-handbook_p021-025.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/b63e7ed26_exhibitors-handbook_p026-030.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8c0c5ec5d_exhibitors-handbook_p031-035.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/854305152_exhibitors-handbook_p036-040.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ed1455046_exhibitors-handbook_p041-045.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/a731186ff_exhibitors-handbook_p046-050.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/a713f27cb_exhibitors-handbook_p051-055.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8f79a785c_exhibitors-handbook_p061-065.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4a399cd76_exhibitors-handbook_p066-070.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/f82e19db9_exhibitors-handbook_p071-075.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7ae81ab2f_exhibitors-handbook_p076-080.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/022a60eca_exhibitors-handbook_p081-085.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/acf440a1f_exhibitors-handbook_p086-090.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/510464716_exhibitors-handbook_p091-095.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ab3ab9e5a_exhibitors-handbook_p096-100.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/b91a3e4cb_exhibitors-handbook_p101-105.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4818a9bc5_exhibitors-handbook_p106-110.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/455b00486_exhibitors-handbook_p111-115.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8477ffd86_exhibitors-handbook_p116-120.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/04f6dca26_exhibitors-handbook_p121-125.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/6096b205b_exhibitors-handbook_p126-130.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4cbbc4149_exhibitors-handbook_p131-135.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/63bee2b79_exhibitors-handbook_p136-140.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ede072fe2_exhibitors-handbook_p146-150.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7bfcbade4_exhibitors-handbook_p151-155.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/76940cac3_exhibitors-handbook_p156-160.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7404245ec_exhibitors-handbook_p161-165.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/0e395ee7b_exhibitors-handbook_p166-170.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/09ae679a1_exhibitors-handbook_p176-180.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/20026656c_exhibitors-handbook_p181-185.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/e8f158557_exhibitors-handbook_p186-190.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/510d7b8aa_exhibitors-handbook_p191-195.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/75326516f_exhibitors-handbook_p196-200.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4302dc6c2_exhibitors-handbook_p201-205.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7484fc06b_exhibitors-handbook_p206-210.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/5b3814230_exhibitors-handbook_p211-215.pdf"
];

let cachedPdfBytes = null;

Deno.serve(async (req) => {
    try {
        if (cachedPdfBytes) {
            return new Response(cachedPdfBytes, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        const mergedPdf = await PDFDocument.create();

        // Fetch all PDFs in parallel
        const fetchPromises = PDF_URLS.map(url => fetch(url).then(res => res.arrayBuffer()));
        const buffers = await Promise.all(fetchPromises);

        for (const buffer of buffers) {
            const pdf = await PDFDocument.load(buffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        cachedPdfBytes = await mergedPdf.save();

        // Convert to base64
        let binary = '';
        const len = cachedPdfBytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(cachedPdfBytes[i]);
        }
        const base64 = btoa(binary);

        return Response.json({ base64 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});
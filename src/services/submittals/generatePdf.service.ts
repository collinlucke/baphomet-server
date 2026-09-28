import puppeteer from "puppeteer";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { appendixPageTemplate } from "./htmlTemplates/appendixPage.template.js";
import { coverPageTemplate } from "./htmlTemplates/coverPage.template.js";
import { materialPageTemplate } from "./htmlTemplates/materialPage.template.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUPPETEER_CACHE_DIR = path.resolve(
  process.cwd(),
  ".cache",
  "puppeteer",
);

if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = DEFAULT_PUPPETEER_CACHE_DIR;
}

async function getLogoBase64(): Promise<{ data: string; mime: string }> {
  const candidates = [
    // Production: built UI static assets
    path.resolve(
      __dirname,
      "../../ui/generate-submittals/public/submittals/full-logo.png",
    ),
    path.resolve(__dirname, "../../ui/submittals/full-logo.png"),
    path.resolve(
      __dirname,
      "../../../src/ui/generate-submittals/public/submittals/full-logo.png",
    ),
    // Dev source tree
    path.resolve(
      process.cwd(),
      "src/ui/generate-submittals/public/submittals/full-logo.png",
    ),
    path.resolve(
      process.cwd(),
      "dist/ui/generate-submittals/submittals/full-logo.png",
    ),
  ];

  for (const p of candidates) {
    try {
      const buf = await readFile(p);
      return { data: buf.toString("base64"), mime: "image/png" };
    } catch {
      // try next
    }
  }
  return { data: "", mime: "image/png" };
}

type Category = { categoryName: string };

type MaterialPageItem = {
  id: number;
  materialName: string;
  altName?: string;
  imageUrl?: string;
  categoryName?: string;
};

type MaterialPageData = {
  items: MaterialPageItem[];
  propertyName?: string;
  opportunityName?: string;
  pageNumber?: number;
  totalPages?: number;
};

type GeneratePdfOptions = {
  title: string;
  coverImageBase64?: string | null;
  coverImageMimeType?: string | null;
  coverImageUrl?: string | null;
  coverImageX?: number | null;
  coverImageY?: number | null;
  coverImageWidth?: number | null;
  coverImageHeight?: number | null;
  categories: Category[];
  materialPages?: MaterialPageData[];
  plantScheduleBase64?: string | null;
  plantScheduleMimeType?: string | null;
};

async function resolveCoverImage(options: GeneratePdfOptions): Promise<{
  base64: string | null;
  mimeType: string | null;
}> {
  if (options.coverImageBase64 && options.coverImageMimeType) {
    return {
      base64: options.coverImageBase64,
      mimeType: options.coverImageMimeType,
    };
  }

  if (options.coverImageUrl) {
    const response = await fetch(options.coverImageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch cover image (${response.status}) from URL`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType =
      response.headers.get("content-type") ||
      options.coverImageMimeType ||
      "image/jpeg";
    return {
      base64: buffer.toString("base64"),
      mimeType,
    };
  }

  return { base64: null, mimeType: null };
}

async function renderPageToPdf(html: string): Promise<Buffer> {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || (await puppeteer.executablePath());

  const browser = await puppeteer.launch(
    executablePath
      ? {
          executablePath,
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }
      : {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
  );

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });
    await page.setContent(html, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      width: "8.5in",
      height: "11in",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function createPageHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 816px;
    height: 1056px;
    background: white;
    font-family: Helvetica, Arial, sans-serif;
    overflow: hidden;
  }
  .page {
    width: 816px;
    height: 1056px;
    position: relative;
    background: white;
    overflow: hidden;
  }
  .title {
    font-size: 82px;
    font-weight: bold;
    color: #136739;
    text-shadow: 0 2px 3px rgba(0,0,0,0.2);
    line-height: 1.2;
    white-space: pre-wrap;
    max-height: 588px;
    overflow: hidden;
    padding: 48px;
  }
  .logo {
    position: absolute;
    bottom: 0;
    left: -180px;
    width: 816px;
    pointer-events: none;
  }
  .categories {
    position: absolute;
    bottom: 48px;
    right: 48px;
    text-align: right;
    max-width: 40%;
  }
  .material-page-content {
    padding: 48px 48px 84px 48px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 8px;
    position: relative;
    height: 100%;
    overflow: hidden;
  }
  .material-page-heading {
    font-size: 28px;
    font-weight: bold;
    color: #136739;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 2px solid #136739;
    padding-bottom: 2px;
    margin-top: 0;
    flex-shrink: 0;
  }
  .material-page-heading:not(:first-child) {
    margin-top: 4px;
  }
  .material-item {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .material-item.even {
    flex-direction: row;
  }
  .material-item.odd {
    flex-direction: row-reverse;
  }
  .material-image {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 3px solid #136739;
    overflow: hidden;
    background-color: #e8f5e9;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .material-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .material-image-placeholder {
    color: #136739;
    text-align: center;
    font-size: 11px;
    padding: 5px;
  }
  .ribbon-stack {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ribbon {
    height: 44px;
    background-color: #136739;
    display: flex;
    align-items: center;
    padding: 0 26px;
    color: white;
    font-weight: bold;
    font-size: 18px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ribbon.even {
    clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 18px 100%);
    text-align: left;
  }
  .ribbon.odd {
    clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 18px 100%);
    text-align: right;
  }
  .ribbon-alt-wrapper {
    display: flex;
    flex-shrink: 0;
  }
  .ribbon-alt {
    height: 36px;
    background-color: #1a7d47;
    display: flex;
    align-items: center;
    padding: 0 26px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    font-style: italic;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ribbon-alt.even {
    clip-path: polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
    text-align: right;
  }
  .ribbon-alt.odd {
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 100%, 18px 100%);
    text-align: left;
  }
  .material-page-footer {
    position: absolute;
    bottom: 18px;
    left: 48px;
    right: 48px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    border-top: 1px solid #136739;
    padding-top: 6px;
    height: 24px;
  }
  .material-page-footer-text {
    font-size: 11px;
    color: #136739;
    opacity: 0.8;
    text-align: right;
  }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

function extractPageMarkup(htmlDoc: string): string {
  const match = htmlDoc.match(/<div class="page">[\s\S]*<\/div>\s*<\/body>/i);
  if (!match) {
    return '<div class="page"></div>';
  }

  return match[0].replace(/\s*<\/body>$/i, "");
}

export async function generateSubmittalPdf(
  options: GeneratePdfOptions,
): Promise<Buffer> {
  const logo = await getLogoBase64();
  const coverImage = await resolveCoverImage(options);

  // Render cover page
  const coverMarkup = extractPageMarkup(
    coverPageTemplate({
      title: options.title,
      logoBase64: logo.data,
      logoMimeType: logo.mime,
      coverImageBase64: coverImage.base64,
      coverImageMimeType: coverImage.mimeType,
      coverImageX: options.coverImageX,
      coverImageY: options.coverImageY,
      coverImageWidth: options.coverImageWidth,
      coverImageHeight: options.coverImageHeight,
      categories: options.categories,
    }),
  );
  const coverHtml = createPageHtml(coverMarkup);

  const coverPdf = await renderPageToPdf(coverHtml);

  // Render material pages
  const materialPdfs: Buffer[] = [];
  for (const pageData of options.materialPages || []) {
    const pageNum = pageData.pageNumber;
    const materialHtml = createPageHtml(
      materialPageTemplate({
        items: pageData.items,
        propertyName: pageData.propertyName,
        opportunityName: pageData.opportunityName,
        pageNumber: pageNum,
        totalPages: pageData.totalPages,
        logoBase64: logo.data,
        logoMimeType: logo.mime,
      }),
    );

    const materialPdf = await renderPageToPdf(materialHtml);
    materialPdfs.push(materialPdf);
  }

  // Merge all PDFs
  const pdfDoc = await PDFDocument.load(coverPdf);

  for (const materialPdf of materialPdfs) {
    const srcPdf = await PDFDocument.load(materialPdf);
    const copiedPages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
    for (const page of copiedPages) {
      pdfDoc.addPage(page);
    }
  }

  if (options.plantScheduleBase64 && options.plantScheduleMimeType) {
    const appendixHtml = createPageHtml(
      appendixPageTemplate({
        imageBase64: options.plantScheduleBase64,
        imageMimeType: options.plantScheduleMimeType,
      }),
    );
    const appendixPdf = await renderPageToPdf(appendixHtml);
    const appendixDoc = await PDFDocument.load(appendixPdf);
    const appendixPages = await pdfDoc.copyPages(
      appendixDoc,
      appendixDoc.getPageIndices(),
    );
    for (const page of appendixPages) {
      pdfDoc.addPage(page);
    }
  }

  const mergedPdfBytes = await pdfDoc.save();
  return Buffer.from(mergedPdfBytes);
}

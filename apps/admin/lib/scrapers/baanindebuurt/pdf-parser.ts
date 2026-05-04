/**
 * PDF text extraction for Baanindebuurt.nl vacatures.
 * Pure-JS pdf2json eerst; valt terug op Mistral OCR voor image-based scans.
 */

import PDFParser from "pdf2json";

const PDF_PARSE_TIMEOUT_MS = 30_000;
const MIN_TEXT_LENGTH = 50;
const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";

export async function downloadAndExtractPdf(pdfUrl: string): Promise<string> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fast = await extractTextFromBuffer(buffer);
  if (fast.length >= MIN_TEXT_LENGTH) return fast;

  // Image-based PDF (krantenscan etc.) — laat Mistral OCR het lezen.
  return extractWithMistralOcr(pdfUrl);
}

function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // pdf2json's typings expect EventEmitter-style; cast to any only at the seam.
    const parser: any = new (PDFParser as any)(null, true);

    const timer = setTimeout(() => {
      reject(new Error("PDF extraction timed out"));
    }, PDF_PARSE_TIMEOUT_MS);

    parser.on("pdfParser_dataError", (errData: { parserError?: Error } | Error) => {
      clearTimeout(timer);
      const err = errData instanceof Error ? errData : errData.parserError;
      reject(err ?? new Error("Unknown PDF parser error"));
    });

    parser.on("pdfParser_dataReady", () => {
      clearTimeout(timer);
      try {
        const raw: string = parser.getRawTextContent();
        resolve(normalizeText(raw));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    parser.parseBuffer(buffer);
  });
}

async function extractWithMistralOcr(pdfUrl: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not set");
  }

  const res = await fetch(MISTRAL_OCR_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "document_url", document_url: pdfUrl },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mistral OCR ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as { pages?: Array<{ markdown?: string }> };
  const text = (data.pages ?? [])
    .map((p) => p.markdown ?? "")
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Mistral OCR returned empty result");
  }

  return text;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/----------------Page \(\d+\) Break----------------/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract PDF ID from URL
 * Example: https://baanindebuurt.nl/pdf/1768481602.pdf -> 1768481602
 */
export function extractPdfId(pdfUrl: string): string {
  const match = pdfUrl.match(/\/pdf\/(\d+)\.pdf/);
  if (!match) {
    throw new Error(`Could not extract PDF ID from URL: ${pdfUrl}`);
  }
  return match[1];
}

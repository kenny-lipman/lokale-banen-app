/**
 * PDF text extraction for Baanindebuurt.nl vacatures
 * Using pdfplumber via Python subprocess for reliable extraction
 */

import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

/**
 * Download a PDF and extract text using pdfplumber (Python)
 */
export async function downloadAndExtractPdf(pdfUrl: string): Promise<string> {
  const tempPath = join(tmpdir(), `vacature-${randomUUID()}.pdf`);

  try {
    // Download PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempPath, buffer);

    // Extract text using pdfplumber via Python
    const pythonScript = `
import pdfplumber
import sys

try:
    with pdfplumber.open('${tempPath}') as pdf:
        text = ''
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + '\\n'
        print(text)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

    const { stdout, stderr } = await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stdout) {
      throw new Error(`PDF extraction failed: ${stderr}`);
    }

    return stdout.trim();
  } catch (error) {
    console.error(`Error downloading/extracting PDF from ${pdfUrl}:`, error);
    throw error;
  } finally {
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {
      /* ignore cleanup errors */
    });
  }
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

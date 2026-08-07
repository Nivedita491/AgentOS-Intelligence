import { unzipSync } from "npm:fflate@0.8.2";
import { contentHash } from "./embeddingService.ts";
import type { ParsedBlock, ParsedDocument, SemanticChunk } from "./types.ts";

const decoder = new TextDecoder("utf-8", { fatal: false });
const encoder = new TextEncoder();

function decodeFile(file: Uint8Array): string {
  return decoder.decode(file);
}

function xmlText(value: string): string {
  return value
    .replace(/<w:tab\s*\/?\s*>/g, "\t")
    .replace(/<w:br\s*\/?\s*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeHeading(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export function cleanText(input: string): string {
  const lines = input
    .replaceAll("\0", "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trimEnd());
  const occurrences = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized.length >= 4 && normalized.length <= 90) {
      occurrences.set(normalized, (occurrences.get(normalized) ?? 0) + 1);
    }
  }
  const withoutRepeatedPageFurniture = lines.filter((line) => {
    const normalized = line.trim().toLowerCase();
    return !(normalized && (occurrences.get(normalized) ?? 0) >= 3 && /page|confidential|copyright|internal use/.test(normalized));
  });
  return withoutRepeatedPageFurniture
    .join("\n")
    .replace(/([^\n])-\n([a-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMarkdown(text: string): ParsedDocument {
  const blocks: ParsedBlock[] = [];
  const headings: string[] = [];
  let paragraph: string[] = [];
  let code = false;
  const flush = (kind: ParsedBlock["kind"] = "paragraph") => {
    const value = cleanText(paragraph.join("\n"));
    if (value) blocks.push({ text: value, headingPath: [...headings], sectionTitle: headings.at(-1) ?? null, kind });
    paragraph = [];
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^```/.test(line.trim())) {
      paragraph.push(line);
      code = !code;
      if (!code) flush("code");
      continue;
    }
    if (!code) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        flush();
        const level = match[1].length;
        headings.splice(level - 1);
        headings[level - 1] = normalizeHeading(match[2]);
        continue;
      }
      if (/^\|.+\|\s*$/.test(line)) {
        paragraph.push(line);
        continue;
      }
      if (!line.trim()) {
        flush(paragraph.some((part) => /^\|/.test(part)) ? "table" : "paragraph");
        continue;
      }
    }
    paragraph.push(line);
  }
  flush(code ? "code" : paragraph.some((part) => /^\|/.test(part)) ? "table" : "paragraph");
  return { text: cleanText(text), blocks, pageCount: 1, metadata: { format: "markdown" } };
}

function parsePlainText(text: string): ParsedDocument {
  const blocks: ParsedBlock[] = [];
  const headings: string[] = [];
  for (const part of cleanText(text).split(/\n\s*\n/)) {
    const lines = part.split("\n");
    const first = lines[0]?.trim() ?? "";
    const isHeading = lines.length === 1 && first.length < 120 && (/^[A-Z][A-Z0-9 /&:()-]{3,}$/.test(first) || /^\d+(?:\.\d+)*\s+/.test(first));
    if (isHeading) {
      headings.splice(0, headings.length, normalizeHeading(first));
      continue;
    }
    if (part.trim()) blocks.push({ text: part.trim(), headingPath: [...headings], sectionTitle: headings.at(-1) ?? null, kind: "paragraph" });
  }
  return { text: cleanText(text), blocks, pageCount: 1, metadata: { format: "text" } };
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function tableBlocks(headers: string[], rows: string[][], title: string, pageNumber: number | null = 1): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (let start = 0; start < rows.length; start += 20) {
    const group = rows.slice(start, start + 20);
    const text = [
      `Table: ${title}${rows.length > 20 ? ` (rows ${start + 1}-${start + group.length})` : ""}`,
      headers.join(" | "),
      ...group.map((row) => headers.map((header, index) => `${header}: ${row[index] ?? ""}`).join(" | ")),
    ].join("\n");
    blocks.push({ text, pageNumber, headingPath: [title], sectionTitle: title, kind: "table" });
  }
  return blocks;
}

function parseCsv(text: string): ParsedDocument {
  const rows = parseCsvRows(text);
  const headers = rows.shift() ?? [];
  const blocks = tableBlocks(headers, rows, "CSV data");
  return { text: cleanText(text), blocks, pageCount: 1, metadata: { format: "csv", headers, rowCount: rows.length } };
}

function extractDocx(bytes: Uint8Array): ParsedDocument {
  const files = unzipSync(bytes);
  const xml = decodeFile(files["word/document.xml"] ?? new Uint8Array());
  if (!xml) throw new Error("DOCX document.xml is missing.");
  const blocks: ParsedBlock[] = [];
  const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? [];
  for (const [tableIndex, table] of tables.entries()) {
    const rows = (table.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((row) =>
      (row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []).map((cell) => cleanText(xmlText(cell))),
    );
    if (rows.length) blocks.push(...tableBlocks(rows[0], rows.slice(1), `Table ${tableIndex + 1}`));
  }
  const withoutTables = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, "");
  const headingPath: string[] = [];
  for (const paragraph of withoutTables.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    const text = cleanText(xmlText(paragraph));
    if (!text) continue;
    const style = paragraph.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] ?? "";
    const level = Number(style.match(/(?:Heading|heading)(\d)/)?.[1]);
    if (level) {
      headingPath.splice(level - 1);
      headingPath[level - 1] = text;
    } else {
      blocks.push({ text, headingPath: [...headingPath], sectionTitle: headingPath.at(-1) ?? null, kind: /^[-•*]\s/.test(text) ? "list" : "paragraph" });
    }
  }
  const text = blocks.map((block) => block.text).join("\n\n");
  return { text, blocks, pageCount: null, metadata: { format: "docx", tableCount: tables.length } };
}

function cellReferenceColumn(reference: string): number {
  const letters = reference.replace(/\d/g, "");
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function extractXlsx(bytes: Uint8Array): ParsedDocument {
  const files = unzipSync(bytes);
  const sharedStringsXml = decodeFile(files["xl/sharedStrings.xml"] ?? new Uint8Array());
  const sharedStrings = (sharedStringsXml.match(/<si\b[\s\S]*?<\/si>/g) ?? []).map((entry) => cleanText(xmlText(entry)));
  const sheetPaths = Object.keys(files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).sort();
  const blocks: ParsedBlock[] = [];
  for (const sheetPath of sheetPaths) {
    const xml = decodeFile(files[sheetPath]);
    const rows: string[][] = [];
    for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      const cells: string[] = [];
      for (const cell of rowXml.match(/<c\b[\s\S]*?<\/c>/g) ?? []) {
        const reference = cell.match(/\br="([A-Z]+\d+)"/)?.[1] ?? "A1";
        const column = cellReferenceColumn(reference);
        const type = cell.match(/\bt="([^"]+)"/)?.[1];
        const raw = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? xmlText(cell);
        cells[column] = type === "s" ? sharedStrings[Number(raw)] ?? "" : cleanText(raw);
      }
      if (cells.some(Boolean)) rows.push(cells);
    }
    const headers = rows.shift() ?? [];
    blocks.push(...tableBlocks(headers, rows, sheetPath.replace(/^.*\/(sheet\d+)\.xml$/, "$1")));
  }
  return { text: blocks.map((block) => block.text).join("\n\n"), blocks, pageCount: null, metadata: { format: "xlsx", sheetCount: sheetPaths.length } };
}

function extractPptx(bytes: Uint8Array): ParsedDocument {
  const files = unzipSync(bytes);
  const slidePaths = Object.keys(files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  const blocks: ParsedBlock[] = [];
  for (const [index, path] of slidePaths.entries()) {
    const slideText = cleanText(xmlText(decodeFile(files[path])));
    const notesPath = `ppt/notesSlides/notesSlide${index + 1}.xml`;
    const notes = files[notesPath] ? cleanText(xmlText(decodeFile(files[notesPath]))) : "";
    if (!slideText && !notes) continue;
    const title = slideText.split("\n").find(Boolean) ?? `Slide ${index + 1}`;
    blocks.push({
      text: [`Slide ${index + 1}: ${title}`, slideText, notes ? `Speaker notes:\n${notes}` : ""].filter(Boolean).join("\n\n"),
      pageNumber: index + 1,
      headingPath: [title],
      sectionTitle: title,
      kind: "paragraph",
    });
  }
  return { text: blocks.map((block) => block.text).join("\n\n"), blocks, pageCount: slidePaths.length, metadata: { format: "pptx", slideCount: slidePaths.length } };
}

function encodeBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

async function extractWithGemini(bytes: Uint8Array, mimeType: string, mode: "pdf" | "image"): Promise<ParsedDocument> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error(`${mode === "pdf" ? "PDF extraction" : "Image OCR"} requires GEMINI_API_KEY; no placeholder text was indexed.`);
  const prompt = mode === "pdf"
    ? "Extract this PDF faithfully. Return JSON only: {pages:[{pageNumber:number,text:string,headings:string[],tables:[{title:string,headers:string[],rows:string[][]}]}]}. Preserve page numbers, headings, lists, and tables. Do not summarize or invent missing text."
    : "Perform OCR on this image. Return JSON only: {text:string}. Preserve visible text and line breaks. Do not infer unreadable text.";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: encodeBase64(bytes) } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${mode} extraction failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const raw = (await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`Gemini ${mode} extraction returned invalid JSON.`); }
  if (mode === "image") {
    const text = typeof (parsed as { text?: unknown })?.text === "string" ? (parsed as { text: string }).text : "";
    if (!text.trim()) throw new Error("Image OCR returned no usable text.");
    return parsePlainText(text);
  }
  const pages = Array.isArray((parsed as { pages?: unknown[] })?.pages) ? (parsed as { pages: Array<Record<string, unknown>> }).pages : [];
  if (!pages.length) throw new Error("PDF extraction returned no pages.");
  const blocks: ParsedBlock[] = [];
  for (const [index, page] of pages.entries()) {
    const pageNumber = typeof page.pageNumber === "number" ? page.pageNumber : index + 1;
    const headings = Array.isArray(page.headings) ? page.headings.filter((item): item is string => typeof item === "string") : [];
    const text = typeof page.text === "string" ? cleanText(page.text) : "";
    if (text) blocks.push({ text, pageNumber, headingPath: headings, sectionTitle: headings.at(-1) ?? null, kind: "paragraph" });
    const tables = Array.isArray(page.tables) ? page.tables : [];
    for (const table of tables) {
      if (!table || typeof table !== "object") continue;
      const item = table as { title?: unknown; headers?: unknown; rows?: unknown };
      const headers = Array.isArray(item.headers) ? item.headers.map(String) : [];
      const rows = Array.isArray(item.rows) ? item.rows.filter(Array.isArray).map((row) => row.map(String)) : [];
      if (headers.length) blocks.push(...tableBlocks(headers, rows, typeof item.title === "string" ? item.title : "Table", pageNumber));
    }
  }
  return { text: blocks.map((block) => block.text).join("\n\n"), blocks, pageCount: pages.length, metadata: { format: "pdf", extraction: "gemini" } };
}

export async function parseUploadedDocument(bytes: Uint8Array, mimeType: string, fileName: string): Promise<ParsedDocument> {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "txt") return parsePlainText(decodeFile(bytes));
  if (extension === "md" || extension === "markdown") return parseMarkdown(decodeFile(bytes));
  if (extension === "csv") return parseCsv(decodeFile(bytes));
  if (extension === "docx") return extractDocx(bytes);
  if (extension === "pptx") return extractPptx(bytes);
  if (extension === "xlsx") return extractXlsx(bytes);
  if (extension === "pdf" || mimeType === "application/pdf") return extractWithGemini(bytes, "application/pdf", "pdf");
  if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "") || /^image\//.test(mimeType)) return extractWithGemini(bytes, mimeType, "image");
  throw new Error(`Unsupported document type: ${extension ?? mimeType}`);
}

function lastTokens(text: string, count: number): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.slice(Math.max(tokens.length - count, 0)).join(" ");
}

function splitLargeBlock(block: ParsedBlock, targetTokens: number): ParsedBlock[] {
  if (tokenCount(block.text) <= targetTokens) return [block];
  const sentences = block.text.match(/[^.!?\n]+[.!?]+|[^\n]+$/g) ?? [block.text];
  const parts: ParsedBlock[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (tokenCount(`${current} ${sentence}`) > targetTokens && current.trim()) {
      parts.push({ ...block, text: current.trim() });
      current = sentence;
    } else current += `${current ? " " : ""}${sentence.trim()}`;
  }
  if (current.trim()) parts.push({ ...block, text: current.trim() });
  return parts;
}

export async function semanticChunk(
  parsed: ParsedDocument,
  mimeType: string,
  sourceType: string,
  targetTokens = 600,
  overlapTokens = 100,
): Promise<SemanticChunk[]> {
  const chunks: SemanticChunk[] = [];
  let buffer: ParsedBlock[] = [];
  let bufferTokens = 0;
  let offset = 0;
  const flush = async (withOverlap = true) => {
    if (!buffer.length) return;
    const content = cleanText(buffer.map((item) => item.text).join("\n\n"));
    if (!content) return;
    const first = buffer[0];
    const last = buffer.at(-1)!;
    const chunkIndex = chunks.length;
    chunks.push({
      content,
      contentHash: await contentHash(content),
      chunkIndex,
      pageNumber: first.pageNumber ?? null,
      sectionTitle: first.sectionTitle ?? null,
      headingPath: first.headingPath ?? [],
      sourceType,
      mimeType,
      tokenCount: tokenCount(content),
      startOffset: offset,
      endOffset: offset + content.length,
      metadata: { blockKinds: [...new Set(buffer.map((item) => item.kind ?? "paragraph"))], lastPageNumber: last.pageNumber ?? null },
    });
    offset += content.length + 2;
    const overlap = withOverlap ? lastTokens(content, overlapTokens) : "";
    buffer = overlap ? [{ ...last, text: overlap }] : [];
    bufferTokens = tokenCount(overlap);
  };
  for (const originalBlock of parsed.blocks) {
    for (const block of splitLargeBlock(originalBlock, targetTokens)) {
      const blockTokens = tokenCount(block.text);
      const changedSection = buffer.length > 0 && (buffer[0].sectionTitle ?? "") !== (block.sectionTitle ?? "");
      if (buffer.length && (bufferTokens + blockTokens > targetTokens || changedSection)) await flush(!changedSection);
      buffer.push(block);
      bufferTokens += blockTokens;
    }
  }
  await flush();
  const hashes = new Set<string>();
  return chunks.filter((chunk) => {
    if (hashes.has(chunk.contentHash)) return false;
    hashes.add(chunk.contentHash);
    return true;
  });
}

export function inferSourceType(fileName: string, mimeType: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "pptx") return "pptx";
  if (extension === "csv" || extension === "xlsx") return "table";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (/^image\//.test(mimeType)) return "image";
  return "text";
}

export function bytesFromArrayBuffer(value: ArrayBuffer): Uint8Array {
  return new Uint8Array(value);
}

export function estimateByteSize(value: string): number {
  return encoder.encode(value).length;
}

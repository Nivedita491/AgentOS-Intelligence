import type { Doc } from '@/types';
import { assertRequest, ReportExportRequestSchema } from '@/shared/validation';

export type DocumentReportFormat = 'csv' | 'html';

interface ReportRow {
  label: string;
  value: string;
}

function reportRows(document: Doc): ReportRow[] {
  const notes = typeof document.metadata_json?.notes === 'string' ? document.metadata_json.notes : '';
  const recommendations = Array.isArray(document.metadata_json?.recommendations)
    ? document.metadata_json.recommendations.filter((value): value is string => typeof value === 'string').join(' | ')
    : '';
  const evidence = document.supporting_evidence_type === 'link'
    ? document.supporting_url
    : document.supporting_file_name;
  return [
    { label: 'Record ID', value: document.id },
    { label: 'Document name', value: document.filename },
    { label: 'Original file name', value: document.original_name },
    { label: 'Document type', value: document.document_type },
    { label: 'Category', value: document.classification ?? '' },
    { label: 'Source department', value: document.source_department ?? '' },
    { label: 'Status', value: document.status },
    { label: 'MIME type', value: document.mime_type ?? '' },
    { label: 'File size (bytes)', value: String(document.file_size) },
    { label: 'Uploaded at', value: document.uploaded_at },
    { label: 'Updated at', value: document.updated_at ?? '' },
    { label: 'Supporting evidence type', value: document.supporting_evidence_type ?? '' },
    { label: 'Supporting evidence', value: evidence ?? '' },
    { label: 'Supporting evidence added at', value: document.supporting_uploaded_at ?? '' },
    { label: 'Notes', value: notes },
    { label: 'Recommendations', value: recommendations },
    { label: 'Extracted text', value: document.parsed_text ?? '' },
  ];
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildDocumentReportCsv(document: Doc): string {
  return ['Field,Value', ...reportRows(document).map((row) => `${escapeCsv(row.label)},${escapeCsv(row.value)}`)].join('\n');
}

export function buildDocumentReportHtml(document: Doc): string {
  const rows = reportRows(document).filter((row) => row.value);
  const evidenceRow = rows.find((row) => row.label === 'Supporting evidence');
  const renderedRows = rows.map((row) => {
    const value = row.label === 'Supporting evidence' && document.supporting_evidence_type === 'link' && evidenceRow
      ? `<a href="${escapeHtml(row.value)}" rel="noreferrer" target="_blank">${escapeHtml(row.value)}</a>`
      : `<span>${escapeHtml(row.value)}</span>`;
    return `<tr><th>${escapeHtml(row.label)}</th><td>${value}</td></tr>`;
  }).join('');
  const extractedText = document.parsed_text
    ? `<section><h2>Extracted text</h2><pre>${escapeHtml(document.parsed_text)}</pre></section>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.filename)} report</title><style>body{max-width:960px;margin:40px auto;padding:0 24px;color:#172033;font:14px/1.5 system-ui,sans-serif}header{border-bottom:2px solid #2563eb;padding-bottom:18px;margin-bottom:24px}h1{margin:0;font-size:25px}p{color:#526079}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border:1px solid #d9e1ec;text-align:left;vertical-align:top}th{width:32%;background:#f5f8fc;color:#40516b}td{word-break:break-word}section{margin-top:26px}h2{font-size:17px}pre{padding:14px;background:#f5f8fc;border:1px solid #d9e1ec;white-space:pre-wrap;word-break:break-word}a{color:#2563eb}</style></head><body><header><h1>Record Assessment Report</h1><p>AgentOS Intelligence · Generated ${escapeHtml(new Date().toISOString())}</p></header><table><tbody>${renderedRows}</tbody></table>${extractedText}</body></html>`;
}

export function downloadDocumentReport(document: Doc, format: DocumentReportFormat): void {
  const request = assertRequest({ documentId: document.id, format }, ReportExportRequestSchema);
  const content = request.format === 'csv' ? buildDocumentReportCsv(document) : buildDocumentReportHtml(document);
  const mimeType = request.format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8';
  const safeName = document.filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') || 'document';
  const objectUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${safeName}-report.${request.format}`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

/** Opens the same self-contained report in the browser print dialog (including Save as PDF). */
export function printDocumentReport(document: Doc): void {
  assertRequest({ documentId: document.id, format: 'pdf' }, ReportExportRequestSchema);
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('The browser blocked the print window. Allow pop-ups and try again.');
  popup.document.write(buildDocumentReportHtml(document));
  popup.document.close();
  popup.addEventListener('load', () => popup.print(), { once: true });
}

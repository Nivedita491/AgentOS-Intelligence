import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Tag, Building, Calendar, RefreshCw, Trash2, Paperclip, Upload, Download, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { fetchDocument, fetchDocumentChunks, fetchDocumentAttachments, fetchAssets, reindexDocument, deleteDocument, updateDocumentRecord, uploadDocumentAttachments, deleteDocumentAttachment, getDocumentAttachmentUrl, getSupportingEvidenceUrl, removeSupportingEvidence, saveSupportingEvidenceFile, saveSupportingEvidenceLink } from '@/lib/api';
import type { Doc, DocChunk, Asset, DocumentAttachment } from '@/types';
import { Card } from '@/components/ui-primitives';
import { ErrorCard } from '@/components/ErrorCard';
import { generateRequestId, toFriendlyError, type FriendlyError } from '@/shared/validation';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { recordActivity } from '@/lib/activity';
import { downloadDocumentReport, printDocumentReport, type DocumentReportFormat } from '@/lib/documentReport';

function attachmentSize(bytes: number | null): string {
  if (bytes == null) return 'Unknown size';
  if (bytes < 1024 * 1024) return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentDetail() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [chunks, setChunks] = useState<DocChunk[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reindex' | 'delete' | 'edit' | 'attachment' | 'evidence' | 'export' | null>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const [evidenceMode, setEvidenceMode] = useState<'file' | 'link'>('file');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [supportingUrl, setSupportingUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ documentType: '', classification: '', sourceDepartment: '', status: 'Ready' as Doc['status'], notes: '', recommendations: '' });

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, c, a, attachments] = await Promise.all([
        fetchDocument(documentId),
        fetchDocumentChunks(documentId),
        fetchAssets(),
        fetchDocumentAttachments(documentId),
      ]);
      setDoc(d);
      setChunks(c);
      setAssets(a);
      setAttachments(attachments);
      if (d?.supporting_evidence_type === 'file') {
        try {
          setSupportingUrl(await getSupportingEvidenceUrl(d));
        } catch {
          setSupportingUrl(null);
        }
      } else {
        setSupportingUrl(d?.supporting_url ?? null);
      }
    } catch (e) {
      setError(toFriendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-6"><div className="h-24 animate-pulse rounded bg-slate-100 mb-4" /><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorCard error={error} onRetry={load} /></div>;
  }
  if (!doc) {
    return <div className="p-6"><ErrorCard error={toFriendlyError(new Error('Document not found'))} onRetry={load} /></div>;
  }

  const linkedAsset = assets.find((a) => a.id === doc.linked_asset_id);
  const entities = (doc.metadata_json?.entities as string[] | undefined) ?? [];
  const indexing = doc.metadata_json?.indexing as { chunkCount?: number; entityCount?: number; relationshipCount?: number } | undefined;

  const handleReindex = async () => {
    setBusy('reindex');
    setActionError(null);
    try {
      await reindexDocument(doc.id);
      await load();
    } catch (e) {
      setActionError(toFriendlyError(e).title);
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    setEditForm({
      documentType: doc.document_type,
      classification: doc.classification ?? '',
      sourceDepartment: doc.source_department ?? '',
      status: doc.status,
      notes: typeof doc.metadata_json?.notes === 'string' ? doc.metadata_json.notes : '',
      recommendations: Array.isArray(doc.metadata_json?.recommendations) ? doc.metadata_json.recommendations.filter((value): value is string => typeof value === 'string').join('\n') : '',
    });
    setEditing(true);
    setActionError(null);
  };

  const handleSaveEdit = async () => {
    setBusy('edit');
    setActionError(null);
    try {
      await updateDocumentRecord({
        documentId: doc.id,
        documentType: editForm.documentType.trim(),
        classification: editForm.classification.trim() || null,
        sourceDepartment: editForm.sourceDepartment.trim() || null,
        status: editForm.status,
        notes: editForm.notes.trim(),
        recommendations: editForm.recommendations.split('\n').map((value) => value.trim()).filter(Boolean),
      });
      setEditing(false);
      await load();
      toast.success('Record updated');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${doc.original_name} and all of its chunks, vectors, and graph evidence?`)) return;
    setBusy('delete');
    setActionError(null);
    try {
      await deleteDocument(doc.id);
      navigate('/documents');
    } catch (e) {
      setActionError(toFriendlyError(e).title);
    } finally {
      setBusy(null);
    }
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files?.length || !documentId) return;
    setBusy('attachment');
    setActionError(null);
    try {
      const result = await uploadDocumentAttachments(documentId, Array.from(files));
      await load();
      if (result.failed.length) {
        toast.error(`Could not upload: ${result.failed.map((failure) => failure.fileName).join(', ')}`);
      }
      if (result.uploaded.length) toast.success(`${result.uploaded.length} attachment${result.uploaded.length === 1 ? '' : 's'} added`);
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handleAttachmentUrl = async (attachment: DocumentAttachment, download = false) => {
    try {
      const url = await getDocumentAttachmentUrl(attachment.id, download);
      if (download) {
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = attachment.file_name;
        anchor.click();
      } else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    }
  };

  const handleAttachmentDelete = async (attachment: DocumentAttachment) => {
    if (!documentId || !window.confirm(`Remove attachment ${attachment.file_name}?`)) return;
    setBusy('attachment');
    setActionError(null);
    try {
      await deleteDocumentAttachment(documentId, attachment.id);
      await load();
      toast.success('Attachment removed');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handleEvidenceSave = async () => {
    if (!documentId) return;
    if (evidenceMode === 'file' && !evidenceFile) {
      setActionError('Choose a supporting evidence file first.');
      return;
    }
    if (evidenceMode === 'link' && !evidenceUrl.trim()) {
      setActionError('Enter an HTTP(S) supporting evidence link first.');
      return;
    }
    setBusy('evidence');
    setActionError(null);
    try {
      if (evidenceMode === 'file' && evidenceFile) await saveSupportingEvidenceFile(documentId, evidenceFile);
      if (evidenceMode === 'link') await saveSupportingEvidenceLink(documentId, evidenceUrl);
      setEvidenceFile(null);
      setEvidenceUrl('');
      await load();
      toast.success('Supporting evidence saved');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handleEvidenceOpen = async (download = false) => {
    try {
      const url = await getSupportingEvidenceUrl(doc, download);
      if (!url) throw new Error('Supporting evidence is unavailable.');
      if (download) {
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = doc.supporting_file_name ?? 'supporting-evidence';
        anchor.click();
      } else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    }
  };

  const handleEvidenceRemove = async () => {
    if (!documentId || !doc.supporting_evidence_type || !window.confirm('Remove the supporting evidence from this record?')) return;
    setBusy('evidence');
    setActionError(null);
    try {
      await removeSupportingEvidence(documentId);
      await load();
      toast.success('Supporting evidence removed');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handleExport = (format: DocumentReportFormat) => {
    setBusy('export');
    setActionError(null);
    try {
      downloadDocumentReport(doc, format);
      if (doc.organization_id) {
        void recordActivity({
          organizationId: doc.organization_id,
          requestId: generateRequestId(),
          activityType: 'RECORD_REPORT_EXPORTED',
          category: 'documents',
          status: 'success',
          title: 'Record report exported',
          description: doc.original_name,
          documentId: doc.id,
          metadata: { documentName: doc.original_name, format },
        }).catch(() => undefined);
      }
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const handlePrintReport = () => {
    setBusy('export');
    setActionError(null);
    try {
      printDocumentReport(doc);
      if (doc.organization_id) {
        void recordActivity({ organizationId: doc.organization_id, requestId: generateRequestId(), activityType: 'RECORD_REPORT_EXPORTED', category: 'documents', status: 'success', title: 'Record report opened for PDF export', description: doc.original_name, documentId: doc.id, metadata: { documentName: doc.original_name, format: 'pdf' } }).catch(() => undefined);
      }
      toast.success('Print dialog opened — choose Save as PDF to download');
    } catch (e) {
      setActionError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <Link to="/documents" className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Documents
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
            <FileText className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">{doc.filename}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {doc.document_type}</span>
              <span className="inline-flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {doc.source_department ?? '—'}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDateTime(doc.uploaded_at)}</span>
              <span>{doc.file_size.toLocaleString()} bytes</span>
              {doc.page_count && <span>{doc.page_count} pages</span>}
            </div>
          </div>
          <StatusBadge status={doc.status} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button onClick={handleReindex} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <RefreshCw className={busy === 'reindex' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> {busy === 'reindex' ? 'Reindexing…' : 'Reindex'}
          </button>
          <button onClick={startEdit} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit record</button>
          <button onClick={() => handleExport('csv')} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button onClick={() => handleExport('html')} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export HTML
          </button>
          <button onClick={handlePrintReport} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Print / Save PDF
          </button>
          <button onClick={handleDelete} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
          {actionError && <p className="text-[12px] text-red-600">{actionError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Metadata */}
        <div className="space-y-4">
          <Card title="Document Metadata">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-slate-500">Original Name</dt><dd className="text-slate-700 text-right">{doc.original_name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">MIME Type</dt><dd className="text-slate-700 text-right">{doc.mime_type ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Classification</dt><dd className="text-slate-700 text-right">{doc.classification ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">File Size</dt><dd className="text-slate-700 text-right">{(doc.file_size / 1024).toFixed(1)} KB</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Pages</dt><dd className="text-slate-700 text-right">{doc.page_count ?? '—'}</dd></div>
            </dl>
          </Card>

          {editing && <Card title="Edit Record">
            <div className="space-y-2 text-[12px]">
              <label className="block text-slate-500">Document type<input value={editForm.documentType} onChange={(event) => setEditForm((form) => ({ ...form, documentType: event.target.value }))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700" /></label>
              <label className="block text-slate-500">Category<input value={editForm.classification} onChange={(event) => setEditForm((form) => ({ ...form, classification: event.target.value }))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700" /></label>
              <label className="block text-slate-500">Department<input value={editForm.sourceDepartment} onChange={(event) => setEditForm((form) => ({ ...form, sourceDepartment: event.target.value }))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700" /></label>
              <label className="block text-slate-500">Status<select value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value as Doc['status'] }))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700"><option>Uploaded</option><option>Extracting</option><option>Parsing</option><option>Chunking</option><option>Embedding</option><option>Graph Building</option><option>Indexed</option><option>Ready</option><option>Failed</option></select></label>
              <label className="block text-slate-500">Notes<textarea value={editForm.notes} onChange={(event) => setEditForm((form) => ({ ...form, notes: event.target.value }))} rows={3} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700" /></label>
              <label className="block text-slate-500">Recommendations (one per line)<textarea value={editForm.recommendations} onChange={(event) => setEditForm((form) => ({ ...form, recommendations: event.target.value }))} rows={3} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-slate-700" /></label>
              <div className="flex gap-2"><button type="button" onClick={() => void handleSaveEdit()} disabled={busy !== null || !editForm.documentType.trim()} className="rounded bg-blue-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy === 'edit' ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={() => setEditing(false)} disabled={busy !== null} className="rounded border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50">Cancel</button></div>
            </div>
          </Card>}

          <Card title="Linked Asset">
            {linkedAsset ? (
              <Link to={`/assets/${linkedAsset.id}`} className="block rounded-md border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                <p className="text-[13px] font-medium text-slate-700">{linkedAsset.asset_tag}</p>
                <p className="text-[12px] text-slate-500">{linkedAsset.name}</p>
                <p className="text-[11px] text-slate-400 mt-1">{linkedAsset.type} · {linkedAsset.location}</p>
              </Link>
            ) : (
              <p className="text-[12px] text-slate-400">No asset linked</p>
            )}
          </Card>

          <Card title="Supporting Evidence">
            <div className="space-y-3">
              {doc.supporting_evidence_type ? (
                <div className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                  {doc.supporting_evidence_type === 'file' && doc.supporting_mime_type?.startsWith('image/') && supportingUrl && (
                    <img src={supportingUrl} alt={`Supporting evidence: ${doc.supporting_file_name ?? doc.filename}`} className="mb-2 max-h-40 w-full rounded object-contain bg-white" />
                  )}
                  <div className="flex min-w-0 items-start gap-2">
                    {doc.supporting_evidence_type === 'link' ? <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> : <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-slate-700">{doc.supporting_evidence_type === 'link' ? doc.supporting_url : doc.supporting_file_name}</p>
                      <p className="text-[10px] text-slate-400">{doc.supporting_evidence_type === 'link' ? 'External link' : `${doc.supporting_mime_type ?? 'File'} · ${attachmentSize(doc.supporting_file_size ?? null)}`}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
                    <button type="button" onClick={() => void handleEvidenceOpen()} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-blue-600 hover:bg-blue-50"><ExternalLink className="h-3 w-3" /> Open</button>
                    {doc.supporting_evidence_type === 'file' && <button type="button" onClick={() => void handleEvidenceOpen(true)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-100"><Download className="h-3 w-3" /> Download</button>}
                    <button type="button" onClick={() => void handleEvidenceRemove()} disabled={busy !== null} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Remove</button>
                  </div>
                </div>
              ) : <p className="text-[12px] text-slate-400">No supporting evidence attached.</p>}
              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 flex gap-1">
                  <button type="button" onClick={() => setEvidenceMode('file')} className={`rounded px-2 py-1 text-[10px] font-medium ${evidenceMode === 'file' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>Upload file</button>
                  <button type="button" onClick={() => setEvidenceMode('link')} className={`rounded px-2 py-1 text-[10px] font-medium ${evidenceMode === 'link' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>Add link</button>
                </div>
                {evidenceMode === 'file' ? <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => evidenceInput.current?.click()} disabled={busy !== null} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Choose file</button><input ref={evidenceInput} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(event) => setEvidenceFile(event.currentTarget.files?.[0] ?? null)} />{evidenceFile && <span className="max-w-[180px] truncate text-[10px] text-slate-500">{evidenceFile.name}</span>}<button type="button" onClick={() => void handleEvidenceSave()} disabled={busy !== null || !evidenceFile} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">{doc.supporting_evidence_type ? 'Replace' : 'Save'} evidence</button></div>
                  : <div className="flex gap-2"><input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://evidence.example" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-blue-400" /><button type="button" onClick={() => void handleEvidenceSave()} disabled={busy !== null || !evidenceUrl.trim()} className="shrink-0 rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">{doc.supporting_evidence_type ? 'Replace' : 'Save'} link</button></div>}
                <p className="mt-2 text-[10px] text-slate-400">One evidence item per record: PDF, DOCX, or image (max 10 MB), or an HTTP(S) link.</p>
              </div>
            </div>
          </Card>

          <Card title={`Attachments (${attachments.length})`} action={<button type="button" onClick={() => attachmentInput.current?.click()} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Upload className="h-3 w-3" /> Add</button>}>
            <input ref={attachmentInput} type="file" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.csv" className="hidden" onChange={(event) => { void handleAttachmentUpload(event.target.files); event.currentTarget.value = ''; }} />
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                  <div className="flex min-w-0 items-start gap-2"><Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-slate-700">{attachment.file_name}</p><p className="text-[10px] text-slate-400">{attachment.mime_type ?? 'File'} · {attachmentSize(attachment.file_size)} · {formatDateTime(attachment.created_at)}</p></div></div>
                  <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2"><button type="button" onClick={() => void handleAttachmentUrl(attachment)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-blue-600 hover:bg-blue-50"><ExternalLink className="h-3 w-3" /> Open</button><button type="button" onClick={() => void handleAttachmentUrl(attachment, true)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-100"><Download className="h-3 w-3" /> Download</button><button type="button" onClick={() => void handleAttachmentDelete(attachment)} disabled={busy !== null} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Delete</button></div>
                </div>
              ))}
              {attachments.length === 0 && <p className="py-2 text-[12px] text-slate-400">No attachments</p>}
            </div>
          </Card>

          <Card title="Extracted Entities">
            <div className="flex flex-wrap gap-1.5">
              {entities.map((e, i) => (
                <span key={i} className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                  {e}
                </span>
              ))}
              {entities.length === 0 && <p className="text-[12px] text-slate-400">No entities extracted</p>}
            </div>
          </Card>

          <Card title="Source Lineage">
            <div className="space-y-1.5 text-[12px] text-slate-500">
              <p>Current processing: <span className="text-slate-700">{doc.status} {doc.processing_stage ? `(${doc.processing_stage.replace(/_/g, ' ')})` : ''}</span></p>
              {indexing && <p>Index: <span className="text-slate-700">{indexing.chunkCount ?? chunks.length} chunks · {indexing.entityCount ?? 0} entities · {indexing.relationshipCount ?? 0} relationships</span></p>}
              {doc.processing_error?.message && <p className="text-red-600">Last error: {doc.processing_error.message}</p>}
              <p>Uploaded by: <span className="text-slate-700">{(doc.metadata_json?.uploadedBy as string) ?? 'demo'}</span></p>
              <p>Upload date: <span className="text-slate-700">{formatDate(doc.uploaded_at)}</span></p>
              <p>Processing: <span className="text-slate-700">Parsed → Classified → Chunked → Indexed</span></p>
            </div>
          </Card>
        </div>

        {/* Parsed text + chunks */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Extracted Text Preview">
            <div className="max-h-96 overflow-y-auto rounded-md bg-slate-50/50 p-3">
              <pre className="whitespace-pre-wrap text-[12px] text-slate-600 font-mono leading-relaxed">
                {doc.parsed_text ?? 'No text extracted'}
              </pre>
            </div>
          </Card>

          <Card title={`Indexed Chunks (${chunks.length})`}>
            <div className="space-y-2">
              {chunks.map((c) => (
                <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-500">Chunk {c.chunk_index + 1} · {c.section_name ?? 'Section'}</span>
                    {c.page_number && <span className="text-[10px] text-slate-400">Page {c.page_number}</span>}
                  </div>
                  {c.heading_path && c.heading_path.length > 0 && <p className="mb-1 text-[10px] text-slate-400">{c.heading_path.join(' › ')}</p>}
                  <p className="text-[12px] text-slate-600 line-clamp-3">{c.content}</p>
                  {c.token_count !== undefined && <p className="mt-1 text-[10px] text-slate-400">{c.token_count} tokens · {c.source_type ?? 'document'} source</p>}
                </div>
              ))}
              {chunks.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No chunks indexed</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

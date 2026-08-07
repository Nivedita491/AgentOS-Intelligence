import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Tag, Building, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { fetchDocument, fetchDocumentChunks, fetchAssets, reindexDocument, deleteDocument } from '@/lib/api';
import type { Doc, DocChunk, Asset } from '@/types';
import { Card, ErrorState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatDate } from '@/lib/utils';

export function DocumentDetail() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [chunks, setChunks] = useState<DocChunk[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reindex' | 'delete' | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, c, a] = await Promise.all([
        fetchDocument(documentId),
        fetchDocumentChunks(documentId),
        fetchAssets(),
      ]);
      setDoc(d);
      setChunks(c);
      setAssets(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
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
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }
  if (!doc) {
    return <div className="p-6"><ErrorState message="Document not found" /></div>;
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
      setActionError(e instanceof Error ? e.message : 'Reindexing failed');
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
      setActionError(e instanceof Error ? e.message : 'Delete failed');
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

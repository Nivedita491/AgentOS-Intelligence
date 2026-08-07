import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Search, FileText, ChevronRight, X } from 'lucide-react';
import { fetchDocuments, fetchAssets, uploadDocument } from '@/lib/api';
import type { Doc, Asset } from '@/types';
import { PageHeader, EmptyState } from '@/components/ui-primitives';
import { ErrorCard } from '@/components/ErrorCard';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface UploadItem {
  id: string;
  file: File;
  status: string;
  error?: string;
  done?: boolean;
}

function uploadProgress(status: string): string {
  const values: Record<string, string> = {
    Queued: '8%', Uploading: '20%', Uploaded: '30%', Extracting: '45%',
    Chunking: '62%', Embedding: '78%', 'Graph Building': '92%', Ready: '100%', Failed: '100%',
  };
  return values[status] ?? '12%';
}

export function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [linkedAsset, setLinkedAsset] = useState<string>('none');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a] = await Promise.all([fetchDocuments(), fetchAssets()]);
      setDocs(d);
      setAssets(a);
    } catch (e) {
      setError(toFriendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const items: UploadItem[] = fileArr.map((file) => ({ id: crypto.randomUUID(), file, status: 'Queued' }));
      setUploads((prev) => [...items, ...prev]);

      const assetId = linkedAsset === 'none' ? null : linkedAsset;

      for (const item of items) {
        const { file } = item;
        setUploads((prev) => prev.map((upload) => (upload.id === item.id ? { ...upload, status: 'Uploading' } : upload)));
        try {
          await uploadDocument(file, assetId, (status) => {
            setUploads((prev) => prev.map((upload) => (upload.id === item.id ? { ...upload, status } : upload)));
          });
          setUploads((prev) => prev.map((upload) => (upload.id === item.id ? { ...upload, status: 'Ready', done: true } : upload)));
          toast.success(`${file.name} is ready for hybrid retrieval`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed';
          setUploads((prev) => prev.map((upload) => (upload.id === item.id ? { ...upload, status: 'Failed', error: msg } : upload)));
          toast.error(`${file.name}: ${msg}`);
        }
      }
      load();
    },
    [linkedAsset, load],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const types = Array.from(new Set(docs.map((d) => d.document_type))).sort();

  const filtered = docs.filter((d) => {
    const ms = !search || d.filename.toLowerCase().includes(search.toLowerCase()) || d.document_type.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === 'all' || d.document_type === typeFilter;
    const mst = statusFilter === 'all' || d.status === statusFilter;
    return ms && mt && mst;
  });

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorCard error={error} onRetry={load} /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Organizational Knowledge" description={`${docs.length} documents in the shared organizational corpus`} />

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 mb-4 transition-colors',
          dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-white',
        )}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
            <Upload className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[13px] font-medium text-slate-700">Drag and drop organizational documents here</p>
            <p className="text-[11px] text-slate-400">Supports PDF, DOCX, XLSX, CSV, TXT · Max 15 MB per file</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={linkedAsset} onValueChange={setLinkedAsset}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Link to asset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked asset</SelectItem>
                {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_tag} — {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.txt,.csv,.docx,.pptx,.xlsx,.md,.markdown,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-2">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-slate-700 truncate">{u.file.name}</p>
                  <p className={cn('text-[11px]', u.error ? 'text-red-500' : u.done ? 'text-emerald-600' : 'text-slate-400')}>
                    {u.error ? u.error : u.status}
                  </p>
                </div>
                {!u.done && !u.error && (
                  <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                    <div className={cn('h-full rounded-full animate-pulse-soft', u.status === 'Ready' ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: uploadProgress(u.status) }} />
                  </div>
                )}
                <button onClick={() => setUploads((prev) => prev.filter((upload) => upload.id !== u.id))} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Uploaded">Uploaded</SelectItem>
            <SelectItem value="Extracting">Extracting</SelectItem>
            <SelectItem value="Chunking">Chunking</SelectItem>
            <SelectItem value="Embedding">Embedding</SelectItem>
            <SelectItem value="Graph Building">Graph Building</SelectItem>
            <SelectItem value="Ready">Ready</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Document table */}
      {filtered.length === 0 ? (
        <EmptyState title="No documents found" description="Upload documents or adjust filters." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-[11px] font-medium text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Linked Asset</th>
                  <th className="py-2.5 px-3 font-medium">Entities</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Uploaded</th>
                  <th className="py-2.5 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const linkedAsset = assets.find((a) => a.id === d.linked_asset_id);
                  const entityCount = (d.metadata_json?.entities as string[] | undefined)?.length ?? 0;
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">{d.filename}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{d.document_type}</td>
                      <td className="py-2.5 px-3 text-slate-600">{linkedAsset?.asset_tag ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500 tabular-nums">{entityCount}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDateTime(d.uploaded_at)}</td>
                      <td className="py-2.5 px-3">
                        <Link to={`/documents/${d.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[12px]">
                          Open <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

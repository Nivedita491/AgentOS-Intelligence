import { useEffect, useState, useCallback, useRef } from 'react';
import { PencilRuler, FileText, Tag, Gauge, X, ChevronRight } from 'lucide-react';
import { fetchDrawings, fetchAssets, uploadDrawing } from '@/lib/api';
import type { EngineeringDrawing, Asset } from '@/types';
import { PageHeader, Card, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorCard } from '@/components/ErrorCard';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';

interface UploadItem {
  file: File;
  status: string;
  error?: string;
  done?: boolean;
}

export function Drawings() {
  const [drawings, setDrawings] = useState<EngineeringDrawing[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [linkedAsset, setLinkedAsset] = useState<string>('none');
  const [selected, setSelected] = useState<EngineeringDrawing | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a] = await Promise.all([fetchDrawings(), fetchAssets()]);
      setDrawings(d);
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
      const items: UploadItem[] = fileArr.map((f) => ({ file: f, status: 'Queued' }));
      setUploads((prev) => [...items, ...prev]);

      const assetId = linkedAsset === 'none' ? null : linkedAsset;

      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i];
        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'Uploading' } : u)));
        try {
          await uploadDrawing(file, assetId, (status) => {
            setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status } : u)));
          });
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'Processed', done: true } : u)));
          toast.success(`${file.name} processed — entities extracted`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed';
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'Failed', error: msg } : u)));
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

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorCard error={error} onRetry={load} /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Engineering Drawings" description="Vision Agent — P&ID and engineering drawing digitisation with OCR-based entity extraction" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload + list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'rounded-lg border-2 border-dashed p-5 transition-colors',
              dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-white',
            )}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                <PencilRuler className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-[13px] font-medium text-slate-700">Drag and drop engineering drawings here</p>
                <p className="text-[11px] text-slate-400">P&ID, equipment layouts, scanned documents · PDF, PNG, JPG, TXT · Max 15 MB</p>
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
                  Browse
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>
            </div>

            {uploads.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {uploads.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-2">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-slate-700 truncate">{u.file.name}</p>
                      <p className={cn('text-[11px]', u.error ? 'text-red-500' : u.done ? 'text-emerald-600' : 'text-slate-400')}>
                        {u.error ? u.error : u.status}
                      </p>
                    </div>
                    <button onClick={() => setUploads((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drawings list */}
          {drawings.length === 0 ? (
            <EmptyState title="No engineering drawings uploaded" description="Upload P&ID or equipment layout drawings to extract tags and instruments." />
          ) : (
            <div className="space-y-2">
              {drawings.map((d) => {
                const asset = assets.find((a) => a.id === d.linked_asset_id);
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className={cn(
                      'rounded-lg border bg-white p-3.5 cursor-pointer transition-colors',
                      selected?.id === d.id ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 hover:bg-slate-50/50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                        <PencilRuler className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-700">{d.filename}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{d.drawing_type}</span>
                          <StatusBadge status={d.status === 'Processed' ? 'Compliant' : 'At Risk'} />
                          {asset && <Link to={`/assets/${asset.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-blue-600 hover:underline">{asset.asset_tag}</Link>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {d.detected_tags?.length ?? 0} tags</span>
                          <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> {d.detected_instruments?.length ?? 0} instruments</span>
                          <span>{formatDateTime(d.uploaded_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <Card title={selected.filename}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{selected.drawing_type}</span>
                  <StatusBadge status={selected.status === 'Processed' ? 'Compliant' : 'At Risk'} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">OCR Text</p>
                  <div className="max-h-40 overflow-y-auto rounded-md bg-slate-50 p-2">
                    <pre className="whitespace-pre-wrap text-[10px] text-slate-600 font-mono leading-relaxed">{selected.ocr_text ?? 'No OCR text'}</pre>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3" /> Detected Equipment Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.detected_tags?.map((t, i) => (
                      <span key={i} className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-700">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Gauge className="h-3 w-3" /> Detected Instruments</p>
                  <div className="space-y-0.5">
                    {selected.detected_instruments?.map((inst, i) => (
                      <div key={i} className="text-[11px] text-slate-600 font-mono">{inst}</div>
                    ))}
                    {(!selected.detected_instruments || selected.detected_instruments.length === 0) && <p className="text-[11px] text-slate-400">No instruments detected</p>}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1.5">Detected Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.detected_labels?.map((l, i) => (
                      <span key={i} className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{l}</span>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">Vision Agent: {String(selected.metadata_json?.vision_agent ?? 'deterministic-ocr')}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Drawing Details">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <PencilRuler className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-[12px] text-slate-500">Select a drawing to inspect extracted entities</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

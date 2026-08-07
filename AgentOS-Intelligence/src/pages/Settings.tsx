import { useEffect, useState, useCallback } from 'react';
import { Building, Cpu, Database, Shield, Info } from 'lucide-react';
import { fetchSettings } from '@/lib/api';
import { PageHeader, Card, ErrorState } from '@/components/ui-primitives';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchSettings();
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="System configuration and facility information" />

      <div className="space-y-4">
        <Card title="Facility">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Name:</span>
              <span className="font-medium text-slate-700">{String(settings.facility_name ?? 'AstraForge Process Industries')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Type:</span>
              <span className="font-medium text-slate-700">{String(settings.facility_type ?? 'Specialty Process Manufacturing Plant')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Location:</span>
              <span className="font-medium text-slate-700">{String(settings.facility_location ?? 'Vadodara, Gujarat')}</span>
            </div>
          </div>
        </Card>

        <Card title="AI Configuration">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Provider:</span>
              <span className="font-medium text-slate-700">{String(settings.ai_provider ?? 'Google Gemini (server-side)')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Gemini API:</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${settings.gemini_available === true ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {settings.gemini_available === true ? 'Configured' : 'Not configured — using deterministic fallback'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Database">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Type:</span>
              <span className="font-medium text-slate-700">PostgreSQL (Supabase)</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">RLS:</span>
              <span className="font-medium text-slate-700">Enabled (anon + authenticated)</span>
            </div>
          </div>
        </Card>

        <Card title="About">
          <div className="space-y-2 text-[12px] text-slate-500">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
              <p>ForgeMind AI is a hackathon prototype demonstrating industrial knowledge intelligence. All data is seeded for demonstration purposes. AI answers use deterministic fallbacks grounded in seeded evidence when the Gemini API is unavailable.</p>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
              <p>Compliance rules are internal prototype rules, not external regulations. Confidence labels represent AI evidence confidence, not predictive-model accuracy.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

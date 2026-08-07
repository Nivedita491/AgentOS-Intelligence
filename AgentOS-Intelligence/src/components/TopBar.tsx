import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, Activity, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';

const titles: Record<string, string> = {
  '/dashboard': 'Command Center',
  '/assets': 'Assets',
  '/documents': 'Document Intelligence',
  '/drawings': 'Engineering Drawings',
  '/copilot': 'AI Copilot',
  '/maintenance': 'Maintenance Intelligence',
  '/compliance': 'Compliance Intelligence',
  '/qms': 'Quality Management System',
  '/knowledge-graph': 'Knowledge Graph',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const title =
    titles[location.pathname] ??
    (location.pathname.startsWith('/assets/') ? 'Asset 360' : location.pathname.startsWith('/documents/') ? 'Document Details' : 'ForgeMind AI');

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/copilot?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 lg:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="text-[15px] font-semibold text-slate-800 hidden sm:block">{title}</h1>

      <form onSubmit={handleSearch} className="ml-auto flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets, documents, or ask a question…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
      </form>

      <div className="ml-auto md:ml-2 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1">
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px] font-medium text-emerald-700">System Operational</span>
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}

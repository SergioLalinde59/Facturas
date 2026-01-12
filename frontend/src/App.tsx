import { useState, useEffect } from 'react';
import {
  Mail,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Settings2,
  History,
  Database,
  Calendar,
  Filter
} from 'lucide-react';
import './App.css';

interface ProcessingStats {
  total_scanned: number;
  successful: number;
  trashed: number;
  errors: number;
  files_saved: number;
}

interface ImportStats {
  total: number;
  successful: number;
  duplicates: number;
  errors: number;
}

type View = 'extract' | 'import' | 'export';

function App() {
  const [activeView, setActiveView] = useState<View>('extract');
  const [directory, setDirectory] = useState('F:\\1. Cloud\\4. AI\\1. Antigravity\\Gmail - Lectura\\Facturas\\2026');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [message, setMessage] = useState('');
  const [maxEmails, setMaxEmails] = useState(50);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [provider, setProvider] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [exportFormats, setExportFormats] = useState({ excel: true, csv: true, pdf: false });

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const query = new URLSearchParams();
        if (startDate) query.append('start_date', startDate);
        if (endDate) query.append('end_date', endDate);
        const response = await fetch(`http://localhost:8000/api/v1/invoices/providers?${query.toString()}`);
        const data = await response.json();
        setProviders(data.providers || []);
      } catch (err) {
        console.error('Error fetching providers:', err);
      }
    };
    if (activeView === 'export') fetchProviders();
  }, [activeView, startDate, endDate]);

  const handleProcess = async () => {
    if (!directory) return;
    setStatus('loading');
    try {
      const response = await fetch('http://localhost:8000/api/v1/invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_directory: directory, max_emails: maxEmails }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al procesar facturas');
      setStats(data.stats);
      setMessage(data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  const handleImportToDB = async () => {
    if (!directory) return;
    setStatus('loading');
    try {
      const response = await fetch('http://localhost:8000/api/v1/invoices/import-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_directory: directory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al importar a base de datos');
      setImportStats(data.stats);
      setMessage(data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  const handleExportFromDB = async () => {
    if (!directory) return;
    const selectedFormats = Object.entries(exportFormats)
      .filter(([_, enabled]) => enabled)
      .map(([format]) => format);

    if (selectedFormats.length === 0) {
      setMessage('Selecciona al menos un formato para exportar');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch('http://localhost:8000/api/v1/invoices/export-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_directory: directory,
          formats: selectedFormats,
          start_date: startDate || null,
          end_date: endDate || null,
          provider: provider || null
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al exportar');
      setMessage(data.message);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  const handleBrowse = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/utils/browse-directory');
      const data = await response.json();
      if (data.path) setDirectory(data.path);
    } catch (err) {
      console.error('Error opening directory picker:', err);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">Invoice Studio</h1>
          <p className="sidebar-subtitle">Gestión DIAN v2.0</p>
        </div>

        <nav className="flex-1">
          <button
            className={`nav-link ${activeView === 'extract' ? 'active' : ''}`}
            onClick={() => { setActiveView('extract'); setStatus('idle'); setMessage(''); setStats(null); setImportStats(null); }}
          >
            <Mail size={18} />
            <span className="font-semibold text-sm">1. Extraer de Gmail</span>
          </button>

          <button
            className={`nav-link ${activeView === 'import' ? 'active' : ''}`}
            onClick={() => { setActiveView('import'); setStatus('idle'); setMessage(''); setStats(null); setImportStats(null); }}
          >
            <Database size={18} />
            <span className="font-semibold text-sm">2. Cargar a BD</span>
          </button>

          <button
            className={`nav-link ${activeView === 'export' ? 'active' : ''}`}
            onClick={() => { setActiveView('export'); setStatus('idle'); setMessage(''); setStats(null); setImportStats(null); }}
          >
            <Download size={18} />
            <span className="font-semibold text-sm">3. Exportar Reportes</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-700">
          <button className="nav-link">
            <Settings2 size={16} />
            <span className="text-sm">Configuración</span>
          </button>
        </div>
      </aside>

      <main className="main-content custom-scrollbar">
        <div className="max-w-4xl w-full space-y-12 animate-in fade-in duration-1000 pb-20">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-500/10 p-5 rounded-full border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)] mb-6">
              {activeView === 'extract' && <Mail size={32} className="text-blue-500" />}
              {activeView === 'import' && <Database size={32} className="text-emerald-500" />}
              {activeView === 'export' && <Download size={32} className="text-indigo-500" />}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-blue-500 tracking-tight leading-none">
                {activeView === 'extract' ? 'Extracción Gmail' :
                  activeView === 'import' ? 'Carga Base Datos' :
                    'Reportes Export'}
              </h2>
              {/* Línea en blanco entre título y descripción */}
              <div className="h-4" />
              <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed font-medium">
                {activeView === 'extract' ? 'Busca y descarga facturas automáticamente.' :
                  activeView === 'import' ? 'Analiza XMLs locales y centraliza en PostgreSQL.' :
                    'Genera informes con filtros avanzados.'}
              </p>
            </div>
          </div>

          {/* Línea en blanco entre encabezado y tarjeta */}
          <div className="h-4" />

          <div className="bg-slate-800/30 p-10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-slate-700/10 space-y-10">
            <div className="space-y-8">
              {/* Directorio de Trabajo (Shared) */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <FolderOpen size={18} className="text-blue-500" />
                  Directorio de Trabajo
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-200 font-mono shadow-xl"
                    value={directory}
                    onChange={(e) => setDirectory(e.target.value)}
                  />
                  <button
                    onClick={handleBrowse}
                    className="bg-slate-800 hover:bg-slate-700 px-5 rounded-xl transition-all border border-slate-700 shadow-xl active:scale-95 flex items-center justify-center text-slate-200"
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {/* Línea en blanco entre Directorio y Controles específicos */}
              {(activeView === 'extract' || activeView === 'export') && <div className="h-6" />}

              {/* View Specific Controls */}
              {activeView === 'extract' && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <History size={18} className="text-blue-500" />
                    Emails a procesar
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-200 font-mono shadow-xl"
                    value={maxEmails}
                    onChange={(e) => setMaxEmails(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}

              {activeView === 'export' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-500" />
                        Fecha Inicio
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-200 font-mono shadow-xl"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-500" />
                        Fecha Fin
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-200 font-mono shadow-xl"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Línea en blanco entre Fechas y Proveedor */}
                  <div className="h-6" />

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      <Filter size={18} className="text-indigo-500" />
                      Proveedor
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-200 appearance-none shadow-xl cursor-pointer"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                      >
                        <option value="">Todos los proveedores</option>
                        {providers.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown size={18} className="text-slate-600" />
                      </div>
                    </div>
                  </div>

                  <div className="h-6" />

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-indigo-500" />
                      Exportar a:
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all shadow-xl ${exportFormats.excel ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600'}`}
                        onClick={() => setExportFormats(f => ({ ...f, excel: !f.excel }))}
                      >
                        <FileSpreadsheet size={16} />
                        <span className="text-xs font-bold">Excel</span>
                      </button>

                      <button
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all shadow-xl ${exportFormats.csv ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600'}`}
                        onClick={() => setExportFormats(f => ({ ...f, csv: !f.csv }))}
                      >
                        <FileText size={16} />
                        <span className="text-xs font-bold">CSV</span>
                      </button>

                      <button
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all shadow-xl ${exportFormats.pdf ? 'border-rose-500 bg-rose-500/10 text-rose-400' : 'border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600'}`}
                        onClick={() => setExportFormats(f => ({ ...f, pdf: !f.pdf }))}
                      >
                        <FileText size={16} />
                        <span className="text-xs font-bold">PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Línea en blanco antes del botón de acción */}
              <div className="h-6" />

              {/* Main Action Button */}
              <button
                onClick={activeView === 'extract' ? handleProcess :
                  activeView === 'import' ? handleImportToDB :
                    handleExportFromDB}
                disabled={!directory || status === 'loading'}
                className={`w-full flex items-center justify-center gap-3 py-4 mt-6 rounded-2xl font-bold text-lg transition-all shadow-[0_10px_30px_rgba(0,0,0,0.3)] active:scale-[0.98] ${!directory || status === 'loading'
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                  : activeView === 'extract' ? 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-600/40' :
                    activeView === 'import' ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-600/40' :
                      'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-600/40'
                  }`}
              >
                {status === 'loading' ? <Loader2 className="animate-spin" size={20} /> :
                  activeView === 'extract' ? <Play className="fill-current" size={20} /> :
                    activeView === 'import' ? <Database size={20} /> :
                      <Download size={20} />}
                <span>
                  {status === 'loading' ? 'Procesando...' :
                    activeView === 'extract' ? 'Iniciar Extracción' :
                      activeView === 'import' ? 'Cargar a Base de Datos' :
                        'Generar Reportes'}
                </span>
              </button>
            </div>

            {/* Status Messages - Only show if there is a message or if it's not successful */}
            {status !== 'idle' && (message || status !== 'success') && (
              <div className="pt-4 border-t border-slate-700/50 mt-4">
                <div className={`p-4 rounded-xl flex items-center justify-between border shadow-lg ${status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  status === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                  <div className="flex items-center gap-3">
                    {status === 'success' ? <CheckCircle2 size={18} /> :
                      status === 'error' ? <AlertCircle size={18} /> :
                        <Loader2 size={18} className="animate-spin" />}
                    <p className="text-sm font-medium">{message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Statistics (Extraction Only) */}
            {activeView === 'extract' && status === 'success' && stats && (
              <div className="grid grid-cols-4 gap-4 pt-4">
                {[
                  { label: 'Escaneados', val: stats.total_scanned, col: 'text-blue-400' },
                  { label: 'Exitosos', val: stats.successful, col: 'text-emerald-400' },
                  { label: 'Borrados', val: stats.trashed, col: 'text-rose-400' },
                  { label: 'Archivos', val: stats.files_saved, col: 'text-amber-400' }
                ].map(s => (
                  <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 text-center shadow-inner">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{s.label}</div>
                    <div className={`text-lg font-bold font-mono ${s.col}`}>{s.val}</div>
                  </div>
                ))}
              </div>
            )}

            {activeView === 'import' && status === 'success' && importStats && (
              <div className="pt-12">
                {/* Dos líneas en blanco explícitas */}
                <div className="h-6" />
                <div className="h-6" />

                <div className="text-center mb-6">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em]">Estadísticas</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Leídos', val: importStats.total, col: 'text-blue-400' },
                    { label: 'Importados', val: importStats.successful, col: 'text-emerald-400' },
                    { label: 'Duplicados', val: importStats.duplicates, col: 'text-rose-400' },
                    { label: 'Errores', val: importStats.errors, col: 'text-amber-400' }
                  ].map(s => (
                    <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 text-center shadow-inner">
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{s.label}</div>
                      <div className={`text-lg font-bold font-mono ${s.col}`}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main >
    </div >
  );
}

export default App;

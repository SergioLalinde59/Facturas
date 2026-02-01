import { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  FileText,
  History,
  Database,
  LayoutDashboard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play,
  Download,
  FolderOpen,
  Trash2,
  FileCheck,
  Eye,
  Search,
  X
} from 'lucide-react';
import './App.css';

// System Components
import { CurrencyValue } from './components/atoms';
import { DirectoryInput } from './components/molecules';
import { Sidebar, FilterBar } from './components/organisms';
import { DashboardPage } from './pages/DashboardPage';
import { ReportPage } from './pages/ReportPage';


interface ProcessingStats {
  total_scanned: number;
  successful: number;
  trashed: number;
  errors: number;
  files_saved: number;
  subtotal_sum: number;
  iva_sum: number;
  total_sum: number;
}

interface ImportStats {
  total: number;
  successful: number;
  duplicates: number;
  inconsistent: number;
  errors: number;
}



type AppView = 'dashboard' | 'extract' | 'import' | 'export' | 'report';

function App() {
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="badge badge-green">
            <span className="badge-dot"></span> ÉXITO
          </span>
        );
      case 'no_valid_invoices':
      case 'trashed':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-secondary)' }}>
            <span className="badge-dot" style={{ backgroundColor: 'var(--text-secondary)' }}></span> OMITIDO
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-danger">
            <span className="badge-dot"></span> ERROR
          </span>
        );
      default:
        return (
          <span className="badge badge-blue">
            <span className="badge-dot"></span> {status.toUpperCase()}
          </span>
        );
    }
  };

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [directory, setDirectory] = useState('/app/data/Facturas');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [message, setMessage] = useState('');
  const [maxEmails, setMaxEmails] = useState(50);
  const [processResults, setProcessResults] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()} -${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()} -${String(now.getMonth() + 1).padStart(2, '0')} -${String(now.getDate()).padStart(2, '0')} `;
  });
  const [provider, setProvider] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [exportFormats, setExportFormats] = useState({ csv: true, excel: false, pdf: false });

  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'success' | 'inconsistent' | 'error'>('all');
  const [selectedImportRows, setSelectedImportRows] = useState<Set<string>>(new Set());
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);


  // Sorting state for extraction process log
  type SortDirection = 'asc' | 'desc';
  type ProcessSortColumn = 'date' | 'sender' | 'nit' | 'subject' | 'subtotal' | 'descuentos' | 'impuestos' | 'retenciones' | 'iva' | 'iva_19' | 'iva_5' | 'iva_0' | 'inc' | 'total' | 'nombre_xml' | 'count' | 'status';
  const [processSortColumn, setProcessSortColumn] = useState<ProcessSortColumn>('date');
  const [processSortDirection, setProcessSortDirection] = useState<SortDirection>('desc');

  const formatProcessDate = (dateStr: string) => {
    try {
      // Tomar solo la parte de la fecha si viene con hora
      const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] :
        dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr;

      const parts = isoDate.split(/[-/]/);
      if (parts.length === 3) {
        // Asegurar formato YYYY-MM-DD
        const y = parts[0].length === 4 ? parts[0] : parts[2];
        const m = parts[1].padStart(2, '0');
        const d = (parts[0].length === 4 ? parts[2] : parts[0]).padStart(2, '0');
        return `${y} -${m} -${d} `;
      }
      return isoDate;
    } catch (e) {
      return dateStr;
    }
  };

  const sortedProcessResults = useMemo(() => {
    if (!processResults.length) return [];

    return [...processResults].sort((a, b) => {
      let comparison = 0;
      switch (processSortColumn) {
        case 'date':
          comparison = (a.date || '').localeCompare(b.date || '');
          break;
        case 'sender':
          comparison = (a.sender || '').localeCompare(b.sender || '');
          break;
        case 'nit':
          comparison = (a.nit || '').localeCompare(b.nit || '');
          break;
        case 'subject':
          comparison = (a.subject || '').localeCompare(b.subject || '');
          break;
        case 'subtotal':
          comparison = (a.subtotal || 0) - (b.subtotal || 0);
          break;
        case 'descuentos':
          comparison = (a.descuentos || 0) - (b.descuentos || 0);
          break;
        case 'iva':
          comparison = (a.iva || 0) - (b.iva || 0);
          break;
        case 'iva_19':
          comparison = (a.iva_19 || 0) - (b.iva_19 || 0);
          break;
        case 'iva_5':
          comparison = (a.iva_5 || 0) - (b.iva_5 || 0);
          break;
        case 'iva_0':
          comparison = (a.iva_0 || 0) - (b.iva_0 || 0);
          break;
        case 'inc':
          comparison = (a.inc || 0) - (b.inc || 0);
          break;
        case 'total':
          comparison = (a.total || 0) - (b.total || 0);
          break;
        case 'nombre_xml':
          comparison = (a.nombre_xml || '').localeCompare(b.nombre_xml || '');
          break;
        case 'impuestos':
          const taxesA = (a.iva_19 || 0) + (a.iva_5 || 0) + (a.iva_0 || 0) + (a.inc || 0);
          const taxesB = (b.iva_19 || 0) + (b.iva_5 || 0) + (b.iva_0 || 0) + (b.inc || 0);
          comparison = taxesA - taxesB;
          break;
        case 'count':
          comparison = (a.attachments?.length || 0) - (b.attachments?.length || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'retenciones':
          const retenA = (a.retefuente || 0) + (a.reteica || 0) + (a.reteiva || 0);
          const retenB = (b.retefuente || 0) + (b.reteica || 0) + (b.reteiva || 0);
          comparison = retenA - retenB;
          break;
      }
      return processSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processResults, processSortColumn, processSortDirection]);

  const handleProcessSort = (column: ProcessSortColumn) => {
    if (processSortColumn === column) {
      setProcessSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProcessSortColumn(column);
      setProcessSortDirection('asc');
    }
  };


  // Memoized sums for the import view
  const importFinancialSums = useMemo(() => {
    return processResults.reduce((acc, r) => ({
      subtotal: acc.subtotal + (Number(r.subtotal) || 0),
      descuentos: acc.descuentos + (Number(r.descuentos) || 0),
      iva: acc.iva + (Number(r.iva) || Number(r.iva_19) || Number(r.iva_5) || 0),
      total: acc.total + (Number(r.total) || 0),
      retefuente: acc.retefuente + (Number(r.retefuente) || 0) + (Number(r.reteica) || 0) + (Number(r.reteiva) || 0)
    }), { subtotal: 0, descuentos: 0, iva: 0, total: 0, retefuente: 0 });
  }, [processResults]);

  const applyQuickFilter = (type: string) => {
    const today = new Date();
    // Limpiar horas para evitar problemas de cálculo
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start = new Date(now);
    let end = new Date(now);

    switch (type) {
      case 'current-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last-3-months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'last-6-months':
        // Retroceder exactamente 6 meses
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last-year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'last-12-months':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        return;
    }

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y} -${m} -${d} `;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setActiveQuickFilter(type);
  };


  const getProcessSortIcon = (column: ProcessSortColumn) => {
    if (processSortColumn !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
    }
    return processSortDirection === 'asc'
      ? <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} />
      : <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />;
  };

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    principal: true,
    procesos: true,
    reportes: true
  });

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const query = new URLSearchParams();
        // En la vista import, queremos TODOS los proveedores sin filtrar por fecha
        // Los filtros de fecha solo se aplican al importar/previsualizar
        if (activeView !== 'import') {
          if (startDate) query.append('start_date', startDate);
          if (endDate) query.append('end_date', endDate);
        }
        const response = await fetch(`/api/v1/invoices/providers?${query.toString()}`);
        const data = await response.json();
        setProviders(data.providers || []);
      } catch (err) {
        console.error('Error fetching providers:', err);
      }
    };
    if (activeView === 'export' || activeView === 'report' || activeView === 'import') fetchProviders();
  }, [activeView, startDate, endDate]);


  // Automatic updates for Import view when filters change
  useEffect(() => {
    if (activeView === 'import' && directory) {
      // Auto-trigger preview when filters change in import view
      handleImportToDB(true);
    }
  }, [activeView, startDate, endDate, provider, directory]);



  const handleProcess = async () => {
    // We allow proceeding even if directory is empty as the backend has a fallback
    setStatus('loading');
    setIsExtractModalOpen(true);
    setProcessResults([]);
    setStats({
      total_scanned: 0,
      successful: 0,
      trashed: 0,
      errors: 0,
      files_saved: 0,
      subtotal_sum: 0,
      iva_sum: 0,
      total_sum: 0
    });
    setMessage('Iniciando conexión con Gmail...');

    try {
      console.log('Iniciando proceso con maxEmails:', maxEmails);
      const url = new URL('/api/v1/invoices/process-stream', window.location.origin);
      if (directory) {
        url.searchParams.append('target_directory', directory);
      }
      url.searchParams.append('max_emails', (maxEmails || 50).toString());
      if (provider) {
        url.searchParams.append('search_query', `subject: ("${provider}")`);
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Error al conectar con el servidor');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo establecer el canal de datos');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6));

              if (event.type === 'start') {
                setMessage(`Escaneando ${event.total} correos...`);
              } else if (event.type === 'item') {
                setStats(event.stats);
                setProcessResults(prev => [event.data, ...prev]);
                setMessage(`Procesando: ${event.data.subject} `);
              } else if (event.type === 'complete') {
                setStats(event.stats);
                setStatus('success');
                setMessage(`Extracción completada.${event.stats.successful} facturas guardadas.`);
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (e) {
              console.error('Error parseando evento:', e);
            }
          }
        }
      }
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  const handleImportToDB = async (dryRun: boolean = false) => {
    if (!directory) return;
    setStatus('loading');
    setIsPreviewMode(dryRun);
    try {
      const response = await fetch('/api/v1/invoices/import-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_directory: directory,
          dry_run: dryRun,
          start_date: startDate || null,
          end_date: endDate || null,
          provider: provider || null
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al importar a base de datos');
      setImportStats(data.stats);
      setProcessResults(data.results || []);
      setMessage(data.message);
      setStatus('success');
      if (!dryRun) setIsPreviewMode(false); // Reset preview mode after successful live import
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  const handleExportFromDB = async (overrideDirectory?: string | null, overrideFormats?: any) => {
    const targetDir = overrideDirectory !== undefined ? overrideDirectory : directory;
    const activeFormats = overrideFormats || exportFormats;

    const selectedFormats = Object.entries(activeFormats)
      .filter(([_, enabled]) => enabled)
      .map(([format]) => format);

    if (selectedFormats.length === 0) {
      setMessage('Selecciona al menos un formato para exportar');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch('/api/v1/invoices/export-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_directory: targetDir || null,
          formats: selectedFormats,
          start_date: startDate || null,
          end_date: endDate || null,
          provider: provider || null
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || 'Error al exportar');
      setMessage(data.message);
      setStatus('success');
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessage(errorMsg);
      setStatus('error');
    }
  };

  // File Browser State
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserPath, setBrowserPath] = useState('/app/data');
  const [browserItems, setBrowserItems] = useState<any[]>([]);

  const loadBrowserItems = async (path: string) => {
    try {
      const response = await fetch(`/ api / v1 / utils / list - directory ? path = ${encodeURIComponent(path)} `);
      if (!response.ok) throw new Error('Error al listar directorio');
      const data = await response.json();
      setBrowserItems(data.items);
      setBrowserPath(data.current_path);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isBrowserOpen) {
      loadBrowserItems(browserPath);
    }
  }, [isBrowserOpen]);

  const handleNavigate = (path: string) => {
    loadBrowserItems(path);
  };

  const handleSelectDirectory = () => {
    setDirectory(browserPath);
    setIsBrowserOpen(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev: any) => ({ ...prev, [section]: !prev[section] }));
  };

  const resetProcessState = () => {
    setStatus('idle');
    setMessage('');
    setStats(null);
    setProcessResults([]);
    setImportStats(null);
    setIsPreviewMode(false);
  };

  const getViewConfig = () => {
    switch (activeView) {
      case 'dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Resumen general de facturas electrónicas',
          actionLabel: '',
          actionIcon: LayoutDashboard,
          color: 'cyan'
        };
      case 'extract':
        return {
          title: 'Extracción Gmail',
          subtitle: 'Busca y descarga facturas automáticamente desde Gmail',
          actionLabel: 'Iniciar Extracción',
          actionIcon: Play,
          color: 'blue'
        };
      case 'import':
        return {
          title: 'Carga Base Datos',
          subtitle: 'Analiza XMLs locales y centraliza en PostgreSQL',
          actionLabel: 'Previsualizar',
          actionIcon: Database,
          color: 'emerald'
        };
      case 'export':
        return {
          title: 'Exportar Facturas',
          subtitle: 'Genera informes con filtros avanzados',
          actionLabel: 'Generar Reportes',
          actionIcon: Download,
          color: 'indigo'
        };
      case 'report':
        return {
          title: 'Reporte de Facturas',
          subtitle: 'Consulta los registros de facturas en pantalla',
          actionLabel: 'Consultar',
          actionIcon: FileText,
          color: 'violet'
        };
    }
  };

  const viewConfig = getViewConfig();

  return (
    <div className="app-container">
      {/* File Browser Modal */}
      {isBrowserOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px',
            width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#0f172a', fontWeight: 600 }}>Seleccionar Directorio</h3>

            <div style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', marginBottom: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', color: '#475569', border: '1px solid #e2e8f0' }}>
              {browserPath}
            </div>

            <div className="browser-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              {browserPath !== '/' && (
                <div
                  onClick={() => handleNavigate(browserPath.split('/').slice(0, -1).join('/') || '/')}
                  style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FolderOpen size={16} color="#64748b" />
                  <span>..</span>
                </div>
              )}
              {browserItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.type === 'directory' ? handleNavigate(item.path) : null}
                  style={{
                    padding: '0.75rem',
                    cursor: item.type === 'directory' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    backgroundColor: 'transparent',
                    opacity: item.type === 'directory' ? 1 : 0.5,
                    color: '#334155',
                    transition: 'background-color 0.15s'
                  }}
                  className="browser-item"
                  onMouseEnter={(e) => item.type === 'directory' && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {item.type === 'directory' ? <FolderOpen size={16} color="#f59e0b" /> : <FileText size={16} color="#94a3b8" />}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setIsBrowserOpen(false)} className="btn-secondary" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
              <button onClick={handleSelectDirectory} className="btn-primary">Seleccionar Actual</button>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        activeView={activeView}
        onViewChange={(view: any) => {
          setActiveView(view);
          resetProcessState();
        }}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      />


      {/* Main Content */}
      <main className="main-content">
        {/* Page Header */}
        <header className="page-header">
          <div className="page-header-content">
            <h1>{viewConfig.title}</h1>
            <p>{viewConfig.subtitle}</p>
          </div>
        </header>

        {/* Content Area */}
        <div className="content-area">
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <DashboardPage onNavigate={setActiveView} />
          )}

          {activeView !== 'dashboard' && activeView !== 'report' && (
            <div className="filter-section">
              {activeView !== 'extract' && (
                <div style={{ marginBottom: '1rem' }}>
                  <DirectoryInput
                    label="Directorio de Trabajo"
                    value={directory}
                    onChange={setDirectory}
                    onBrowse={() => {
                      setBrowserPath(directory || '/app/data');
                      setIsBrowserOpen(true);
                    }}
                    fullWidth
                  />
                </div>
              )}

              {/* ... rest of your filter logic ... */}

              {activeView === 'extract' && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <div className="form-group" style={{ width: '320px', textAlign: 'center' }}>
                    <label className="form-label" style={{ justifyContent: 'center' }}>
                      <History size={14} className="form-label-icon" />
                      Cantidad de correos a procesar
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
                      value={maxEmails === 0 ? '' : maxEmails}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setMaxEmails(0);
                        } else {
                          const parsed = parseInt(val);
                          if (!isNaN(parsed)) setMaxEmails(parsed);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {(activeView === 'export' || activeView === 'import') && (
                <div style={{ position: 'relative' }}>
                  <FilterBar
                    quickFilters={[
                      { label: 'Mes Actual', active: activeQuickFilter === 'current-month', onClick: () => applyQuickFilter('current-month') },
                      { label: 'Mes Ant.', active: activeQuickFilter === 'last-month', onClick: () => applyQuickFilter('last-month') },
                      { label: 'Últ. 3 Meses', active: activeQuickFilter === 'last-3-months', onClick: () => applyQuickFilter('last-3-months') },
                      { label: 'Últ. 6 Meses', active: activeQuickFilter === 'last-6-months', onClick: () => applyQuickFilter('last-6-months') },
                      { label: 'YTD', active: activeQuickFilter === 'ytd', onClick: () => applyQuickFilter('ytd') },
                      { label: 'Año Ant.', active: activeQuickFilter === 'last-year', onClick: () => applyQuickFilter('last-year') },
                      { label: '12 Meses', active: activeQuickFilter === 'last-12-months', onClick: () => applyQuickFilter('last-12-months') },
                    ]}
                    dateRange={{
                      startDate,
                      endDate,
                      onStartDateChange: setStartDate,
                      onEndDateChange: setEndDate
                    }}
                    provider={{
                      value: provider,
                      options: providers,
                      onChange: setProvider
                    }}
                  >
                    {activeView === 'import' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.875rem',
                        borderLeft: '1px solid var(--border-color)',
                        paddingLeft: '1rem',
                        marginLeft: '0.5rem',
                        height: '38px',
                        minWidth: 'fit-content'
                      }}>
                        {status === 'loading' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Analizando...</span>
                          </div>
                        ) : !importStats || !isPreviewMode ? (
                          <button
                            onClick={() => handleImportToDB(true)}
                            className="btn-primary"
                            style={{
                              padding: '0.4rem 1rem',
                              backgroundColor: 'var(--accent-color)',
                              fontSize: '0.75rem',
                              height: '32px'
                            }}
                          >
                            <Search size={14} />
                            Analizar Directorio
                          </button>
                        ) : (
                          <>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', lineHeight: 1, marginBottom: '2px' }}>Previsualización</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success-color)' }}>{importStats.successful} Facturas</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => resetProcessState()}
                                style={{
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleImportToDB(false)}
                                className="btn-primary"
                                style={{
                                  padding: '0.4rem 1rem',
                                  backgroundColor: 'var(--success-color)',
                                  fontSize: '0.75rem',
                                  height: '32px'
                                }}
                              >
                                <Database size={14} />
                                Confirmar Carga
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                    }
                  </FilterBar>
                  {activeView !== 'import' && (
                    <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
                      {/* Button placeholder if needed for other views, or remove if unused elsewhere */}
                    </div>
                  )}
                </div>
              )}

              {activeView === 'export' && (
                <div className="filter-row" style={{ marginTop: '1rem' }}>
                  <label className="form-label" style={{ marginRight: '1rem' }}>
                    <FileSpreadsheet size={14} className="form-label-icon" />
                    Exportar a:
                  </label>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={exportFormats.csv}
                        onChange={() => setExportFormats(f => ({ ...f, csv: !f.csv }))}
                      />
                      <span>CSV</span>
                    </label>
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={exportFormats.excel}
                        onChange={() => setExportFormats(f => ({ ...f, excel: !f.excel }))}
                      />
                      <span>Excel</span>
                    </label>
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={exportFormats.pdf}
                        onChange={() => setExportFormats(f => ({ ...f, pdf: !f.pdf }))}
                      />
                      <span>PDF</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Button - Hidden for report and import (import now in quick-filters row) */}
              {activeView !== 'report' && activeView !== 'import' && (
                <div className="filter-row" style={{ marginTop: '0.75rem', justifyContent: activeView === 'extract' ? 'center' : 'flex-end' }}>
                  <button
                    onClick={activeView === 'extract' ? handleProcess : () => handleExportFromDB()}
                    disabled={status === 'loading' || !directory}
                    className="btn-primary"
                    style={{
                      padding: '0.65rem 1.75rem',
                      fontSize: '0.875rem',
                      opacity: status === 'loading' || !directory ? 0.5 : 1,
                      cursor: status === 'loading' || !directory ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {status === 'loading' ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <viewConfig.actionIcon size={18} />
                    )}
                    <span>{status === 'loading' ? 'Procesando...' : viewConfig.actionLabel}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Report View */}
          {activeView === 'report' && (
            <ReportPage providers={providers} />
          )}

          {/* Status Message */}
          {status !== 'idle' && message && activeView !== 'extract' && activeView !== 'report' && (
            <div
              className="data-card"
              style={{
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: status === 'loading' ? 'rgba(37, 99, 235, 0.05)' : status === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: '1px solid',
                borderColor: status === 'loading' ? 'rgba(37, 99, 235, 0.1)' : status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              {status === 'loading' && <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />}
              {status === 'success' && <CheckCircle2 size={20} style={{ color: 'var(--success-color)' }} />}
              {status === 'error' && <AlertCircle size={20} style={{ color: 'var(--danger-color)' }} />}
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: status === 'loading' ? 'var(--accent-color)' : status === 'success' ? 'var(--success-color)' : 'var(--danger-color)'
              }}>{message}</span>
            </div>
          )}

          {activeView === 'extract' && stats && (status === 'success' || (status === 'loading' && stats.total_scanned > 0)) && (
            <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Correos Escaneados</span>
                  <span className="summary-card-value neutral">{stats.total_scanned}</span>
                </div>
                <div className="summary-card-icon neutral"><Mail size={20} /></div>
              </div>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Exitosos</span>
                  <span className="summary-card-value positive">{stats.successful}</span>
                </div>
                <div className="summary-card-icon positive"><CheckCircle2 size={20} /></div>
              </div>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">En Papelera</span>
                  <span className="summary-card-value negative">{stats.trashed}</span>
                </div>
                <div className="summary-card-icon negative"><Trash2 size={20} /></div>
              </div>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Archivos Guardados</span>
                  <span className="summary-card-value positive">{stats.files_saved}</span>
                </div>
                <div className="summary-card-icon positive"><FileCheck size={20} /></div>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && importStats && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="data-card" style={{ padding: '0.75rem 1.25rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>

                  {/* Sección 1: Proceso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1.2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Procesamiento</span>
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{importStats.total}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.duplicates > 0 ? '#f59e0b' : 'inherit' }}>{importStats.duplicates}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Dupl.</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success-color)' }}>{importStats.successful}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{isPreviewMode ? 'Listas' : 'Cargadas'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.inconsistent > 0 ? '#f59e0b' : 'inherit' }}>{importStats.inconsistent}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Incon.</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.errors > 0 ? 'var(--danger-color)' : 'inherit' }}>{importStats.errors}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Err.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-color)' }}></div>

                  {/* Sección 2: Resultados Financieros */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Resumen Financiero</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Subtotal</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={importFinancialSums.subtotal} /></div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Desc.</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: importFinancialSums.descuentos > 0 ? 'var(--danger-color)' : 'inherit' }}><CurrencyValue value={importFinancialSums.descuentos} /></div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>IVA/Imp</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={importFinancialSums.iva} /></div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Retenciones</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: importFinancialSums.retefuente > 0 ? 'var(--danger-color)' : 'inherit' }}><CurrencyValue value={-importFinancialSums.retefuente} /></div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success-color)' }}><CurrencyValue value={importFinancialSums.total} /></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && processResults && (
            <div className="data-card">
              <div className="data-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem 1.25rem' }}>
                <span className="data-card-title">Detalle de Importación</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { id: 'all', label: 'Todos', color: 'var(--text-secondary)' },
                    { id: 'success', label: 'Éxito', color: 'var(--success-color)' },
                    { id: 'inconsistent', label: 'Inconsistentes', color: '#f59e0b' },
                    { id: 'error', label: 'Errores', color: 'var(--danger-color)' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTableStatusFilter(f.id as any)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: tableStatusFilter === f.id ? f.color : 'var(--border-color)',
                        backgroundColor: tableStatusFilter === f.id ? `${f.color} 15` : 'transparent',
                        color: tableStatusFilter === f.id ? f.color : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="data-card-content" style={{ padding: 0 }}>
                <div className="process-log custom-scrollbar" style={{ overflowX: 'auto', height: '800px', overflowY: 'auto', position: 'relative' }}>
                  {processResults.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No hay registros de importación en esta sesión.
                    </div>
                  ) : (
                    <table className="data-table" style={{ fontSize: '0.75rem', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', padding: '0.4rem 0.75rem', textAlign: 'center', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }}>
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const nonSuccess = processResults
                                    .filter(r => r.status !== 'success')
                                    .map(r => r.nombre_xml || r.factura || Math.random().toString());
                                  setSelectedImportRows(new Set(nonSuccess));
                                } else {
                                  setSelectedImportRows(new Set());
                                }
                              }}
                              checked={processResults.length > 0 && processResults.filter(r => r.status !== 'success').every(r => selectedImportRows.has(r.nombre_xml || r.factura))}
                              title="Seleccionar todos los que no son Éxito"
                            />
                          </th>
                          <th style={{ width: '130px', padding: '0.4rem 0.75rem', textAlign: 'center', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('status')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                              Estado {getProcessSortIcon('status')}
                            </div>
                          </th>
                          <th style={{ width: '100px', padding: '0.4rem 0.75rem', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('date')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Fecha {getProcessSortIcon('date')}
                            </div>
                          </th>
                          <th style={{ width: '250px', padding: '0.4rem 0.75rem', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('sender')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Emisor {getProcessSortIcon('sender')}
                            </div>
                          </th>
                          <th style={{ width: '120px', padding: '0.4rem 0.75rem', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('subject')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Factura {getProcessSortIcon('subject')}
                            </div>
                          </th>
                          <th style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('subtotal')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              Subtotal {getProcessSortIcon('subtotal')}
                            </div>
                          </th>
                          <th style={{ width: '100px', padding: '0.4rem 0.75rem', textAlign: 'right', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('descuentos')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              Desc. {getProcessSortIcon('descuentos')}
                            </div>
                          </th>
                          <th style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('impuestos')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              Impuestos {getProcessSortIcon('impuestos')}
                            </div>
                          </th>
                          <th style={{ width: '100px', padding: '0.4rem 0.75rem', textAlign: 'right', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('retenciones')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              Reten. {getProcessSortIcon('retenciones')}
                            </div>
                          </th>
                          <th style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }} onClick={() => handleProcessSort('total')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              Total {getProcessSortIcon('total')}
                            </div>
                          </th>
                          <th style={{ width: '150px', padding: '0.4rem 0.75rem', position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'var(--bg-input)' }}>
                            XML
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProcessResults
                          .filter(res => tableStatusFilter === 'all' ||
                            (tableStatusFilter === 'success' && res.status === 'success') ||
                            (tableStatusFilter === 'inconsistent' && res.status === 'inconsistent') ||
                            (tableStatusFilter === 'error' && (res.status === 'error' || res.status === 'failed'))
                          )
                          .map((res: any, idx: number) => {
                            const rowId = res.nombre_xml || res.factura;
                            return (
                              <tr key={idx} style={{
                                backgroundColor: res.status === 'inconsistent' ? 'rgba(245, 158, 11, 0.04)' :
                                  (res.status === 'error' || res.status === 'failed') ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                              }}>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedImportRows.has(rowId)}
                                    onChange={(e) => {
                                      const newSelected = new Set(selectedImportRows);
                                      if (e.target.checked) newSelected.add(rowId);
                                      else newSelected.delete(rowId);
                                      setSelectedImportRows(newSelected);
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <div className={res.message ? "has-tooltip" : ""}>
                                      {res.status === 'success' ? (
                                        <span className="badge badge-green" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                                          <span className="badge-dot"></span> Éxito
                                        </span>
                                      ) : res.status === 'duplicate' ? (
                                        <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                          <span className="badge-dot" style={{ backgroundColor: '#f59e0b' }}></span> Omitido
                                        </span>
                                      ) : res.status === 'inconsistent' ? (
                                        <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                          <span className="badge-dot" style={{ backgroundColor: '#f59e0b' }}></span> Incon.
                                        </span>
                                      ) : (
                                        <span className="badge badge-danger" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                          <span className="badge-dot"></span> Error
                                        </span>
                                      )}
                                      {res.message && (
                                        <span className="tooltip">
                                          <strong>Detalles:</strong><br />
                                          {res.message}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedInvoice(res);
                                        setIsDetailModalOpen(true);
                                      }}
                                      style={{
                                        border: 'none',
                                        background: 'var(--accent-light)',
                                        color: 'var(--accent-color)',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Ver detalle"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                </td>
                                <td className="font-mono" style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem', fontSize: '0.7rem' }}>
                                  {formatProcessDate(res.date)}
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.sender}>
                                    {res.sender}
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    {res.nit}
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {res.subject}
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                  <CurrencyValue value={res.subtotal} />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace', color: res.descuentos > 0 ? 'var(--danger-color)' : 'inherit' }}>
                                  <CurrencyValue value={res.descuentos} />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                  <CurrencyValue value={(res.iva_19 || 0) + (res.iva_5 || 0) + (res.iva_0 || 0) + (res.inc || 0)} />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                  <CurrencyValue value={-(res.retefuente || 0) - (res.reteica || 0) - (res.reteiva || 0)} />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                  <CurrencyValue value={res.total} />
                                </td>
                                <td style={{ padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--accent-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.nombre_xml}>
                                  {res.nombre_xml || (res.attachments && res.attachments[0]) || ''}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )
          }

          {/* Modal Sections */}
          {isDetailModalOpen && selectedInvoice && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}>
              <div className="modal-content detail-modal" style={{
                backgroundColor: '#ffffff', borderRadius: '16px',
                width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
                animation: 'modalSlideIn 0.3s ease-out'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'linear-gradient(to right, #f8fafc, #ffffff)'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detalle de Factura</h3>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedInvoice.nombre_xml}</p>
                  </div>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    style={{
                      background: 'var(--bg-input)', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Information Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>Emisor</h4>
                        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedInvoice.sender}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>NIT: {selectedInvoice.nit}</div>
                        </div>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>Identificación de Factura</h4>
                        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Número</div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInvoice.subject}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fecha</div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatProcessDate(selectedInvoice.date)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totals Section */}
                    <div>
                      <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>Resumen de Totales</h4>
                      <div style={{ padding: '1.25rem', backgroundColor: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                          <span style={{ color: '#94a3b8' }}>Subtotal</span>
                          <span style={{ fontWeight: 600 }}><CurrencyValue value={selectedInvoice.subtotal} /></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                          <span style={{ color: '#94a3b8' }}>Descuentos</span>
                          <span style={{ fontWeight: 600, color: '#f87171' }}><CurrencyValue value={selectedInvoice.descuentos} /></span>
                        </div>

                        <div style={{ margin: '1rem 0', height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>

                        {/* Tax Detail inside Totals */}
                        {(selectedInvoice.iva_19 > 0 || selectedInvoice.iva_5 > 0 || selectedInvoice.inc > 0) && (
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Impuestos Detallados</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8rem' }}>
                              {selectedInvoice.iva_19 > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>IVA 19%</span>
                                  <CurrencyValue value={selectedInvoice.iva_19} />
                                </div>
                              )}
                              {selectedInvoice.iva_5 > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>IVA 5%</span>
                                  <CurrencyValue value={selectedInvoice.iva_5} />
                                </div>
                              )}
                              {selectedInvoice.inc > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>INC</span>
                                  <CurrencyValue value={selectedInvoice.inc} />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '2px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 600 }}>TOTAL</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}><CurrencyValue value={selectedInvoice.total} /></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Section */}
                  <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: selectedInvoice.status === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: '1px solid', borderColor: selectedInvoice.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '20px', backgroundColor: selectedInvoice.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedInvoice.status === 'success' ? '#10b981' : '#ef4444' }}>
                        {selectedInvoice.status === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Estado del Procesamiento: {selectedInvoice.status.toUpperCase()}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedInvoice.message || 'La factura ha sido procesada correctamente.'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="btn-primary"
                    style={{ padding: '0.625rem 2rem' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Extract Progress Modal */}
        {isExtractModalOpen && (
          <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
            zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="modal-content" style={{
              backgroundColor: '#ffffff', borderRadius: '16px',
              width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', width: 40, height: 40, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {status === 'loading' ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
                      {status === 'loading' ? 'Procesando Facturas' : 'Extracción Finalizada'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      {message}
                    </p>
                  </div>
                </div>
                {status !== 'loading' && (
                  <button
                    onClick={() => setIsExtractModalOpen(false)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={24} />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {/* Progress Bar Area */}
                {stats && stats.total_scanned > 0 && (
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: '12px',
                    background: 'rgba(37, 99, 235, 0.03)',
                    border: '1px solid rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'monospace', lineHeight: 1 }}>
                      {(stats.successful + stats.trashed + stats.errors)} <span style={{ color: 'var(--text-muted)', fontSize: '1.25rem', fontWeight: 400 }}>/</span> {stats.total_scanned}
                    </div>
                    <div style={{ width: '100%', maxWidth: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', marginTop: '0.5rem', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, ((stats.successful + stats.trashed + stats.errors) / stats.total_scanned) * 100)}% `,
                        backgroundColor: 'var(--accent-color)',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}></div>
                    </div>
                  </div>
                )}

                {/* Summary Small cards */}
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Exitosos</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-color)' }}>{stats.successful}</div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Omitidos</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#94a3b8' }}>{stats.trashed}</div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Errores</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger-color)' }}>{stats.errors}</div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Archivos</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-color)' }}>{stats.files_saved}</div>
                    </div>
                  </div>
                )}

                {/* Table Log */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.75rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th>Fecha</th>
                          <th>Remitente</th>
                          <th>Asunto</th>
                          <th style={{ textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processResults.map((res: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatProcessDate(res.date)}</td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{res.sender?.split('<')[0]}</td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{res.subject}</td>
                            <td style={{ textAlign: 'center' }}>{renderStatusBadge(res.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsExtractModalOpen(false)}
                  className="btn-primary"
                  disabled={status === 'loading'}
                  style={{ padding: '0.5rem 2rem' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

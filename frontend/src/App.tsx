import { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Settings2,
  History,
  Database,
  Calendar,
  Filter,
  LayoutDashboard,
  TrendingUp,
  Zap,
  Copy,
  DollarSign,
  Users,
  Receipt,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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

interface Invoice {
  fecha: string;
  nit: string;
  proveedor: string;
  factura: string;
  subtotal: number;
  iva: number;
  total: number;
  nombre_xml: string;
}

interface DashboardStats {
  total_facturas: number;
  total_subtotal: number;
  total_iva: number;
  total_monto: number;
  total_proveedores: number;
  total_nits: number;
  fecha_min: string | null;
  fecha_max: string | null;
}

type View = 'dashboard' | 'extract' | 'import' | 'export' | 'report';

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [directory, setDirectory] = useState('/app/data/Facturas/2026');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [maxEmails, setMaxEmails] = useState(50);
  const [processResults, setProcessResults] = useState<any[]>([]);
  const [reportData, setReportData] = useState<Invoice[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [provider, setProvider] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [exportFormats, setExportFormats] = useState({ csv: true, excel: false, pdf: false });

  // Sorting state for report table
  type SortColumn = 'fecha' | 'proveedor' | 'nit' | 'factura' | 'subtotal' | 'iva' | 'total';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sorted report data
  const sortedReportData = useMemo(() => {
    if (!reportData.length) return [];

    return [...reportData].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'fecha':
          comparison = a.fecha.localeCompare(b.fecha);
          break;
        case 'proveedor':
          comparison = a.proveedor.localeCompare(b.proveedor);
          break;
        case 'nit':
          comparison = a.nit.localeCompare(b.nit);
          break;
        case 'factura':
          comparison = a.factura.localeCompare(b.factura);
          break;
        case 'subtotal':
          comparison = a.subtotal - b.subtotal;
          break;
        case 'iva':
          comparison = a.iva - b.iva;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [reportData, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sorting state for extraction process log
  type ProcessSortColumn = 'date' | 'sender' | 'subject' | 'count' | 'status';
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
        return `${y}-${m}-${d}`;
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
        case 'subject':
          comparison = (a.subject || '').localeCompare(b.subject || '');
          break;
        case 'count':
          comparison = (a.attachments?.length || 0) - (b.attachments?.length || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
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

  // Quick Filter State
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('');

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
      return `${y}-${m}-${d}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setActiveQuickFilter(type);
  };

  // Get sort icon for column header
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} />
      : <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />;
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
    reportes: false
  });

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const query = new URLSearchParams();
        if (startDate) query.append('start_date', startDate);
        if (endDate) query.append('end_date', endDate);
        const response = await fetch(`/api/v1/invoices/providers?${query.toString()}`);
        const data = await response.json();
        setProviders(data.providers || []);
      } catch (err) {
        console.error('Error fetching providers:', err);
      }
    };
    if (activeView === 'export' || activeView === 'report') fetchProviders();
  }, [activeView, startDate, endDate]);

  // Cargar estadísticas del dashboard
  useEffect(() => {
    const fetchDashboardStats = async () => {
      setDashboardLoading(true);
      try {
        const response = await fetch('/api/v1/invoices/stats');
        const data = await response.json();
        setDashboardStats(data.stats);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setDashboardLoading(false);
      }
    };
    if (activeView === 'dashboard') fetchDashboardStats();
  }, [activeView]);

  const handleGetReport = async () => {
    setStatus('loading');
    setReportData([]);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('start_date', startDate);
      if (endDate) query.append('end_date', endDate);
      if (provider) query.append('provider', provider);

      const response = await fetch(`/api/v1/invoices?${query.toString()}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || 'Error al consultar facturas');

      setReportData(data.invoices || []);
      setMessage(`Se encontraron ${data.count} facturas.`);
      setStatus('success');
    } catch (err: any) {
      setMessage(err.message);
      setStatus('error');
    }
  };

  // Automatic report update when filters change
  useEffect(() => {
    if (activeView === 'report') {
      handleGetReport();
    }
  }, [activeView, startDate, endDate, provider]);

  const handleProcess = async () => {
    if (!directory) return;
    setStatus('loading');
    try {
      const response = await fetch('/api/v1/invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_directory: directory, max_emails: maxEmails }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error al procesar facturas');
      setStats(data.stats);
      setProcessResults(data.results || []);
      setMessage(data.message);
      setStatus('success');
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
        body: JSON.stringify({ target_directory: directory, dry_run: dryRun }),
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
      const response = await fetch('/api/v1/invoices/export-db', {
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

  // File Browser State
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserPath, setBrowserPath] = useState('/app/data');
  const [browserItems, setBrowserItems] = useState<any[]>([]);

  const loadBrowserItems = async (path: string) => {
    try {
      const response = await fetch(`/api/v1/utils/list-directory?path=${encodeURIComponent(path)}`);
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const resetProcessState = () => {
    setStatus('idle');
    setMessage('');
    setStats(null);
    setProcessResults([]);
    setImportStats(null);
    setIsPreviewMode(false);
  };

  const NavItem = ({ icon: Icon, label, view, isActive }: { icon: any; label: string; view?: View; isActive?: boolean }) => (
    <button
      className={`nav-link ${isActive ? 'active' : ''}`}
      onClick={() => {
        if (view) {
          setActiveView(view);
          resetProcessState();
        }
      }}
    >
      <Icon size={18} className="nav-link-icon" />
      <span>{label}</span>
    </button>
  );

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

      {/* Sidebar */}
      <aside className="sidebar custom-scrollbar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Zap size={16} color="white" />
            </div>
            <div>
              <h1 className="sidebar-title">Invoice Studio</h1>
              <p className="sidebar-subtitle">Gestión DIAN v2.0</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* PRINCIPAL */}
          <div className="nav-section">
            <div className="nav-section-title">Principal</div>
            <NavItem icon={LayoutDashboard} label="Dashboard" view="dashboard" isActive={activeView === 'dashboard'} />
          </div>

          {/* PROCESOS */}
          <div className="nav-section">
            <div
              className="nav-section-header"
              onClick={() => toggleSection('procesos')}
            >
              <span className="nav-section-title" style={{ padding: 0 }}>Procesos</span>
              {expandedSections.procesos ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
            </div>
            {expandedSections.procesos && (
              <>
                <NavItem icon={Mail} label="Extraer de Gmail" view="extract" isActive={activeView === 'extract'} />
                <NavItem icon={Database} label="Cargar a BD" view="import" isActive={activeView === 'import'} />
                <NavItem icon={Download} label="Exportar Facturas" view="export" isActive={activeView === 'export'} />
              </>
            )}
          </div>

          {/* REPORTES */}
          <div className="nav-section">
            <div
              className="nav-section-header"
              onClick={() => toggleSection('reportes')}
            >
              <span className="nav-section-title" style={{ padding: 0 }}>Reportes</span>
              {expandedSections.reportes ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
            </div>
            {expandedSections.reportes && (
              <>
                <NavItem icon={FileText} label="Reporte de Facturas" view="report" isActive={activeView === 'report'} />
              </>
            )}
          </div>


        </nav>

        {/* Settings at bottom */}
        <div style={{ padding: '1rem 0', borderTop: '1px solid var(--border-color)' }}>
          <NavItem icon={Settings2} label="Configuración" />
        </div>
      </aside>

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
            <>
              {dashboardLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
                  <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
                  <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Cargando estadísticas...</span>
                </div>
              ) : dashboardStats ? (
                <>
                  {/* Summary Cards Row 1 */}
                  <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Rango de Fechas</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {dashboardStats.fecha_min ? `${dashboardStats.fecha_min} - ${dashboardStats.fecha_max}` : 'Sin datos'}
                        </span>
                      </div>
                      <div className="summary-card-icon neutral">
                        <Calendar size={20} />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Total Facturas</span>
                        <span className="summary-card-value neutral">{dashboardStats.total_facturas.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="summary-card-icon neutral">
                        <Receipt size={20} />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Proveedores</span>
                        <span className="summary-card-value neutral">{dashboardStats.total_proveedores}</span>
                      </div>
                      <div className="summary-card-icon neutral">
                        <Building2 size={20} />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">NITs Únicos</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {dashboardStats.total_nits}
                        </span>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                        <Users size={20} />
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards Row 2 */}
                  <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Subtotal Acumulado</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${dashboardStats.total_subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="summary-card-icon neutral">
                        <FileSpreadsheet size={20} />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Total IVA</span>
                        <span className="summary-card-value warning">
                          ${dashboardStats.total_iva.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="summary-card-icon warning">
                        <DollarSign size={20} />
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-card-content">
                        <span className="summary-card-label">Monto Total</span>
                        <span className="summary-card-value positive">
                          ${dashboardStats.total_monto.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="summary-card-icon positive">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="data-card">
                    <div className="data-card-header">
                      <span className="data-card-title">Acciones Rápidas</span>
                    </div>
                    <div className="data-card-content" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn-primary"
                        onClick={() => setActiveView('extract')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <Mail size={18} />
                        Extraer de Gmail
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => setActiveView('import')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)' }}
                      >
                        <Database size={18} />
                        Cargar a BD
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => setActiveView('report')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#8b5cf6' }}
                      >
                        <FileText size={18} />
                        Ver Reporte
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="data-card" style={{ padding: '2rem', textAlign: 'center' }}>
                  <AlertCircle size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>No hay datos disponibles. Comienza extrayendo facturas de Gmail.</p>
                  <button
                    className="btn-primary"
                    onClick={() => setActiveView('extract')}
                    style={{ marginTop: '1rem' }}
                  >
                    <Mail size={18} />
                    Ir a Extracción
                  </button>
                </div>
              )}
            </>
          )}

          {/* Filter Section - Only for non-dashboard views */}
          {activeView !== 'dashboard' && (
            <div className="filter-section">
              {activeView !== 'report' && (
                <div className="filter-row">
                  <div className="form-group flex-1">
                    <label className="form-label">
                      <FolderOpen size={14} className="form-label-icon" />
                      Directorio de Trabajo
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                        value={directory}
                        onChange={(e) => setDirectory(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          setBrowserPath(directory || '/app/data');
                          setIsBrowserOpen(true);
                        }}
                        className="btn-primary"
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ... rest of your filter logic ... */}

              {/* View-specific controls */}
              {activeView === 'extract' && (
                <div className="filter-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group" style={{ width: '200px' }}>
                    <label className="form-label">
                      <History size={14} className="form-label-icon" />
                      Emails a procesar
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={maxEmails}
                      onChange={(e) => setMaxEmails(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              )}

              {(activeView === 'export' || activeView === 'report') && (
                <>
                  <div className="filter-row">
                    <div className="quick-filters" style={{ marginBottom: '0.5rem' }}>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'current-month' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('current-month')}
                      >Mes Actual</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'last-month' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('last-month')}
                      >Mes Ant.</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'last-3-months' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('last-3-months')}
                      >Últ. 3 Meses</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'last-6-months' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('last-6-months')}
                      >Últ. 6 Meses</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'ytd' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('ytd')}
                      >YTD</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'last-year' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('last-year')}
                      >Año Ant.</button>
                      <button
                        className={`quick-filter-btn ${activeQuickFilter === 'last-12-months' ? 'active' : ''}`}
                        onClick={() => applyQuickFilter('last-12-months')}
                      >12 Meses</button>
                    </div>
                  </div>
                  <div className="filter-row" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ width: '180px' }}>
                      <label className="form-label">
                        <Calendar size={14} className="form-label-icon" />
                        Desde
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ width: '180px' }}>
                      <label className="form-label">
                        <Calendar size={14} className="form-label-icon" />
                        Hasta
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label className="form-label">
                        <Filter size={14} className="form-label-icon" />
                        Proveedor
                      </label>
                      <select
                        className="form-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                      >
                        <option value="">Todos los proveedores</option>
                        {providers.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
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

              {/* Action Button - Hidden for report because it's automatic */}
              {activeView !== 'report' && (
                <div className="filter-row" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={activeView === 'extract' ? handleProcess :
                      activeView === 'import' ? () => handleImportToDB(true) :
                        handleExportFromDB}
                    disabled={status === 'loading' || !directory}
                    className="btn-primary"
                    style={{
                      padding: '0.75rem 2rem',
                      fontSize: '0.9rem',
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

          {/* Status Message */}
          {status !== 'idle' && message && (status !== 'success' || (activeView !== 'import' && activeView !== 'extract' && activeView !== 'report')) && (
            <div
              className="data-card"
              style={{
                marginBottom: '1.5rem',
                padding: '1rem 1.5rem',
                borderColor: status === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                  status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)',
                backgroundColor: status === 'success' ? 'rgba(16, 185, 129, 0.05)' :
                  status === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {status === 'success' ? (
                  <CheckCircle2 size={18} color="var(--success-color)" />
                ) : status === 'error' ? (
                  <AlertCircle size={18} color="var(--danger-color)" />
                ) : (
                  <Loader2 size={18} className="animate-spin" color="var(--accent-color)" />
                )}
                <p style={{
                  fontSize: '0.875rem',
                  color: status === 'success' ? 'var(--success-color)' :
                    status === 'error' ? 'var(--danger-color)' : 'var(--text-secondary)'
                }}>
                  {message}
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards - Show when we have stats */}
          {activeView === 'extract' && status === 'success' && stats && (
            <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {/* 1. Emails Escaneados */}
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Emails Escaneados</span>
                  <span className="summary-card-value neutral">{stats.total_scanned}</span>
                </div>
                <div className="summary-card-icon neutral">
                  <Mail size={20} />
                </div>
              </div>
              {/* 2. Facturas Extraídas (Éxito) */}
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Facturas Extraídas</span>
                  <span className="summary-card-value positive">{stats.successful}</span>
                </div>
                <div className="summary-card-icon positive">
                  <Zap size={20} />
                </div>
              </div>
              {/* 3. Enviados a la Papelera */}
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Enviados a Papelera</span>
                  <span className="summary-card-value warning">{stats.trashed}</span>
                </div>
                <div className="summary-card-icon warning">
                  <History size={20} />
                </div>
              </div>
              {/* 4. Archivos Guardados */}
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Archivos Guardados</span>
                  <span className="summary-card-value neutral">{stats.files_saved}</span>
                </div>
                <div className="summary-card-icon neutral">
                  <Database size={20} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && importStats && (
            <>
              {isPreviewMode && (
                <div className="data-card" style={{
                  marginBottom: '1.5rem',
                  padding: '1.5rem',
                  border: '1px solid var(--accent-color)',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                      <Database size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Modo Previsualización</h3>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Revisa los datos. Tienes <strong>{importStats.successful}</strong> facturas listas para cargar.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => resetProcessState()}
                      className="btn-secondary"
                      style={{ padding: '0.6rem 1.25rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleImportToDB(false)}
                      className="btn-primary"
                      style={{ padding: '0.6rem 1.5rem', backgroundColor: 'var(--success-color)' }}
                    >
                      <CheckCircle2 size={18} />
                      Confirmar Carga a Base de Datos
                    </button>
                  </div>
                </div>
              )}

              <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                {/* 1. TOTAL LEÍDOS - Azul */}
                <div className="summary-card">
                  <div className="summary-card-content">
                    <span className="summary-card-label">Total Leídos</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{importStats.total}</span>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <FileText size={20} />
                  </div>
                </div>
                {/* 2. DUPLICADOS - Naranja */}
                <div className="summary-card">
                  <div className="summary-card-content">
                    <span className="summary-card-label">Duplicados</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{importStats.duplicates}</span>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <Copy size={20} />
                  </div>
                </div>
                {/* 3. IMPORTADOS - Verde */}
                <div className="summary-card">
                  <div className="summary-card-content">
                    <span className="summary-card-label">{isPreviewMode ? 'Para Importar' : 'Importados'}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{importStats.successful}</span>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                {/* 4. ERRORES - Rojo */}
                <div className="summary-card">
                  <div className="summary-card-content">
                    <span className="summary-card-label">Errores</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{importStats.errors}</span>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <AlertCircle size={20} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Additional Stats Row */}
          {activeView === 'extract' && status === 'success' && processResults && (
            <div className="data-card">
              <div className="data-card-header">
                <span className="data-card-title">Registro de Extracción Detallado</span>
              </div>
              <div className="data-card-content" style={{ padding: 0 }}>
                <div className="process-log" style={{ overflowX: 'auto' }}>
                  {processResults.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No hay registros de procesamiento en esta sesión.
                    </div>
                  ) : (
                    <table className="data-table" style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '130px', padding: '0.5rem 1rem', cursor: 'pointer' }} onClick={() => handleProcessSort('date')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              Fecha {getProcessSortIcon('date')}
                            </div>
                          </th>
                          <th style={{ width: '150px', padding: '0.5rem 1rem', cursor: 'pointer' }} onClick={() => handleProcessSort('sender')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              Emisor {getProcessSortIcon('sender')}
                            </div>
                          </th>
                          <th style={{ padding: '0.5rem 1rem', cursor: 'pointer' }} onClick={() => handleProcessSort('subject')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              Asunto {getProcessSortIcon('subject')}
                            </div>
                          </th>
                          <th style={{ padding: '0.5rem 1rem', cursor: 'pointer' }} onClick={() => handleProcessSort('count')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              Archivos {getProcessSortIcon('count')}
                            </div>
                          </th>
                          <th style={{ width: '90px', padding: '0.5rem 1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleProcessSort('status')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              Estado {getProcessSortIcon('status')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProcessResults.map((res: any, idx: number) => (
                          <tr key={idx}>
                            <td className="font-mono" style={{ whiteSpace: 'nowrap', padding: '0.4rem 1rem' }}>
                              {formatProcessDate(res.date)}
                            </td>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)', padding: '0.4rem 1rem' }}>
                              {res.sender?.split('<')[0].trim() || res.sender}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.4rem 1rem' }} title={res.subject}>
                              {res.subject || '(Sin asunto)'}
                            </td>
                            <td style={{ padding: '0.4rem 1rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                                {res.attachments && res.attachments.map((file: string, fidx: number) => (
                                  <span key={fidx} style={{
                                    padding: '0.1rem 0.35rem',
                                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                    border: '1px solid rgba(59, 130, 246, 0.1)',
                                    borderRadius: '3px',
                                    fontSize: '0.65rem',
                                    color: 'var(--accent-color)',
                                    fontFamily: 'monospace'
                                  }}>
                                    {file}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '0.4rem 1rem', textAlign: 'center' }}>
                              <div className={res.error ? "has-tooltip" : ""}>
                                {res.status === 'success' ? (
                                  <span className="badge badge-green" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Éxito</span>
                                ) : res.status === 'duplicate' ? (
                                  <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Duplicado</span>
                                ) : res.status === 'no_valid_invoices' ? (
                                  <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Vacío</span>
                                ) : (
                                  <span className="badge badge-danger" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Error</span>
                                )}
                                {res.error && (
                                  <span className="tooltip">
                                    <strong>Detalle del Error:</strong><br />
                                    {res.error}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && processResults && (
            <div className="data-card">
              <div className="data-card-header">
                <span className="data-card-title">Detalle Importación</span>
              </div>
              <div className="data-card-content" style={{ padding: 0 }}>
                <div className="process-log" style={{ overflowX: 'auto' }}>
                  {processResults.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No hay registros de importación en esta sesión.
                    </div>
                  ) : (
                    <table className="data-table" style={{ fontSize: '0.75rem', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '100px', padding: '0.4rem 0.75rem', cursor: 'pointer' }} onClick={() => handleProcessSort('date')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Fecha {getProcessSortIcon('date')}
                            </div>
                          </th>
                          <th style={{ width: '220px', padding: '0.4rem 0.75rem', cursor: 'pointer' }} onClick={() => handleProcessSort('sender')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Emisor {getProcessSortIcon('sender')}
                            </div>
                          </th>
                          <th style={{ width: '120px', padding: '0.4rem 0.75rem', cursor: 'pointer' }} onClick={() => handleProcessSort('subject')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Factura {getProcessSortIcon('subject')}
                            </div>
                          </th>
                          <th style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }} onClick={() => handleProcessSort('count')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Archivo {getProcessSortIcon('count')}
                            </div>
                          </th>
                          <th style={{ width: '100px', padding: '0.4rem 0.75rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleProcessSort('status')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                              Estado {getProcessSortIcon('status')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProcessResults.map((res: any, idx: number) => (
                          <tr key={idx}>
                            <td className="font-mono" style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem', fontSize: '0.7rem' }}>
                              {formatProcessDate(res.date)}
                            </td>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)', padding: '0.3rem 0.75rem', fontSize: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {res.sender}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {res.subject}
                            </td>
                            <td style={{ padding: '0.3rem 0.75rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem' }}>
                                {res.attachments && res.attachments.map((file: string, fidx: number) => (
                                  <span key={fidx} style={{
                                    padding: '0.05rem 0.3rem',
                                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                    border: '1px solid rgba(59, 130, 246, 0.1)',
                                    borderRadius: '3px',
                                    fontSize: '0.65rem',
                                    color: 'var(--accent-color)',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '200px'
                                  }} title={file}>
                                    {file}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                              <div className={res.message ? "has-tooltip" : ""}>
                                {res.status === 'success' ? (
                                  <span className="badge badge-green" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>
                                    <span className="badge-dot"></span> Éxito
                                  </span>
                                ) : res.status === 'duplicate' ? (
                                  <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                    <span className="badge-dot"></span> Omitido
                                  </span>
                                ) : (
                                  <span className="badge badge-danger" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                    <span className="badge-dot"></span> Fallido
                                  </span>
                                )}
                                {res.message && (
                                  <span className="tooltip">
                                    <strong>Detalles:</strong><br />
                                    {res.message}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Report Stats Ribbon - Compact statistics display */}
          {activeView === 'report' && status === 'success' && (
            <div className="stats-ribbon">
              <div className="stats-ribbon-item">
                <div className="stats-ribbon-icon blue">
                  <Receipt size={16} />
                </div>
                <div className="stats-ribbon-content">
                  <span className="stats-ribbon-label">Facturas</span>
                  <span className="stats-ribbon-value neutral">{reportData.length}</span>
                </div>
              </div>
              <div className="stats-ribbon-item">
                <div className="stats-ribbon-icon purple">
                  <Building2 size={16} />
                </div>
                <div className="stats-ribbon-content">
                  <span className="stats-ribbon-label">Proveedores</span>
                  <span className="stats-ribbon-value neutral">
                    {new Set(reportData.map(inv => inv.nit)).size}
                  </span>
                </div>
              </div>
              <div className="stats-ribbon-item">
                <div className="stats-ribbon-icon cyan">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="stats-ribbon-content">
                  <span className="stats-ribbon-label">Subtotal</span>
                  <span className="stats-ribbon-value info">
                    ${reportData.reduce((sum, inv) => sum + inv.subtotal, 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="stats-ribbon-item">
                <div className="stats-ribbon-icon amber">
                  <DollarSign size={16} />
                </div>
                <div className="stats-ribbon-content">
                  <span className="stats-ribbon-label">IVA Total</span>
                  <span className="stats-ribbon-value warning">
                    ${reportData.reduce((sum, inv) => sum + inv.iva, 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="stats-ribbon-item">
                <div className="stats-ribbon-icon green">
                  <TrendingUp size={16} />
                </div>
                <div className="stats-ribbon-content">
                  <span className="stats-ribbon-label">Monto Total</span>
                  <span className="stats-ribbon-value positive">
                    ${reportData.reduce((sum, inv) => sum + inv.total, 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Report Table */}
          {activeView === 'report' && status === 'success' && (
            <div className="data-card">
              <div className="data-card-header">
                <span className="data-card-title">Resultados ({reportData.length})</span>
                <span className="data-card-subtitle">
                  Total: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(reportData.reduce((sum, inv) => sum + inv.total, 0))}
                </span>
              </div>
              <div className="data-card-content" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="sortable-header" onClick={() => handleSort('fecha')}>
                        <span>Fecha</span>
                        {getSortIcon('fecha')}
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('proveedor')}>
                        <span>Proveedor</span>
                        {getSortIcon('proveedor')}
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('nit')}>
                        <span>NIT</span>
                        {getSortIcon('nit')}
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('factura')}>
                        <span>Factura</span>
                        {getSortIcon('factura')}
                      </th>
                      <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('subtotal')}>
                        <span>Subtotal</span>
                        {getSortIcon('subtotal')}
                      </th>
                      <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('iva')}>
                        <span>IVA</span>
                        {getSortIcon('iva')}
                      </th>
                      <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('total')}>
                        <span>Total</span>
                        {getSortIcon('total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReportData.map((inv, idx) => (
                      <tr key={`${inv.nit}-${inv.factura}-${idx}`}>
                        <td>{inv.fecha}</td>
                        <td style={{ fontWeight: 500 }}>{inv.proveedor}</td>
                        <td className="font-mono" style={{ fontSize: '0.85rem' }}>{inv.nit}</td>
                        <td className="font-mono" style={{ fontSize: '0.85rem' }}>{inv.factura}</td>
                        <td className="font-mono" style={{ textAlign: 'right' }}>
                          {new Intl.NumberFormat('es-CO', { style: 'decimal', minimumFractionDigits: 0 }).format(inv.subtotal)}
                        </td>
                        <td className="font-mono" style={{ textAlign: 'right' }}>
                          {new Intl.NumberFormat('es-CO', { style: 'decimal', minimumFractionDigits: 0 }).format(inv.iva)}
                        </td>
                        <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {new Intl.NumberFormat('es-CO', { style: 'decimal', minimumFractionDigits: 0 }).format(inv.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

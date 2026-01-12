import { useState, useEffect } from 'react';
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
  Copy
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

type View = 'extract' | 'import' | 'export' | 'report';

function App() {
  const [activeView, setActiveView] = useState<View>('extract');
  const [directory, setDirectory] = useState('/app/data/Facturas/2026');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [message, setMessage] = useState('');
  const [maxEmails, setMaxEmails] = useState(50);
  const [reportData, setReportData] = useState<Invoice[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [provider, setProvider] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [exportFormats, setExportFormats] = useState({ csv: true, excel: false, pdf: false });

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
      const response = await fetch('/api/v1/invoices/import-db', {
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

  const NavItem = ({ icon: Icon, label, view, isActive }: { icon: any; label: string; view?: View; isActive?: boolean }) => (
    <button
      className={`nav-link ${isActive ? 'active' : ''}`}
      onClick={() => {
        if (view) {
          setActiveView(view);
          setStatus('idle');
          setMessage('');
          setStats(null);
          setImportStats(null);
        }
      }}
    >
      <Icon size={18} className="nav-link-icon" />
      <span>{label}</span>
    </button>
  );

  const getViewConfig = () => {
    switch (activeView) {
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
          actionLabel: 'Cargar a Base de Datos',
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
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px',
            width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ marginBottom: '1rem', color: 'white' }}>Seleccionar Directorio</h3>

            <div style={{ padding: '0.5rem', backgroundColor: '#0f172a', marginBottom: '1rem', borderRadius: '4px', fontFamily: 'monospace' }}>
              {browserPath}
            </div>

            <div className="browser-list custom-scrollbar" style={{ flex: 1, overflowY: 'auto', border: '1px solid #334155', borderRadius: '4px' }}>
              {browserPath !== '/' && (
                <div
                  onClick={() => handleNavigate(browserPath.split('/').slice(0, -1).join('/') || '/')}
                  style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #334155' }}
                >
                  <FolderOpen size={16} color="#94a3b8" />
                  <span>..</span>
                </div>
              )}
              {browserItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.type === 'directory' ? handleNavigate(item.path) : null}
                  style={{
                    padding: '0.5rem',
                    cursor: item.type === 'directory' ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    backgroundColor: 'transparent',
                    opacity: item.type === 'directory' ? 1 : 0.5
                  }}
                  className="browser-item"
                >
                  {item.type === 'directory' ? <FolderOpen size={16} color="#fbbf24" /> : <FileText size={16} color="#94a3b8" />}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setIsBrowserOpen(false)} className="btn-secondary" style={{ background: 'transparent', border: '1px solid #475569', color: 'white', padding: '0.5rem 1rem' }}>Cancelar</button>
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
            <NavItem icon={LayoutDashboard} label="Dashboard" />
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
          {/* Filter Section */}
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
              <div className="filter-row" style={{ marginTop: '1rem' }}>
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

            {/* Action Button */}
            <div className="filter-row" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={activeView === 'extract' ? handleProcess :
                  activeView === 'import' ? handleImportToDB :
                    activeView === 'report' ? handleGetReport :
                      handleExportFromDB}
                disabled={status === 'loading' || (activeView !== 'report' && !directory)}
                className="btn-primary"
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '0.9rem',
                  opacity: status === 'loading' || (activeView !== 'report' && !directory) ? 0.5 : 1,
                  cursor: status === 'loading' || (activeView !== 'report' && !directory) ? 'not-allowed' : 'pointer'
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
          </div>

          {/* Status Message */}
          {status !== 'idle' && message && (
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
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Escaneados</span>
                  <span className="summary-card-value neutral">{stats.total_scanned}</span>
                </div>
                <div className="summary-card-icon neutral">
                  <Mail size={20} />
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Exitosos</span>
                  <span className="summary-card-value positive">{stats.successful}</span>
                </div>
                <div className="summary-card-icon positive">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Archivos Guardados</span>
                  <span className="summary-card-value neutral">{stats.files_saved}</span>
                </div>
                <div className="summary-card-icon neutral">
                  <FileText size={20} />
                </div>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && importStats && (
            <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              {/* 1. TOTAL LEÍDOS - Azul */}
              <div className="summary-card">
                <div className="summary-card-content">
                  <span className="summary-card-label">Total Leídos</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>{importStats.total}</span>
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
                  <span className="summary-card-label">Importados</span>
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
          )}

          {/* Additional Stats Row */}
          {activeView === 'extract' && status === 'success' && stats && (
            <div className="data-card">
              <div className="data-card-header">
                <span className="data-card-title">Detalles del Proceso</span>
              </div>
              <div className="data-card-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Métrica</th>
                      <th>Valor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Emails Escaneados</td>
                      <td className="font-mono">{stats.total_scanned}</td>
                      <td><span className="badge badge-blue"><span className="badge-dot"></span>Completado</span></td>
                    </tr>
                    <tr>
                      <td>Facturas Extraídas</td>
                      <td className="text-positive font-mono">{stats.successful}</td>
                      <td><span className="badge badge-green"><span className="badge-dot"></span>Éxito</span></td>
                    </tr>
                    <tr>
                      <td>Enviados a Papelera</td>
                      <td className="text-negative font-mono">{stats.trashed}</td>
                      <td><span className="badge badge-blue"><span className="badge-dot"></span>Procesado</span></td>
                    </tr>
                    <tr>
                      <td>Archivos Guardados</td>
                      <td className="font-mono">{stats.files_saved}</td>
                      <td><span className="badge badge-green"><span className="badge-dot"></span>Guardado</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'import' && status === 'success' && importStats && (
            <div className="data-card">
              <div className="data-card-header">
                <span className="data-card-title">Detalles de Importación</span>
              </div>
              <div className="data-card-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Métrica</th>
                      <th>Valor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Archivos Leídos</td>
                      <td className="font-mono">{importStats.total}</td>
                      <td><span className="badge badge-blue"><span className="badge-dot"></span>Completado</span></td>
                    </tr>
                    <tr>
                      <td>Duplicados Ignorados</td>
                      <td className="font-mono" style={{ color: '#f59e0b', fontWeight: 600 }}>{importStats.duplicates}</td>
                      <td><span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><span className="badge-dot"></span>Omitido</span></td>
                    </tr>
                    <tr>
                      <td>Importados Exitosamente</td>
                      <td className="text-positive font-mono">{importStats.successful}</td>
                      <td><span className="badge badge-green"><span className="badge-dot"></span>Éxito</span></td>
                    </tr>
                    <tr>
                      <td>Errores</td>
                      <td className="text-negative font-mono">{importStats.errors}</td>
                      <td><span className="badge badge-blue"><span className="badge-dot"></span>Reportado</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report Table */}
          {activeView === 'report' && status === 'success' && reportData.length > 0 && (
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
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>NIT</th>
                      <th>Factura</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                      <th style={{ textAlign: 'right' }}>IVA</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((inv, idx) => (
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

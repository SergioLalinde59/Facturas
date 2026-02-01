import { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Play,
    Database,
    Download,
    FileText,
    FolderOpen
} from 'lucide-react';
import './App.css';

// System Components
import { Sidebar } from './components/organisms';
import { DashboardPage } from './pages/DashboardPage';
import { ExtractionPage } from './pages/ExtractionPage';
import { ImportPage } from './pages/ImportPage';
import { ExportPage } from './pages/ExportPage';
import { ReportPage } from './pages/ReportPage';
import type { AppView } from './types';

function App() {
    const [activeView, setActiveView] = useState<AppView>('dashboard');
    const [directory, setDirectory] = useState('/app/data/Facturas');
    const [providers, setProviders] = useState<string[]>([]);

    // File Browser State
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [browserPath, setBrowserPath] = useState('/app/data');
    const [browserItems, setBrowserItems] = useState<any[]>([]);

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        principal: true,
        procesos: true,
        reportes: true
    });

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

    // Fetch providers when relevant views are active
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                // We fetch all providers for the filter lists
                const response = await fetch(`/api/v1/invoices/providers`);
                const data = await response.json();
                setProviders(data.providers || []);
            } catch (err) {
                console.error('Error fetching providers:', err);
            }
        };
        if (activeView === 'export' || activeView === 'report' || activeView === 'import') {
            fetchProviders();
        }
    }, [activeView]);

    const toggleSection = (section: string) => {
        setExpandedSections((prev: any) => ({ ...prev, [section]: !prev[section] }));
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

    // Common props for pages that need directory selection
    const directoryProps = {
        directory,
        onDirectoryChange: setDirectory,
        onBrowse: () => {
            setBrowserPath(directory || '/app/data');
            setIsBrowserOpen(true);
        }
    };

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
                    {activeView === 'dashboard' && (
                        <DashboardPage onNavigate={setActiveView} />
                    )}

                    {activeView === 'extract' && (
                        <ExtractionPage
                            provider=""
                            onProviderChange={() => { }}
                        />
                    )}

                    {activeView === 'import' && (
                        <ImportPage
                            providers={providers}
                        />
                    )}

                    {activeView === 'export' && (
                        <ExportPage
                            {...directoryProps}
                            providers={providers}
                        />
                    )}

                    {activeView === 'report' && (
                        <ReportPage
                            providers={providers}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;

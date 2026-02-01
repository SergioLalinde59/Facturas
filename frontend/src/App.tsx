import { useState, useEffect } from 'react';
import {
  Database,
  LayoutDashboard,
  FileText,
  Settings2,
  Play,
  Download
} from 'lucide-react';
import './App.css';

// System Components
import { Sidebar } from './components/organisms';
import { DashboardPage } from './pages/DashboardPage';
import { ReportPage } from './pages/ReportPage';
import { ImportPage } from './pages/ImportPage';
import { ExtractionPage } from './pages/ExtractionPage';
import { ExportPage } from './pages/ExportPage';
import { TaxMasterPage } from './pages/TaxMasterPage';
import { GroupingsPage } from './pages/GroupingsPage';
import { TaxRatesPage } from './pages/TaxRatesPage';
import type { AppView } from './types';

const DEFAULT_DIRECTORY = '/app/data/Data/Pendientes';

function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const directory = DEFAULT_DIRECTORY;
  const [providers, setProviders] = useState<string[]>([]);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    principal: true,
    procesos: true,
    reportes: true
  });

  useEffect(() => {
    const fetchProviders = async () => {
      if (activeView !== 'export' && activeView !== 'report' && activeView !== 'import') return;
      try {
        const response = await fetch(`/api/v1/invoices/providers`);
        const data = await response.json();
        setProviders(data.providers || []);
      } catch (err) {
        console.error('Error fetching providers:', err);
      }
    };
    fetchProviders();
  }, [activeView]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev: any) => ({ ...prev, [section]: !prev[section] }));
  };

  const resetProcessState = () => {
    // No-op for now as state is handled in pages
  };

  const getViewConfig = () => {
    switch (activeView) {
      case 'dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Resumen general de facturas electrónicas',
          actionIcon: LayoutDashboard,
        };
      case 'extract':
        return {
          title: 'Extracción Gmail',
          subtitle: 'Busca y descarga facturas automáticamente desde Gmail',
          actionIcon: Play,
        };
      case 'import':
        return {
          title: 'Carga Base Datos',
          subtitle: 'Analiza XMLs locales y centraliza en PostgreSQL',
          actionIcon: Database,
        };
      case 'export':
        return {
          title: 'Exportar Facturas',
          subtitle: 'Genera informes con filtros avanzados',
          actionIcon: Download,
        };
      case 'report':
        return {
          title: 'Reporte de Facturas',
          subtitle: 'Consulta los registros de facturas en pantalla',
          actionIcon: FileText,
        };
      case 'tax-master':
        return {
          title: 'Maestro de Impuestos',
          subtitle: 'Gestión de códigos y reglas de impuestos',
          actionIcon: Settings2,
        };
      case 'groupings':
        return {
          title: 'Maestro de Agrupaciones',
          subtitle: 'Gestión de categorías generales de impuestos',
          actionIcon: Settings2,
        };
      case 'tax-rates':
        return {
          title: 'Maestro de Tarifas',
          subtitle: 'Gestión de porcentajes de impuestos',
          actionIcon: Settings2,
        };
      default:
        return {
          title: '',
          subtitle: '',
          actionIcon: LayoutDashboard,
        };
    }
  };

  const viewConfig = getViewConfig();

  return (
    <div className="app-container">
      <Sidebar
        activeView={activeView}
        onViewChange={(view: AppView) => {
          setActiveView(view);
          resetProcessState();
        }}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      />

      <main className="main-content">
        <header className="page-header">
          <div className="page-header-content">
            <h1>{viewConfig.title}</h1>
            <p>{viewConfig.subtitle}</p>
          </div>
        </header>

        <div className="content-area">
          {activeView === 'dashboard' && <DashboardPage onNavigate={setActiveView} />}
          {activeView === 'tax-master' && <TaxMasterPage />}
          {activeView === 'groupings' && <GroupingsPage />}
          {activeView === 'tax-rates' && <TaxRatesPage />}
          {activeView === 'report' && <ReportPage providers={providers} />}
          {activeView === 'import' && <ImportPage providers={providers} directory={directory} />}
          {activeView === 'extract' && <ExtractionPage />}
          {activeView === 'export' && (
            <ExportPage
              directory={directory}
              onDirectoryChange={() => { }}
              onBrowse={() => { }}
              providers={providers}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

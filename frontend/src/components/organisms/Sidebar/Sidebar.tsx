
import {
    LayoutDashboard, Mail, Database, FileText,
    Settings2, ChevronDown, ChevronRight, Zap, Tags
} from 'lucide-react';
import './Sidebar.css';

export interface SidebarProps {
    activeView: string;
    onViewChange: (view: any) => void;
    expandedSections: Record<string, boolean>;
    onToggleSection: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeView,
    onViewChange,
    expandedSections,
    onToggleSection
}) => {
    const NavItem = ({ icon: Icon, label, view, active }: any) => (
        <button
            className={`sidebar__nav-item ${active ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => onViewChange(view)}
        >
            <Icon size={18} className="sidebar__nav-icon" />
            <span className="sidebar__nav-label">{label}</span>
        </button>
    );

    return (
        <aside className="sidebar custom-scrollbar">
            <div className="sidebar__header">
                <div className="sidebar__logo">
                    <div className="sidebar__logo-icon">
                        <Zap size={16} color="white" />
                    </div>
                    <div className="sidebar__logo-text">
                        <h1 className="sidebar__title">Invoice Studio</h1>
                        <p className="sidebar__subtitle">Gestión DIAN v2.0</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar__nav">
                <div className="sidebar__section">
                    <div className="sidebar__section-title">Principal</div>
                    <NavItem
                        icon={LayoutDashboard}
                        label="Dashboard"
                        view="dashboard"
                        active={activeView === 'dashboard'}
                    />
                </div>

                <div className="sidebar__section">
                    <div
                        className="sidebar__section-header"
                        onClick={() => onToggleSection('procesos')}
                    >
                        <span className="sidebar__section-title">Procesos</span>
                        {expandedSections.procesos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    {expandedSections.procesos && (
                        <div className="sidebar__section-content">
                            <NavItem icon={Mail} label="Extraer de Gmail" view="extract" active={activeView === 'extract'} />
                            <NavItem icon={Database} label="Cargar a BD" view="import" active={activeView === 'import'} />
                        </div>
                    )}
                </div>

                <div className="sidebar__section">
                    <div
                        className="sidebar__section-header"
                        onClick={() => onToggleSection('reportes')}
                    >
                        <span className="sidebar__section-title">Reportes</span>
                        {expandedSections.reportes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    {expandedSections.reportes && (
                        <div className="sidebar__section-content">
                            <NavItem icon={FileText} label="Reporte Facturas" view="report" active={activeView === 'report'} />
                        </div>
                    )}
                </div>

                <div className="sidebar__section">
                    <div
                        className="sidebar__section-header"
                        onClick={() => onToggleSection('maestros')}
                    >
                        <span className="sidebar__section-title">Maestros</span>
                        {expandedSections.maestros ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    {expandedSections.maestros && (
                        <div className="sidebar__section-content">
                            <NavItem icon={Tags} label="1. Agrupaciones" view="groupings" active={activeView === 'groupings'} />
                            <NavItem icon={Tags} label="2. Impuestos" view="tax-master" active={activeView === 'tax-master'} />
                            <NavItem icon={Tags} label="3. Tarifas" view="tax-rates" active={activeView === 'tax-rates'} />
                        </div>
                    )}
                </div>
            </nav>

            <div className="sidebar__footer">
                <NavItem icon={Settings2} label="Configuración" view="settings" active={activeView === 'settings'} />
            </div>
        </aside>
    );
};

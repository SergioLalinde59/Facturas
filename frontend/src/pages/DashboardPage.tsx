import { useState, useEffect } from 'react';
import {
    Calendar,
    Receipt,
    Building2,
    Users,
    FileSpreadsheet,
    Percent,
    TrendingUp,
    AlertCircle,
    Mail,
    Database,
    FileText,
    Loader2,
    DollarSign
} from 'lucide-react';
import { StatCardGrid } from '../components/organisms';
import { CurrencyValue } from '../components/atoms';
import type { DashboardStats, AppView } from '../types';

interface DashboardPageProps {
    onNavigate: (view: AppView) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/v1/invoices/stats');
                const data = await response.json();
                setDashboardStats(data.stats);
            } catch (err) {
                console.error('Error fetching dashboard stats:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardStats();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
                <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Cargando estadísticas...</span>
            </div>
        );
    }

    if (!dashboardStats) {
        return (
            <div className="data-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <AlertCircle size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>No hay datos disponibles. Comienza extrayendo facturas de Gmail.</p>
                <button
                    className="btn-primary"
                    onClick={() => onNavigate('extract')}
                    style={{ marginTop: '1rem' }}
                >
                    <Mail size={18} />
                    Ir a Extracción
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="dashboard-stats-ribbons" style={{
                marginBottom: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                alignItems: 'center',
                width: '100%'
            }}>
                <style>{`
                    .dashboard-stats-ribbons .stat-card {
                        min-height: 85px;
                        padding: 0.75rem 1rem;
                        flex: 1;
                        min-width: 200px;
                        max-width: 280px;
                    }
                    .dashboard-stats-ribbons .stat-card__value {
                        font-size: 1.125rem;
                    }
                    .dashboard-stats-ribbons .stat-card__icon-wrapper {
                        width: 36px;
                        height: 36px;
                    }
                    .dashboard-stats-ribbons .stat-card-grid {
                        width: 100%;
                        justify-content: center;
                    }
                    .dashboard-stats-ribbons .stat-card__label {
                        font-size: 0.7rem;
                        color: var(--color-text-secondary);
                        /* text-transform restriction removed in StatCard.css */
                    }
                `}</style>

                {/* Meta Stats Row (4 cards) */}
                <StatCardGrid
                    stats={[
                        {
                            id: 'range',
                            label: 'fecha',
                            value: dashboardStats.fecha_min ? `${dashboardStats.fecha_min} - ${dashboardStats.fecha_max}` : 'Sin datos',
                            icon: <Calendar size={20} />,
                            variant: 'info'
                        },
                        {
                            id: 'count',
                            label: 'no facturas',
                            value: dashboardStats.total_facturas.toLocaleString('es-CO'),
                            icon: <Receipt size={20} />,
                            variant: 'primary'
                        },
                        {
                            id: 'providers',
                            label: 'no proveedores',
                            value: dashboardStats.total_proveedores,
                            icon: <Building2 size={20} />,
                            variant: 'info'
                        },
                        {
                            id: 'nits',
                            label: 'nits únicos',
                            value: dashboardStats.total_nits,
                            icon: <Users size={20} />,
                            variant: 'info'
                        },
                    ]}
                    columns={4}
                />

                {/* Financial Stats Row (5 cards) */}
                <StatCardGrid
                    stats={[
                        {
                            id: 'subtotal',
                            label: 'subtotal',
                            value: <CurrencyValue value={dashboardStats.total_subtotal} />,
                            icon: <FileSpreadsheet size={20} />,
                            variant: 'primary'
                        },
                        {
                            id: 'descuentos',
                            label: 'descuentos',
                            value: <CurrencyValue value={-dashboardStats.total_descuentos} />,
                            icon: <Percent size={20} />,
                            variant: 'error'
                        },
                        {
                            id: 'impuestos',
                            label: 'impuestos',
                            value: <CurrencyValue value={dashboardStats.total_impuestos} />,
                            icon: <Percent size={20} />,
                            variant: 'warning'
                        },
                        {
                            id: 'retenciones',
                            label: 'retenciones',
                            value: <CurrencyValue value={-dashboardStats.total_retenciones} />,
                            icon: <DollarSign size={20} />,
                            variant: 'error'
                        },
                        {
                            id: 'total',
                            label: 'monto total',
                            value: <CurrencyValue value={dashboardStats.total_monto} />,
                            icon: <TrendingUp size={20} />,
                            variant: 'success'
                        }
                    ]}
                    columns={5}
                />
            </div>

            {/* Quick Actions */}
            <div className="data-card">
                <div className="data-card-header">
                    <span className="data-card-title">Acciones Rápidas</span>
                </div>
                <div className="data-card-content" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn-primary"
                        onClick={() => onNavigate('extract')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Mail size={18} />
                        Extraer de Gmail
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => onNavigate('import')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success-color)' }}
                    >
                        <Database size={18} />
                        Cargar a BD
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => onNavigate('report')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#8b5cf6' }}
                    >
                        <FileText size={18} />
                        Ver Reporte
                    </button>
                </div>
            </div>
        </>
    );
}

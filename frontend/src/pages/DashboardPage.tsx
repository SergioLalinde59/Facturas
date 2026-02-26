import { useState, useEffect, useCallback } from 'react';
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
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    AreaChart, Area,
    ResponsiveContainer, Legend
} from 'recharts';
import { CurrencyValue } from '../components/atoms';
import type { DashboardStats, AppView, MonthlyStats, TopProvider } from '../types';

type DateRangeKey = 'mes-actual' | 'mes-ant' | 'ult-3' | 'ult-6' | 'ytd' | 'ano-ant' | '12-meses';

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
    { key: 'mes-actual', label: 'Mes Actual' },
    { key: 'mes-ant', label: 'Mes Ant.' },
    { key: 'ult-3', label: 'Últ. 3 Meses' },
    { key: 'ult-6', label: 'Últ. 6 Meses' },
    { key: 'ytd', label: 'YTD' },
    { key: 'ano-ant', label: 'Año Ant.' },
    { key: '12-meses', label: '12 Meses' },
];

function getDateRange(key: DateRangeKey): { start_date: string; end_date: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    switch (key) {
        case 'mes-actual':
            return {
                start_date: fmt(new Date(year, month, 1)),
                end_date: fmt(today),
            };
        case 'mes-ant': {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0); // last day of prev month
            return { start_date: fmt(start), end_date: fmt(end) };
        }
        case 'ult-3': {
            const start = new Date(year, month - 2, 1);
            return { start_date: fmt(start), end_date: fmt(today) };
        }
        case 'ult-6': {
            const start = new Date(year, month - 5, 1);
            return { start_date: fmt(start), end_date: fmt(today) };
        }
        case 'ytd':
            return {
                start_date: fmt(new Date(year, 0, 1)),
                end_date: fmt(today),
            };
        case 'ano-ant':
            return {
                start_date: fmt(new Date(year - 1, 0, 1)),
                end_date: fmt(new Date(year - 1, 11, 31)),
            };
        case '12-meses': {
            const start = new Date(year, month - 11, 1);
            return { start_date: fmt(start), end_date: fmt(today) };
        }
    }
}

interface DashboardPageProps {
    onNavigate: (view: AppView) => void;
}

const CHART_COLORS = {
    primary: '#4F46E5',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${MONTH_NAMES[parseInt(mo) - 1]} ${y.slice(2)}`;
};

const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const ChartEmptyState = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
        Sin datos para el periodo seleccionado
    </div>
);

export function DashboardPage({ onNavigate }: DashboardPageProps) {
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
    const [topProviders, setTopProviders] = useState<TopProvider[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRange, setActiveRange] = useState<DateRangeKey>('mes-actual');

    const fetchDashboardStats = useCallback(async (rangeKey: DateRangeKey) => {
        setLoading(true);
        try {
            const { start_date, end_date } = getDateRange(rangeKey);
            const params = new URLSearchParams({ start_date, end_date });

            const [statsRes, monthlyRes, providersRes] = await Promise.all([
                fetch(`/api/v1/invoices/stats?${params}`),
                fetch(`/api/v1/invoices/stats/monthly?${params}`),
                fetch(`/api/v1/invoices/stats/top-providers?${params}`),
            ]);

            const [statsData, monthlyData, providersData] = await Promise.all([
                statsRes.json(), monthlyRes.json(), providersRes.json()
            ]);

            setDashboardStats(statsData.stats);
            setMonthlyStats(monthlyData.monthly || []);
            setTopProviders(providersData.providers || []);
        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardStats(activeRange);
    }, [activeRange, fetchDashboardStats]);

    const handleRangeChange = (key: DateRangeKey) => {
        setActiveRange(key);
    };

    const financialComposition = dashboardStats ? [
        { name: 'Subtotal', value: dashboardStats.total_subtotal, color: CHART_COLORS.primary },
        { name: 'Descuentos', value: dashboardStats.total_descuentos, color: CHART_COLORS.error },
        { name: 'Impuestos', value: dashboardStats.total_impuestos, color: CHART_COLORS.warning },
        { name: 'Retenciones', value: dashboardStats.total_retenciones, color: CHART_COLORS.success },
    ].filter(i => i.value > 0) : [];

    const dateRangeButtons = (
        <>
            <style>{`
                .date-range-bar {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 1.5rem;
                }
                .date-range-btn {
                    padding: 0.4rem 1rem;
                    border-radius: 9999px;
                    border: 1.5px solid var(--color-border);
                    background: var(--color-bg-primary);
                    color: var(--color-text-secondary);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .date-range-btn:hover {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                .date-range-btn--active {
                    background: var(--color-primary);
                    border-color: var(--color-primary);
                    color: #fff;
                }
                .date-range-btn--active:hover {
                    color: #fff;
                    opacity: 0.9;
                }
            `}</style>
            <div className="date-range-bar">
                {DATE_RANGE_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        className={`date-range-btn${activeRange === opt.key ? ' date-range-btn--active' : ''}`}
                        onClick={() => handleRangeChange(opt.key)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </>
    );

    if (loading) {
        return (
            <>
                {dateRangeButtons}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
                    <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Cargando estadísticas...</span>
                </div>
            </>
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
            {dateRangeButtons}

            <style>{`
                .dashboard-cards {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .stat-list {
                    display: flex;
                    flex-direction: column;
                }
                .stat-list__row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--color-border);
                }
                .stat-list__row:last-child {
                    border-bottom: none;
                }
                .stat-list__left {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .stat-list__icon {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .stat-list__icon--info { background: var(--color-info-light); color: var(--color-info); }
                .stat-list__icon--primary { background: var(--color-primary-light); color: var(--color-primary); }
                .stat-list__icon--error { background: var(--color-error-light); color: var(--color-error); }
                .stat-list__icon--warning { background: var(--color-warning-light); color: var(--color-warning); }
                .stat-list__icon--success { background: var(--color-success-light); color: var(--color-success); }
                .stat-list__label {
                    font-size: 0.85rem;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                }
                .stat-list__value {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--color-text-primary);
                }
                @media (max-width: 1024px) {
                    .dashboard-cards {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            <div className="dashboard-cards">
                {/* Tarjeta 1: Información General */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Información General</span>
                    </div>
                    <div className="data-card-content">
                        <div className="stat-list">
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--info"><Calendar size={18} /></div>
                                    <span className="stat-list__label">Fecha</span>
                                </div>
                                <span className="stat-list__value">{dashboardStats.fecha_min ? `${dashboardStats.fecha_min} - ${dashboardStats.fecha_max}` : 'Sin datos'}</span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--primary"><Receipt size={18} /></div>
                                    <span className="stat-list__label">No Facturas</span>
                                </div>
                                <span className="stat-list__value">{dashboardStats.total_facturas.toLocaleString('es-CO')}</span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--info"><Building2 size={18} /></div>
                                    <span className="stat-list__label">No Proveedores</span>
                                </div>
                                <span className="stat-list__value">{dashboardStats.total_proveedores}</span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--info"><Users size={18} /></div>
                                    <span className="stat-list__label">Nits Únicos</span>
                                </div>
                                <span className="stat-list__value">{dashboardStats.total_nits}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tarjeta 2: Resumen Financiero */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Resumen Financiero</span>
                    </div>
                    <div className="data-card-content">
                        <div className="stat-list">
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--primary"><FileSpreadsheet size={18} /></div>
                                    <span className="stat-list__label">Subtotal</span>
                                </div>
                                <span className="stat-list__value"><CurrencyValue value={dashboardStats.total_subtotal} /></span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--error"><Percent size={18} /></div>
                                    <span className="stat-list__label">Descuentos</span>
                                </div>
                                <span className="stat-list__value"><CurrencyValue value={-dashboardStats.total_descuentos} /></span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--warning"><Percent size={18} /></div>
                                    <span className="stat-list__label">Impuestos</span>
                                </div>
                                <span className="stat-list__value"><CurrencyValue value={dashboardStats.total_impuestos} /></span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--error"><DollarSign size={18} /></div>
                                    <span className="stat-list__label">Retenciones</span>
                                </div>
                                <span className="stat-list__value"><CurrencyValue value={-dashboardStats.total_retenciones} /></span>
                            </div>
                            <div className="stat-list__row">
                                <div className="stat-list__left">
                                    <div className="stat-list__icon stat-list__icon--success"><TrendingUp size={18} /></div>
                                    <span className="stat-list__label">Monto Total</span>
                                </div>
                                <span className="stat-list__value"><CurrencyValue value={dashboardStats.total_monto} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="dashboard-cards">
                {/* Chart 1: Composición Financiera */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Composición Financiera</span>
                    </div>
                    <div className="data-card-content" style={{ height: 300 }}>
                        {financialComposition.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={financialComposition}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                        labelLine
                                    >
                                        {financialComposition.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <ChartEmptyState />}
                    </div>
                </div>

                {/* Chart 2: Top 10 Proveedores */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Top 10 Proveedores</span>
                    </div>
                    <div className="data-card-content" style={{ height: 300 }}>
                        {topProviders.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topProviders} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                                    <YAxis
                                        type="category"
                                        dataKey="proveedor"
                                        width={120}
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                                    />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Bar dataKey="total" name="Total" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <ChartEmptyState />}
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="dashboard-cards">
                {/* Chart 3: Facturas por Mes */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Facturas por Mes</span>
                    </div>
                    <div className="data-card-content" style={{ height: 300 }}>
                        {monthlyStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        labelFormatter={formatMonth}
                                        formatter={(value: number) => [value.toLocaleString('es-CO'), 'Facturas']}
                                    />
                                    <Bar dataKey="count" name="Facturas" fill={CHART_COLORS.info} radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <ChartEmptyState />}
                    </div>
                </div>

                {/* Chart 4: Montos por Mes */}
                <div className="data-card">
                    <div className="data-card-header">
                        <span className="data-card-title">Montos por Mes</span>
                    </div>
                    <div className="data-card-content" style={{ height: 300 }}>
                        {monthlyStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        labelFormatter={formatMonth}
                                        formatter={(value: number) => [formatCurrency(value), 'Total']}
                                    />
                                    <Area type="monotone" dataKey="total" name="Total" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#colorTotal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <ChartEmptyState />}
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

import React from 'react';
import { Badge } from '../../atoms/Badge';
import './StatCard.css';

export interface StatCardProps {
    /** Título o descripción de la métrica */
    label: string;
    /** Valor principal a mostrar */
    value: string | number | React.ReactNode;
    /** Icono descriptivo */
    icon: React.ReactNode;
    /** Variante de color para el icono y acentos */
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
    /** Valor de tendencia o badge adicional (opcional) */
    trend?: {
        label: string;
        variant: 'success' | 'error' | 'warning' | 'info' | 'default';
    };
    /** Indica si los datos están cargando */
    loading?: boolean;
}

/**
 * Molecule: StatCard
 * Tarjeta para mostrar métricas clave con consistencia visual
 */
export const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    icon,
    variant = 'primary',
    trend,
    loading = false,
}) => {
    return (
        <div className={`stat-card stat-card--${variant}`}>
            <div className="stat-card__content">
                <span className="stat-card__label">{label}</span>
                {loading ? (
                    <div className="stat-card__value-skeleton" />
                ) : (
                    <div className="stat-card__value-container">
                        <span className="stat-card__value">{value}</span>
                        {trend && (
                            <Badge variant={trend.variant} size="sm">
                                {trend.label}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
            <div className={`stat-card__icon-wrapper stat-card__icon-wrapper--${variant}`}>
                {icon}
            </div>
        </div>
    );
};

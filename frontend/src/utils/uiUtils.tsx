import type { ReactNode } from 'react';

/**
 * Renders a status badge based on the status string.
 * Used in extraction and import processes.
 */
export const renderStatusBadge = (status: string): ReactNode => {
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

/**
 * Formats a date string for display in the process log.
 */
export const formatProcessDate = (dateStr: string): string => {
    try {
        const isoDate = dateStr && dateStr.includes('T') ? dateStr.split('T')[0] :
            dateStr && dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr || '';

        const parts = isoDate.split(/[-/]/);
        if (parts.length === 3) {
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

/**
 * Formats a number as Colombian Pesos (COP).
 */
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(value);
};

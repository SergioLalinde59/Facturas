import React from 'react';
import './CurrencyValue.css';

export interface CurrencyValueProps {
    value: number;
    currency?: string;
    decimals?: number;
    className?: string;
    alwaysColor?: boolean; // Force color even if not in a specific context? Usually handled by value sign.
}

export const CurrencyValue: React.FC<CurrencyValueProps> = ({
    value,
    currency = 'COP',
    decimals = 0,
    className = '',
}) => {
    // Determine class based on value
    let colorClass = 'currency-value--zero';
    if (value > 0) colorClass = 'currency-value--positive';
    if (value < 0) colorClass = 'currency-value--negative';

    // Format the number
    const formattedValue = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);

    return (
        <span className={`currency-value ${colorClass} ${className}`}>
            {formattedValue}
        </span>
    );
};

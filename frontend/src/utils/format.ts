/**
 * Utility functions for formatting values
 */

/**
 * Formats a number as Colombian Pesos (COP)
 * @param value The numerical value to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted string (e.g., "$ 1.234.567")
 */
export const formatCurrency = (value: number, decimals: number = 0): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
};

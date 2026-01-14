import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /** Label del input */
    label?: string;
    /** Mensaje de error */
    error?: string;
    /** Texto de ayuda */
    helpText?: string;
    /** Tamaño del input */
    size?: 'sm' | 'md' | 'lg';
    /** Icono a mostrar antes del input */
    icon?: React.ReactNode;
    /** Ancho completo */
    fullWidth?: boolean;
}

/**
 * Componente Input reutilizable
 * 
 * @example
 * ```tsx
 * <Input 
 *   label="Email"
 *   type="email"
 *   placeholder="tu@email.com"
 *   error="Email inválido"
 * />
 * ```
 */
export const Input: React.FC<InputProps> = ({
    label,
    error,
    helpText,
    size = 'md',
    icon,
    fullWidth = false,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const containerClassNames = [
        'input-container',
        fullWidth && 'input-container--full-width',
        error && 'input-container--error',
        className
    ].filter(Boolean).join(' ');

    const inputClassNames = [
        'input',
        `input--${size}`,
        icon && 'input--with-icon',
        error && 'input--error'
    ].filter(Boolean).join(' ');

    return (
        <div className={containerClassNames}>
            {label && (
                <label htmlFor={inputId} className="input__label">
                    {label}
                </label>
            )}

            <div className="input__wrapper">
                {icon && <span className="input__icon">{icon}</span>}
                <input
                    id={inputId}
                    className={inputClassNames}
                    {...props}
                />
            </div>

            {error && (
                <span className="input__error">{error}</span>
            )}

            {helpText && !error && (
                <span className="input__help-text">{helpText}</span>
            )}
        </div>
    );
};

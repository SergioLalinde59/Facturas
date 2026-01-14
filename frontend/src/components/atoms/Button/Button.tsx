import React from 'react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Variante visual del botón */
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    /** Tamaño del botón */
    size?: 'sm' | 'md' | 'lg';
    /** Estado de carga */
    loading?: boolean;
    /** Icono a mostrar antes del texto */
    icon?: React.ReactNode;
    /** Ancho completo */
    fullWidth?: boolean;
}

/**
 * Componente Button reutilizable
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    children,
    disabled,
    className = '',
    ...props
}) => {
    const classNames = [
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full-width',
        loading && 'btn--loading',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classNames}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="btn__spinner" />
            ) : (
                <>
                    {icon && <span className="btn__icon">{icon}</span>}
                    {children && <span className="btn__text">{children}</span>}
                </>
            )}
        </button>
    );
};

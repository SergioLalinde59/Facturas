import type { FC, ReactNode } from 'react';
import './Badge.css';

export interface BadgeProps {
    /** Contenido del badge */
    children: ReactNode;
    /** Variante visual del badge */
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    /** Tamaño del badge */
    size?: 'sm' | 'md' | 'lg';
    /** Icono a mostrar antes del texto */
    icon?: ReactNode;
    /** ClassName adicional */
    className?: string;
}

/**
 * Componente Badge para indicadores de estado o información
 * 
 * @example
 * ```tsx
 * <Badge variant="success">Completado</Badge>
 * <Badge variant="error" icon={<AlertIcon />}>Error</Badge>
 * ```
 */
export const Badge: FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'md',
    icon,
    className = ''
}) => {
    const classNames = [
        'badge',
        `badge--${variant}`,
        `badge--${size}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <span className={classNames}>
            {icon && <span className="badge__icon">{icon}</span>}
            <span className="badge__text">{children}</span>
        </span>
    );
};

import React from 'react';
import { Button } from '../../atoms/Button';
import './QuickFilterButton.css';

export interface QuickFilterButtonProps {
    /** Texto del botón */
    label: string;
    /** Indica si el filtro está seleccionado */
    active: boolean;
    /** Callback al hacer click */
    onClick: () => void;
    /** Icono opcional */
    icon?: React.ReactNode;
}

/**
 * Molecule: QuickFilterButton
 * Botón especializado para selectores de rango de tiempo rápidos
 */
export const QuickFilterButton: React.FC<QuickFilterButtonProps> = ({
    label,
    active,
    onClick,
    icon
}) => {
    return (
        <Button
            variant={active ? 'primary' : 'secondary'}
            size="sm"
            className={`quick-filter-btn ${active ? 'quick-filter-btn--active' : ''}`}
            onClick={onClick}
            icon={icon}
        >
            {label}
        </Button>
    );
};

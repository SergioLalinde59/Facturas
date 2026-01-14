import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Input } from '../../atoms/Input';
import { Button } from '../../atoms/Button';
import './DirectoryInput.css';

export interface DirectoryInputProps {
    /** Label descriptivo */
    label: string;
    /** Valor actual (ruta) */
    value: string;
    /** Callback cuando cambia el texto */
    onChange: (value: string) => void;
    /** Callback al hacer click en el botón de exploración */
    onBrowse: () => void;
    /** Placeholder opcional */
    placeholder?: string;
    /** Ancho completo opcional */
    fullWidth?: boolean;
}

/**
 * Molecule: DirectoryInput
 * Combinación de input de texto y botón de exploración para rutas de archivos
 */
export const DirectoryInput: React.FC<DirectoryInputProps> = ({
    label,
    value,
    onChange,
    onBrowse,
    placeholder = 'Seleccione un directorio...',
    fullWidth = false
}) => {
    return (
        <div className={`directory-input ${fullWidth ? 'directory-input--full' : ''}`}>
            <div className="directory-input__input-wrapper">
                <Input
                    label={label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    fullWidth
                />
            </div>
            <div className="directory-input__button-wrapper">
                <Button
                    variant="secondary"
                    size="md"
                    icon={<FolderOpen size={16} />}
                    onClick={onBrowse}
                    title="Explorar directorio"
                >
                    Explorar
                </Button>
            </div>
        </div>
    );
};

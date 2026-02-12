export interface TaxRule {
    id?: number;
    code: string;
    name: string;
    agrupacion_id?: number;
    operation?: 'add' | 'subtract' | 'ignore';
    description: string;
}

export interface TaxRulesResponse {
    status?: string;
    message?: string;
    taxes?: Record<string, TaxRule>;
}

export const TaxService = {
    async getRules(): Promise<TaxRule[]> {
        const response = await fetch('/api/taxes/');
        if (!response.ok) {
            throw new Error('Error al cargar la configuración de impuestos');
        }
        return response.json();
    },

    async saveRules(rules: TaxRule[]): Promise<any> {
        // Individual save for each rule if multiple, but TaxMasterPage sends one at a time usually
        const results = await Promise.all(rules.map(async (rule) => {
            const method = rule.id ? 'PUT' : 'POST';
            const url = rule.id ? `/api/taxes/${rule.code}` : '/api/taxes/';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al guardar la configuración');
            }
            return response.json();
        }));

        return results;
    }
};

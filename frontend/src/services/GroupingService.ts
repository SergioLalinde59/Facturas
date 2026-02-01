import axios from 'axios';

// Usamos rutas relativas para aprovechar el proxy de Vite
const API_BASE_URL = '/api/groupings';


export interface Grouping {
    id?: number;
    name: string;
    operation: 'add' | 'subtract' | 'ignore';
}

export const GroupingService = {
    getGroupings: async (): Promise<Grouping[]> => {
        const response = await axios.get(`${API_BASE_URL}/`);
        return response.data;
    },

    getGrouping: async (id: number): Promise<Grouping> => {
        const response = await axios.get(`${API_BASE_URL}/${id}`);
        return response.data;
    },

    saveGrouping: async (grouping: Grouping): Promise<Grouping> => {
        if (grouping.id) {
            const response = await axios.put(`${API_BASE_URL}/${grouping.id}`, grouping);
            return response.data;
        } else {
            const response = await axios.post(`${API_BASE_URL}/`, grouping);
            return response.data;
        }
    },

    deleteGrouping: async (id: number): Promise<void> => {
        await axios.delete(`${API_BASE_URL}/${id}`);
    }
};

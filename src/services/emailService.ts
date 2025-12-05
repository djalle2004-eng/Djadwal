const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export interface EmailStatus {
    professorId: number;
    professorName: string;
    email: string;
    status: 'pending' | 'sending' | 'sent' | 'failed';
    error?: string;
}

export const emailService = {
    async sendProfessorSchedule(
        professorId: number,
        pdfBlob: Blob,
        semester: string
    ): Promise<{ success: boolean; messageId?: string }> {
        // Convert Blob to base64
        const base64 = await blobToBase64(pdfBlob);

        const response = await fetch(`${API_URL}/send-professor-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                professorId,
                pdfBase64: base64,
                semester
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send email');
        }

        return await response.json();
    },

    async initiateGmailAuth(): Promise<string> {
        const response = await fetch(`${API_URL}/gmail-auth-url`);
        if (!response.ok) {
            throw new Error('Failed to get auth URL');
        }
        const { url } = await response.json();
        return url;
    },

    async checkAuthStatus(): Promise<boolean> {
        try {
            const response = await fetch(`${API_URL}/gmail-auth-status`);
            if (!response.ok) return false;
            const { authenticated } = await response.json();
            return authenticated;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return false;
        }
    },

    async exchangeAuthCode(code: string): Promise<boolean> {
        const response = await fetch(`${API_URL}/gmail-auth-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            throw new Error('Failed to exchange auth code');
        }

        const data = await response.json();
        return data.success;
    }
};

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

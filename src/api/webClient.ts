// Client Web pour remplacer l'API Electron
// Ce fichier implémente la même interface que window.db mais utilise des appels API HTTP

// Utiliser l'URL relative en production, localhost en développement
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

// Helper pour les appels API
async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API Error: ${response.statusText}`);
    }

    return response.json();
}

export const webClient = {
    // --- Departments ---
    getDepartments: () => fetchApi('/departments'),
    addDepartment: (name: string, code: string) => fetchApi('/departments', {
        method: 'POST',
        body: JSON.stringify({ name, code })
    }),
    updateDepartment: (id: number, name: string, code: string) => fetchApi(`/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, code })
    }),
    deleteDepartment: (id: number) => fetchApi(`/departments/${id}`, { method: 'DELETE' }),

    // --- Groups ---
    getGroups: () => fetchApi('/groups'),
    addGroup: (name: string, specialization: string, parent_group_id: number | null, department_id: number, group_type: string, year: number) =>
        fetchApi('/groups', {
            method: 'POST',
            body: JSON.stringify({ name, specialization, parent_group_id, department_id, group_type, year })
        }),
    updateGroup: (id: number, name: string, specialization: string, parent_group_id: number | null, department_id: number, group_type: string, year: number) =>
        fetchApi(`/groups/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, specialization, parent_group_id, department_id, group_type, year })
        }),
    deleteGroup: (id: number) => fetchApi(`/groups/${id}`, { method: 'DELETE' }),

    // --- Courses ---
    getCourses: () => fetchApi('/courses'),
    addCourse: (name: string, code: string, metadata: any) => fetchApi('/courses', {
        method: 'POST',
        body: JSON.stringify({ name, code, metadata })
    }),
    updateCourse: (id: number, name: string, code: string, metadata: any) => fetchApi(`/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, code, metadata })
    }),
    deleteCourse: (id: number) => fetchApi(`/courses/${id}`, { method: 'DELETE' }),

    // --- Professors ---
    getProfessors: () => fetchApi('/professors'),
    addProfessor: (name: string, email: string, metadata: any) => fetchApi('/professors', {
        method: 'POST',
        body: JSON.stringify({ name, email, metadata })
    }),
    updateProfessor: (id: number, name: string, email: string, metadata: any) => fetchApi(`/professors/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, metadata })
    }),
    deleteProfessor: (id: number) => fetchApi(`/professors/${id}`, { method: 'DELETE' }),

    // --- Rooms ---
    getRooms: () => fetchApi('/rooms'),
    addRoom: (name: string, capacity: number) => fetchApi('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, capacity })
    }),
    updateRoom: (id: number, name: string, capacity: number) => fetchApi(`/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, capacity })
    }),
    deleteRoom: (id: number) => fetchApi(`/rooms/${id}`, { method: 'DELETE' }),

    // --- Assignments ---
    getAssignments: (academicYear: number, semester: number, specialization: string) => {
        const params = new URLSearchParams();
        if (academicYear) params.append('academicYear', academicYear.toString());
        if (semester) params.append('semester', semester.toString());
        if (specialization) params.append('specialization', specialization);
        return fetchApi(`/assignments?${params.toString()}`);
    },
    addAssignment: (assignment: any) => fetchApi('/assignments', {
        method: 'POST',
        body: JSON.stringify(assignment)
    }),
    updateAssignment: (id: number, assignment: any) => fetchApi(`/assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(assignment)
    }),
    deleteAssignment: (id: number) => fetchApi(`/assignments/${id}`, { method: 'DELETE' }),
    checkConflicts: (assignment: any) => {
        // Conflict checking can be complex to port 1:1 if logic is heavy on client.
        // Ideally, move conflict logic to backend. For now, we might need a dedicated endpoint.
        // Assuming backend doesn't have it yet, we might need to implement it or fetch all assignments and check locally (less efficient).
        // For this migration, let's assume we fetch assignments and check client-side or add an endpoint later.
        // Let's add a placeholder that returns false (no conflict) or implement a basic check if possible.
        // BETTER: Add a check-conflicts endpoint in backend. I'll add a TODO.
        console.warn('checkConflicts not fully implemented in web client yet');
        return Promise.resolve([]);
    },

    // --- Academic Years ---
    getAcademicYears: () => fetchApi('/academic-years'),
    getActiveAcademicYear: () => fetchApi('/academic-years/active'),
    addAcademicYear: (yearName: string, setAsCurrent: boolean) => fetchApi('/academic-years', {
        method: 'POST',
        body: JSON.stringify({ yearName, setAsCurrent })
    }),
    setActiveAcademicYear: (yearId: number) => fetchApi(`/academic-years/${yearId}/activate`, { method: 'POST' }),
    deleteAcademicYear: (yearId: number) => fetchApi(`/academic-years/${yearId}`, { method: 'DELETE' }),

    // --- Semesters ---
    getSemesters: (academicYearId: number) => fetchApi(`/semesters?academicYearId=${academicYearId}`),
    getActiveSemester: (academicYearId: number) => fetchApi(`/semesters/active?academicYearId=${academicYearId}`),
    addSemester: (academicYearId: number, semesterName: string, startDate: string, endDate: string, setAsCurrent: boolean, isPublic: boolean) =>
        fetchApi('/semesters', {
            method: 'POST',
            body: JSON.stringify({ academicYearId, semesterName, startDate, endDate, setAsCurrent, isPublic })
        }),
    setActiveSemester: (semesterId: number) => fetchApi(`/semesters/${semesterId}/activate`, { method: 'POST' }),
    updateSemester: (semesterId: number, semesterName: string, startDate: string, endDate: string, isPublic?: boolean) =>
        fetchApi(`/semesters/${semesterId}`, {
            method: 'PUT',
            body: JSON.stringify({ semesterName, startDate, endDate, isPublic })
        }),
    deleteSemester: (semesterId: number) => fetchApi(`/semesters/${semesterId}`, { method: 'DELETE' }),

    // --- Extra Sessions ---
    getExtraSessions: () => fetchApi('/extra-sessions'),
    createExtraSession: (session: any) => fetchApi('/extra-sessions', {
        method: 'POST',
        body: JSON.stringify(session)
    }),
    updateExtraSession: (id: number, session: any) => fetchApi(`/extra-sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(session)
    }),
    deleteExtraSession: (id: number) => fetchApi(`/extra-sessions/${id}`, { method: 'DELETE' }),
    archivePastSessions: () => fetchApi('/extra-sessions/archive', { method: 'POST' }), // Need to add this route if needed

    // --- Time Slots ---
    getTimeSlots: () => fetchApi('/time-slots'),

    // --- Auth & Users ---
    login: (username, password) => fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    logout: (userId) => Promise.resolve(true), // Client-side logout mostly
    getUsers: () => fetchApi('/users'),
    addUser: (userData) => fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
    }),
    updateUser: (id, userData) => fetchApi(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
    }),
    deleteUser: (id) => fetchApi(`/users/${id}`, { method: 'DELETE' }),
    changePassword: (userId, oldPassword, newPassword) => fetchApi(`/users/${userId}/password`, { // Need route
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword })
    }),
    resetPassword: (userId, newPassword) => fetchApi(`/users/${userId}/reset-password`, { // Need route
        method: 'POST',
        body: JSON.stringify({ newPassword })
    }),
    toggleUserStatus: (userId, isActive) => fetchApi(`/users/${userId}/status`, { // Need route
        method: 'PUT',
        body: JSON.stringify({ isActive })
    }),

    // --- Other ---
    getAuditLogs: (filters = {}) => fetchApi('/audit-logs'), // Need route
    getUserPermissions: (userId) => fetchApi(`/users/${userId}/permissions`), // Need route
    saveUserPermissions: (userId, permissionsJson) => fetchApi(`/users/${userId}/permissions`, { // Need route
        method: 'PUT',
        body: JSON.stringify({ permissions: permissionsJson })
    }),

    // --- Sandbox (Drafts) ---
    saveSandboxDraft: (name: string, data: any) => fetchApi('/sandbox/save', {
        method: 'POST',
        body: JSON.stringify({ name, data })
    }),
    getSandboxDrafts: () => fetchApi('/sandbox/list'),
    loadSandboxDraft: (id: number) => fetchApi(`/sandbox/load/${id}`),
    deleteSandboxDraft: (id: number) => fetchApi(`/sandbox/${id}`, { method: 'DELETE' }),

    // --- Backup & Export (Web Implementation) ---
    createBackup: async () => {
        try {
            const data = await fetchApi('/export/data');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `djadwal-backup-${timestamp}.json`;

            // Trigger download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true, filename };
        } catch (error) {
            console.error('Backup failed:', error);
            throw error;
        }
    },
    restoreBackup: () => {
        console.warn('Restore not yet implemented in web mode');
        return Promise.resolve(null);
    },
    getBackupHistory: () => Promise.resolve([]),
    deleteBackup: () => Promise.resolve(true),
    exportToJSON: (academicYearId) => fetchApi(`/export/json?academicYearId=${academicYearId}`), // Need route
    importFromJSON: (jsonData, mode) => fetchApi('/import/json', { // Need route
        method: 'POST',
        body: JSON.stringify({ data: jsonData, mode })
    }),

    // --- PDF & Print ---
    // Note: generate-pdf is already on the server, but the frontend usually calls window.dataUtils.generatePDF
    // We might need to map dataUtils as well.
};

export const webDataUtils = {
    exportData: () => fetchApi('/export/data'),
    importData: (data) => fetchApi('/import/data', { method: 'POST', body: JSON.stringify(data) }),
    saveToFile: (data, defaultPath) => {
        // Web alternative: Trigger download
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultPath || 'data.json';
        a.click();
        return Promise.resolve(true);
    },
    openFromFile: () => {
        // Web alternative: File input
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e: any) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target?.result);
                reader.onerror = (err) => reject(err);
                reader.readAsText(file);
            };
            input.click();
        });
    },
    generatePDF: async (htmlContent, options) => {
        const response = await fetch(`${API_URL}/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: htmlContent, options })
        });
        if (!response.ok) throw new Error('PDF Generation failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = options.filename || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },
    getPrintSettings: async () => {
        try {
            return await fetchApi('/print-settings', { method: 'GET' });
        } catch (error) {
            console.error('Error fetching print settings from server:', error);
            return {
                universityLogoUrl: '',
                facultyLogoUrl: '',
                universityName: 'جامعة الشهيد حمه لخضر - الوادي',
                facultyName: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'
            };
        }
    },
    savePrintSettings: async (settings: any) => {
        return await fetchApi('/print-settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    },
    uploadLogo: async (file: File, type: 'university' | 'faculty') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const response = await fetch(`${API_URL}/upload-logo`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error || 'Upload failed');
        }

        return await response.json();
    },
    getAuditLogs: () => {
        return fetchApi('/audit-logs', { method: 'GET' });
    },

    // --- Backup/Restore ---
    restoreBackup: async (file: File) => {
        console.warn('Restore backup not implemented yet');
        // Placeholder for future implementation
        return { success: false, message: 'Not implemented' };
    }
};

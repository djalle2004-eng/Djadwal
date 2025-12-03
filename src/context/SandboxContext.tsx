import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAssignments } from './AssignmentContext';

// Define the Assignment interface (should match AssignmentContext)
interface Assignment {
    id?: number;
    group_id: number;
    course_id: number;
    professor_id: number;
    room_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    academic_year?: string;
    semester?: string;
    specialization?: string;
    group_name?: string;
    course_name?: string;
    professor_name?: string;
    room_name?: string;
}

interface SandboxContextType {
    isSandboxMode: boolean;
    enterSandboxMode: () => void;
    exitSandboxMode: () => void;
    sandboxAssignments: Assignment[];
    addSandboxAssignment: (assignment: Assignment) => void;
    updateSandboxAssignment: (id: number, assignment: Assignment) => void;
    deleteSandboxAssignment: (id: number) => void; // Using ID for deletion might be tricky if new assignments don't have IDs. We might need a temp ID.
    deleteSandboxAssignmentByCell: (dayIndex: number, timeIndex: number, groupId: number) => void;
    commitChanges: () => Promise<void>;
    discardChanges: () => void;
    hasChanges: boolean;
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

export const SandboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { assignments, addAssignment, updateAssignment, deleteAssignment, refreshAssignments } = useAssignments();
    const [isSandboxMode, setIsSandboxMode] = useState(false);
    const [sandboxAssignments, setSandboxAssignments] = useState<Assignment[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync sandbox assignments with real assignments when entering sandbox mode
    const enterSandboxMode = () => {
        setSandboxAssignments(JSON.parse(JSON.stringify(assignments)));
        setIsSandboxMode(true);
        setHasChanges(false);
    };

    const exitSandboxMode = () => {
        setIsSandboxMode(false);
        setSandboxAssignments([]);
        setHasChanges(false);
    };

    const addSandboxAssignment = (assignment: Assignment) => {
        // Generate a temporary ID for new assignments
        const tempAssignment = { ...assignment, id: -Math.floor(Math.random() * 1000000) };
        setSandboxAssignments(prev => [...prev, tempAssignment]);
        setHasChanges(true);
    };

    const updateSandboxAssignment = (id: number, updatedAssignment: Assignment) => {
        setSandboxAssignments(prev => prev.map(a => a.id === id ? { ...updatedAssignment, id } : a));
        setHasChanges(true);
    };

    const deleteSandboxAssignment = (id: number) => {
        setSandboxAssignments(prev => prev.filter(a => a.id !== id));
        setHasChanges(true);
    };

    const deleteSandboxAssignmentByCell = (dayIndex: number, timeIndex: number, groupId: number) => {
        // This logic needs to match how we identify assignments in the schedule
        // We need to filter based on day, time, and group (or other unique constraints)
        // For now, let's assume we pass the ID if possible, but if not, we filter.
        // Actually, Schedule.tsx passes ID if available.
        // But for new assignments in sandbox, they have negative IDs.
        // Let's implement this helper just in case.
        setSandboxAssignments(prev => prev.filter(a =>
            !(a.day_of_week === dayIndex &&
                // We need to match time slots. Assuming start_time is enough or we need to match the exact slot logic.
                // In Schedule.tsx, we use start_time and end_time.
                // Let's rely on deleteSandboxAssignment(id) mostly.
                a.group_id === groupId)
        ));
        setHasChanges(true);
    };

    const commitChanges = async () => {
        try {
            // 1. Identify deleted assignments
            // Assignments present in 'assignments' but not in 'sandboxAssignments' (ignoring new ones with negative IDs)
            const originalIds = new Set(assignments.map(a => a.id));
            const sandboxIds = new Set(sandboxAssignments.map(a => a.id));

            const deletedIds = assignments.filter(a => !sandboxIds.has(a.id)).map(a => a.id);

            // 2. Identify new assignments
            // Assignments in 'sandboxAssignments' with negative IDs (or no IDs if we didn't set them, but we did)
            const newAssignments = sandboxAssignments.filter(a => a.id && a.id < 0);

            // 3. Identify updated assignments
            // Assignments in 'sandboxAssignments' with positive IDs that are different from original
            const updatedAssignments = sandboxAssignments.filter(a => {
                if (!a.id || a.id < 0) return false;
                const original = assignments.find(orig => orig.id === a.id);
                return JSON.stringify(original) !== JSON.stringify(a);
            });

            console.log('Committing changes:', { deletedIds, newAssignments, updatedAssignments });

            // Execute changes
            // Deletions
            for (const id of deletedIds) {
                if (id) await deleteAssignment(id);
            }

            // Additions
            for (const assignment of newAssignments) {
                // Remove temp ID
                const { id, ...rest } = assignment;
                await addAssignment(rest as Assignment);
            }

            // Updates
            for (const assignment of updatedAssignments) {
                if (assignment.id) await updateAssignment(assignment.id, assignment);
            }

            await refreshAssignments();
            exitSandboxMode();
        } catch (error) {
            console.error("Error committing changes:", error);
            throw error;
        }
    };

    const discardChanges = () => {
        if (window.confirm('هل أنت متأكد من إلغاء جميع التغييرات؟')) {
            enterSandboxMode(); // Reset to current state
        }
    };

    return (
        <SandboxContext.Provider value={{
            isSandboxMode,
            enterSandboxMode,
            exitSandboxMode,
            sandboxAssignments,
            addSandboxAssignment,
            updateSandboxAssignment,
            deleteSandboxAssignment,
            deleteSandboxAssignmentByCell,
            commitChanges,
            discardChanges,
            hasChanges
        }}>
            {children}
        </SandboxContext.Provider>
    );
};

export const useSandbox = () => {
    const context = useContext(SandboxContext);
    if (context === undefined) {
        throw new Error('useSandbox must be used within a SandboxProvider');
    }
    return context;
};

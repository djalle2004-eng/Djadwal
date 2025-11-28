import React, { createContext, useState, useEffect, useContext } from 'react';
import { AcademicYearContext } from './AcademicYearContext';

// Define the Assignment interface
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

interface AssignmentContextType {
  assignments: Assignment[];
  refreshAssignments: () => Promise<Assignment[]>;
  getAssignments: (academicYear?: string | null, semester?: string | null, specialization?: string | null) => Promise<Assignment[]>;
  addAssignment: (assignment: Assignment) => Promise<Assignment>;
  updateAssignment: (id: number, assignment: Assignment) => Promise<Assignment>;
  deleteAssignment: (id: number) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export const AssignmentContext = createContext<AssignmentContextType | null>(null);

export const AssignmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const academicYearContext = useContext(AcademicYearContext);

  const currentYear = academicYearContext?.currentYear;
  const currentSemester = academicYearContext?.currentSemester;

  // Fetch assignments from the database
  const refreshAssignments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get the current academic year and semester from context
      const yearName = currentYear ? currentYear.year_name : '';
      const semesterName = currentSemester ? currentSemester.semester_name : '';
      
      // Fetch assignments using the current academic year and semester
      const fetchedAssignments = await window.db.getAssignments(yearName, semesterName, '');
      
      setAssignments(fetchedAssignments);
      return fetchedAssignments;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء جلب البيانات"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getAssignments = async (academicYear?: string | null, semester?: string | null, specialization?: string | null) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch assignments using the provided academic year, semester, and specialization
      const fetchedAssignments = await window.db.getAssignments(academicYear, semester, specialization);
      
      setAssignments(fetchedAssignments);
      return fetchedAssignments;
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء جلب البيانات"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new assignment
  const addAssignment = async (assignment: Assignment) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Add the assignment to the database
      const result = await window.db.addAssignment(assignment);
      
      // Refresh assignments to get the updated list
      await refreshAssignments();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('assignment-changed', { 
        detail: { action: 'add', assignment: result } 
      }));
      
      return result;
    } catch (error) {
      console.error("Error adding assignment:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء إضافة التكليف"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an existing assignment
  const updateAssignment = async (id: number, assignment: Assignment) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Update the assignment in the database
      const result = await window.db.updateAssignment(id, assignment);
      
      // Refresh assignments to get the updated list
      await refreshAssignments();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('assignment-changed', { 
        detail: { action: 'update', assignment: result } 
      }));
      
      return result;
    } catch (error) {
      console.error("Error updating assignment:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء تحديث التكليف"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an assignment
  const deleteAssignment = async (id: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Delete the assignment from the database
      await window.db.deleteAssignment(id);
      
      // Refresh assignments to get the updated list
      await refreshAssignments();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('assignment-changed', { 
        detail: { action: 'delete', id } 
      }));
    } catch (error) {
      console.error("Error deleting assignment:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء حذف التكليف"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch assignments when the component mounts or when the academic year/semester changes
  useEffect(() => {
    if (currentYear && currentSemester) {
      refreshAssignments();
    }
  }, [currentYear, currentSemester]);

  return (
    <AssignmentContext.Provider
      value={{
        assignments,
        refreshAssignments,
        getAssignments,
        addAssignment,
        updateAssignment,
        deleteAssignment,
        isLoading,
        error
      }}
    >
      {children}
    </AssignmentContext.Provider>
  );
};

// Custom hook to use the assignment context
export const useAssignments = () => {
  const context = useContext(AssignmentContext);
  if (!context) {
    throw new Error("useAssignments must be used within an AssignmentProvider");
  }
  return context;
};

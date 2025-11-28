import React, { createContext, useState, useEffect, useContext } from 'react';
import { AcademicYear, Semester } from '../types/academicYear';
import { getActiveAcademicYear, getActiveSemester } from '../services/academicYearService';

interface AcademicYearContextType {
  currentYear: AcademicYear | null;
  currentSemester: Semester | null;
  setCurrentYear: (year: AcademicYear) => void;
  setCurrentSemester: (semester: Semester) => void;
  refreshCurrentSemester: () => Promise<void>;
}

export const AcademicYearContext = createContext<AcademicYearContextType | null>(null);

export const AcademicYearProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);

  const refreshCurrentSemester = async () => {
    if (currentYear) {
      try {
        const semester = await getActiveSemester(currentYear.id);
        if (semester) {
          setCurrentSemester(semester);
        }
      } catch (error) {
        console.error('فشل في تحديث بيانات الفصل الدراسي:', error);
      }
    }
  };

  // Enhanced setCurrentYear with localStorage persistence
  const handleSetCurrentYear = (year: AcademicYear) => {
    setCurrentYear(year);
    localStorage.setItem('selectedAcademicYear', JSON.stringify(year));
    // Clear semester when year changes
    setCurrentSemester(null);
    localStorage.removeItem('selectedSemester');
  };

  // Enhanced setCurrentSemester with localStorage persistence
  const handleSetCurrentSemester = (semester: Semester) => {
    console.log('[DEBUG] Setting current semester:', semester);
    setCurrentSemester(semester);
    localStorage.setItem('selectedSemester', JSON.stringify(semester));
    console.log('[DEBUG] Semester saved to localStorage');
  };

  useEffect(() => {
    // Load current academic year and semester on component mount
    const loadActiveSettings = async () => {
      try {
        // First, try to load from localStorage (user's last choice)
        const savedYear = localStorage.getItem('selectedAcademicYear');
        const savedSemester = localStorage.getItem('selectedSemester');

        console.log('[DEBUG] Loading saved settings:', { savedYear: !!savedYear, savedSemester: !!savedSemester });

        if (savedYear) {
          const parsedYear = JSON.parse(savedYear);
          console.log('[DEBUG] Parsed saved year:', parsedYear);
          setCurrentYear(parsedYear);
          
          if (savedSemester) {
            try {
              const parsedSemester = JSON.parse(savedSemester);
              console.log('[DEBUG] Parsed saved semester:', parsedSemester);
              
              // Verify the semester still exists and belongs to the saved year
              if (parsedSemester.academic_year_id === parsedYear.id) {
                console.log('[DEBUG] Setting saved semester as current');
                setCurrentSemester(parsedSemester);
                return; // Successfully loaded from localStorage
              } else {
                console.log('[DEBUG] Saved semester does not belong to saved year, clearing it');
                localStorage.removeItem('selectedSemester');
              }
            } catch (error) {
              console.error('[DEBUG] Error parsing saved semester:', error);
              localStorage.removeItem('selectedSemester');
            }
          }
          
          // If no valid saved semester, try to get active semester for the saved year
          console.log('[DEBUG] Trying to get active semester for saved year');
          const semester = await getActiveSemester(parsedYear.id);
          if (semester) {
            console.log('[DEBUG] Found active semester, setting it:', semester);
            setCurrentSemester(semester);
            localStorage.setItem('selectedSemester', JSON.stringify(semester));
          } else {
            console.log('[DEBUG] No active semester found for saved year');
          }
          return;
        }

        // Fallback: Load from database (active year/semester)
        console.log('[DEBUG] No saved year found, loading from database');
        const year = await getActiveAcademicYear();
        
        if (year) {
          console.log('[DEBUG] Found active year from database:', year);
          setCurrentYear(year);
          localStorage.setItem('selectedAcademicYear', JSON.stringify(year));
          
          const semester = await getActiveSemester(year.id);
          if (semester) {
            console.log('[DEBUG] Found active semester from database:', semester);
            setCurrentSemester(semester);
            localStorage.setItem('selectedSemester', JSON.stringify(semester));
          } else {
            console.log('[DEBUG] No active semester found in database');
          }
        } else {
          console.log('[DEBUG] No active year found in database');
        }
      } catch (error) {
        console.error('فشل في تحميل إعدادات السنة الدراسية:', error);
      }
    };

    loadActiveSettings();
  }, []);

  return (
    <AcademicYearContext.Provider 
      value={{ 
        currentYear, 
        currentSemester, 
        setCurrentYear: handleSetCurrentYear, 
        setCurrentSemester: handleSetCurrentSemester,
        refreshCurrentSemester
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
};

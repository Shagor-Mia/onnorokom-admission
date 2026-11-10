import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadStudentId, saveStudentId } from '../lib/studentId';

interface StudentContextValue {
  /** The current student's 17-digit birth registration number, or null. */
  studentId: string | null;
  setStudentId: (value: string | null) => void;
}

const StudentContext = createContext<StudentContextValue | undefined>(undefined);

/** Keeps the student ID in localStorage so it survives refresh and browser restarts. */
export function StudentProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState<string | null>(() => loadStudentId());

  const setStudentId = useCallback((value: string | null) => {
    saveStudentId(value);
    setState(value);
  }, []);

  const value = useMemo(() => ({ studentId, setStudentId }), [studentId, setStudentId]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentContextValue {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used inside StudentProvider');
  }
  return context;
}

import { createContext, useContext, useState, useRef, useCallback } from 'react';

const DirtyContext = createContext(null);

export function DirtyProvider({ children }) {
  const [modal, setModal] = useState(null); // null | { proceed: fn }
  const isDirtyRef = useRef(false);
  const saveFnRef = useRef(null);

  // Editors call setDirty(true, handleSave) on any change, setDirty(false) after save.
  // saveFn should always read from refs so it sees latest field values.
  const setDirty = useCallback((flag, saveFn = null) => {
    isDirtyRef.current = flag;
    saveFnRef.current = flag ? saveFn : null;
  }, []);

  // Navigation points call guardedNavigate(() => doTheNavigation()).
  // If dirty, shows modal; otherwise proceeds immediately.
  const guardedNavigate = useCallback((proceed) => {
    if (!isDirtyRef.current) {
      proceed();
    } else {
      setModal({ proceed });
    }
  }, []);

  const handleModalSave = async () => {
    const { proceed } = modal;
    if (saveFnRef.current) {
      try {
        await saveFnRef.current();
      } catch {
        // Save failed — close modal but don't navigate
        setModal(null);
        return;
      }
    }
    isDirtyRef.current = false;
    saveFnRef.current = null;
    setModal(null);
    proceed();
  };

  const handleModalDiscard = () => {
    isDirtyRef.current = false;
    saveFnRef.current = null;
    const { proceed } = modal;
    setModal(null);
    proceed();
  };

  const handleModalCancel = () => {
    setModal(null);
  };

  return (
    <DirtyContext.Provider value={{ setDirty, guardedNavigate }}>
      {children}
      {modal && (
        <div className="dirty-overlay" onClick={handleModalCancel}>
          <div className="dirty-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="dirty-modal-title">Unsaved Changes</h3>
            <p className="dirty-modal-body">
              You have unsaved changes. What would you like to do?
            </p>
            <div className="dirty-modal-actions">
              {saveFnRef.current && (
                <button className="btn btn-primary" onClick={handleModalSave}>
                  Save
                </button>
              )}
              <button className="btn btn-danger" onClick={handleModalDiscard}>
                Discard
              </button>
              <button className="btn btn-secondary" onClick={handleModalCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DirtyContext.Provider>
  );
}

export function useDirty() {
  const ctx = useContext(DirtyContext);
  if (!ctx) throw new Error('useDirty must be used within a DirtyProvider');
  return ctx;
}

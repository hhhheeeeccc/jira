import React, { useRef, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useFocusTrap } from '../hooks/useFocusTrap';

export const AlertDialog: React.FC = () => {
    const { alertMessage, setAlertMessage } = useStore();
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(dialogRef, !!alertMessage);

    // Focus the dialog when it opens
    useEffect(() => {
        if (alertMessage && dialogRef.current) {
            dialogRef.current.focus();
        }
    }, [alertMessage]);

    if (!alertMessage) return null;

    const handleClose = () => {
        setAlertMessage(null);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={handleClose} onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}>
            <div className="modal-dialog1" ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertCircle size={24} />
                        <h2 className="modal-dialog1__title" style={{ margin: 0 }}>تنبيه</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-dialog1__body" style={{ paddingTop: '16px' }}>
                    <p>{alertMessage}</p>
                </div>

                <div className="modal-dialog1__footer">
                    <button type="button" className="btn btn-primary" onClick={handleClose}>
                        موافق
                    </button>
                </div>
            </div>
        </div>
    );
};

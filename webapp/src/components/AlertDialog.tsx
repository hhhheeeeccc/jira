import { useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import useDialogEscape from '../hooks/useDialogEscape';

export const AlertDialog = () => {
    const { alertMessage, setAlertMessage } = useStore();
    const dialogRef = useRef<HTMLDivElement>(null);

    const isOpen = !!alertMessage;

    const handleClose = () => {
        setAlertMessage(null);
    };

    useDialogEscape(handleClose, isOpen);

    // Auto-focus dialog on open
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            const firstInput = dialogRef.current.querySelector('input, textarea, button:not([aria-label*=إغلاق])') as HTMLElement | null;
            if (firstInput) firstInput.focus();
        }
    }, [isOpen]);

    if (!alertMessage) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="dialog-title-AlertDialog">
            <div className="modal-dialog1" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()} ref={dialogRef} tabIndex={-1}>
                <div className="modal-dialog1__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mm-error-text)' }}>
                        <AlertCircle size={24} />
                        <h2 id="dialog-title-AlertDialog" className="modal-dialog1__title" style={{ margin: 0 }}>تنبيه</h2>
                    </div>
                    <button className="modal-dialog1__close" onClick={handleClose} aria-label="إغلاق">
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
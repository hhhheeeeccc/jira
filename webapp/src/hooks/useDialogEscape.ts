import { useEffect } from 'react';
export default function useDialogEscape(onClose: () => void, isOpen: boolean) {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, isOpen]);
}
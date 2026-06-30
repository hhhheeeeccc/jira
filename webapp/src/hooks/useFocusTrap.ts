import { useEffect } from 'react';

/**
 * useFocusTrap traps keyboard focus within the given element.
 * Prevents Tab/Shift+Tab from leaving the modal content.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, enabled: boolean = true) {
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusable = el.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !el.contains(document.activeElement as Node)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last || !el.contains(document.activeElement as Node)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [ref, enabled]);
}

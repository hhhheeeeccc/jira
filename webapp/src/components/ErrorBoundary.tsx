import React from 'react';
interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: string; }
export default class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false, error: '' };
    static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--center-channel-color)', padding: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>حدث خطأ غير متوقع</p>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>{this.state.error}</p>
                    <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.5rem', border: '1px solid var(--button-primary-bg)', borderRadius: '4px', background: 'var(--button-primary-bg)', color: 'var(--button-primary-text)', cursor: 'pointer' }}>
                        إعادة تحميل
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
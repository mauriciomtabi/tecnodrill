import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirmação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={onCancel}
    >
      <div 
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          margin: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: danger ? 'rgba(231, 76, 60, 0.15)' : 'rgba(240, 90, 34, 0.15)',
              color: danger ? 'var(--danger)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {danger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </div>

          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {title}
            </h3>
          </div>
        </div>

        {/* Message */}
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: danger ? 'var(--danger)' : 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: danger ? '0 2px 10px rgba(231,76,60,0.3)' : '0 2px 10px rgba(240,90,34,0.3)'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

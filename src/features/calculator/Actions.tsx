/**
 * ReturnWise Calculator Actions Component & Error Boundary (src/features/calculator/Actions.tsx)
 * Houses clipboard export, example loading, full reset, fallback modal, and safety Error Boundary.
 */

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { Button, Alert } from '../../components';
import { ComparisonResult, DecisionFlags, ScenarioInput } from '../../domain/types';
import {
  generateAnonymousSummaryReport,
  copyTextToClipboard,
  CopyResult,
} from '../../lib/clipboard';

// ==========================================
// 1. Error Boundary Component
// ==========================================

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CalculatorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('CalculatorErrorBoundary caught an error:', error, errorInfo);
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, error: null });
    this.state = { hasError: false, error: null };
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            background: 'var(--color-danger-50)',
            border: '1px solid var(--color-danger-200)',
            borderRadius: 'var(--radius-lg)',
            margin: '2rem 0',
          }}
          className="rw-stack-md"
        >
          <div className="rw-flex" style={{ gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.75rem' }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-danger-700)', fontSize: '1.125rem' }}>
                계산기 화면 렌더링 중 일시적 오류가 발생했습니다
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                입력된 수치나 플랫폼 데이터는 외부로 유출되지 않았으며 브라우저 메모리에 격리되어 있습니다.
              </p>
            </div>
          </div>

          <div className="rw-flex" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="primary" onClick={this.handleRecover}>
              기본 상태로 안전 복구
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
            >
              페이지 새로고침
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==========================================
// 2. Action Controls Component
// ==========================================

export interface ActionsProps {
  inputs: ScenarioInput;
  flags: DecisionFlags;
  comparison: ComparisonResult;
  onLoadExampleC01: () => void;
  onLoadExampleC03: () => void;
  onResetAll: () => void;
}

export const Actions: React.FC<ActionsProps> = ({
  inputs,
  flags,
  comparison,
  onLoadExampleC01,
  onLoadExampleC03,
  onResetAll,
}) => {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [fallbackModalText, setFallbackModalText] = useState<string | null>(null);

  const handleCopySummary = async () => {
    const reportText = generateAnonymousSummaryReport({
      inputs,
      flags,
      comparison,
    });

    const res: CopyResult = await copyTextToClipboard(reportText);

    if (res.success) {
      setCopyFeedback('📋 익명 의사결정 요약 리포트가 클립보드에 복사되었습니다!');
      setTimeout(() => setCopyFeedback(null), 4000);
    } else {
      // Show fallback text area modal
      setFallbackModalText(reportText);
    }
  };

  return (
    <div className="rw-stack-sm" style={{ margin: '1rem 0' }}>
      <div
        className="rw-flex-between"
        style={{
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--color-slate-50)',
          padding: '0.875rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-slate-200)',
        }}
      >
        {/* 좌측: 예시 불러오기 & 전체 초기화 */}
        <div className="rw-flex" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
            빠른 실행:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadExampleC01}
            style={{ fontSize: '0.75rem' }}
          >
            예시 1 (표준 반품)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadExampleC03}
            style={{ fontSize: '0.75rem' }}
          >
            예시 2 (부분환불 합의)
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            style={{ fontSize: '0.75rem', color: 'var(--color-danger-600)' }}
          >
            전체 초기화
          </Button>
        </div>

        {/* 우측: 익명 리포트 복사 */}
        <div className="rw-flex" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCopySummary}
            style={{ fontSize: '0.8125rem', gap: '0.375rem' }}
          >
            <span>📄</span>
            <span>익명 요약 리포트 복사</span>
          </Button>
        </div>
      </div>

      {/* 복사 성공 알림 배너 */}
      {copyFeedback && (
        <Alert type="success">
          {copyFeedback}
        </Alert>
      )}

      {/* 클립보드 권한 거절 시 Fallback 수동 복사 모달 */}
      {fallbackModalText && (
        <div
          role="dialog"
          aria-labelledby="fallback-modal-title"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 600,
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
            }}
            className="rw-stack-md"
          >
            <div className="rw-flex-between">
              <h3 id="fallback-modal-title" style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-slate-900)' }}>
                📋 요약 리포트 직접 복사 (수동 안내)
              </h3>
              <button
                type="button"
                onClick={() => setFallbackModalText(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-slate-500)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
              브라우저 자동 복사 권한이 제한되어 있습니다. 아래 텍스트 상자를 클릭하여 전체 선택(Ctrl+A 또는 Cmd+A) 후 복사(Ctrl+C)해 주세요:
            </p>

            <textarea
              readOnly
              value={fallbackModalText}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%',
                height: 220,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                padding: '0.75rem',
                border: '1px solid var(--color-slate-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-slate-50)',
                resize: 'none',
              }}
            />

            <div className="rw-flex-between">
              <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                🔒 본 리포트에는 고객 개인정보가 전혀 포함되어 있지 않습니다.
              </span>
              <Button variant="primary" size="sm" onClick={() => setFallbackModalText(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

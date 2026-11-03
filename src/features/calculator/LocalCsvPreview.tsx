import React, { useRef, useState } from 'react';
import { parseCsvBytes } from '../batch/csvParser';
import type { BatchRowResult, BatchValidationSummary } from '../batch/types';
import { generateBatchExportCsv, processBatchRows } from '../../../server/batch/batchProcessor';

type Preview = { summary: BatchValidationSummary; results: BatchRowResult[] };

/**
 * S5 LOCAL-ONLY CSV verification preview.
 *
 * No upload API, order execution, shared cache, persistent file storage,
 * paid entitlement, or third-party request. Personal source columns are
 * discarded by S4 before the preview state is committed.
 */
export const LocalCsvPreview: React.FC = () => {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);

  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const current = ++generation.current;
    setBusy(true);
    setPreview(null);
    setMessage('');
    if (file.size > 5 * 1024 * 1024) {
      setMessage('CSV 파일 크기는 5MiB 이하여야 합니다.');
      setBusy(false);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Ignore a previous file read if the user selected a newer file.
      if (current !== generation.current) return;
      const parsed = parseCsvBytes(bytes);
      const results = processBatchRows(parsed.rows);
      setPreview({summary: parsed.summary, results: results.results});
    } catch (error) {
      if (current !== generation.current) return;
      // Parser errors are generic, never include the raw uploaded data.
      const text = error instanceof Error ? error.message : 'CSV 형식을 확인해 주세요.';
      setMessage(text);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };

  const clear = () => {
    generation.current += 1;
    setPreview(null);
    setMessage('');
    setBusy(false);
  };

  const download = () => {
    if (!preview) return;
    // Generated from allowlisted status and numeric columns only.
    const csv = '\uFEFF' + generateBatchExportCsv(preview.results);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'returnwise-csv-review-results.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke after click to avoid leaking blob URLs.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sample = preview?.results.slice(0, 15) ?? [];
  const count = (status: BatchRowResult['status']) =>
    preview?.results.filter(r => r.status === status).length ?? 0;

  return (
    <section id="batch-preview" className="rw-card" aria-labelledby="batch-preview-heading">
      <div className="rw-stack-sm">
        <h2 id="batch-preview-heading" className="rw-card-title">
          CSV 일괄 검증 미리보기
        </h2>
        <p className="rw-help-text">
          실험 기능 · CSV를 브라우저 안에서만 검사합니다. 개인정보 열은 결과에서 제거하며,
          업로드·저장·결제·실제 반품 실행을 하지 않습니다.
        </p>
        <p className="rw-help-text">
          UTF-8 CSV · 최대 5MiB / 1,000행. 기본 데이터만으로는 처리 방식을 추천하지 않습니다.
          비용·정책 확인정보를 모두 제공한 경우에만 조건부 추정치가 표시됩니다.
        </p>
        <div className="rw-field">
          <label htmlFor="batch-csv-file" className="rw-label">CSV 파일 선택</label>
          <input id="batch-csv-file" type="file" accept=".csv,text/csv"
            className="rw-input" onChange={readFile}
            aria-describedby="batch-file-help" disabled={busy} />
          <span id="batch-file-help" className="rw-help-text">
            고객명·연락처·주소·주문번호가 있는 원본 파일은 사용하지 않는 것을 권장합니다.
          </span>
        </div>
        <div className="rw-flex" style={{flexWrap:'wrap'}}>
          <button type="button" className="rw-btn rw-btn-secondary" onClick={clear}>
            미리보기 초기화
          </button>
          <button type="button" className="rw-btn rw-btn-outline"
            disabled={!preview || busy} onClick={download}>
            검증 결과 CSV 내보내기
          </button>
        </div>
      </div>

      {busy && <p role="status" aria-live="polite">CSV를 검사하고 있습니다.</p>}
      {message && <p role="alert" className="rw-error-text">{message}</p>}
      {preview && (
        <div className="rw-stack" style={{marginTop:'1rem'}} data-testid="batch-preview-result">
          <p role="status" aria-live="polite">
            총 {preview.summary.totalRows}행 · 유효 {preview.summary.validRows}행 ·
            입력 오류 {preview.summary.errorRows}행 ·
            조건부 추정 {count('ESTIMATE_ONLY')}행 ·
            추가 확인 필요 {count('REVIEW_REQUIRED')}행
          </p>
          {preview.summary.piiWarning &&
            <p role="status" className="rw-alert rw-alert-warning">
              개인정보로 의심되는 열을 감지해 결과에서 제외했습니다.
            </p>
          }
          {preview.summary.columnErrors.length > 0 && (
            <div aria-labelledby="batch-error-heading">
              <h3 id="batch-error-heading" style={{fontSize:'1rem'}}>입력 검증 오류</h3>
              <ul style={{paddingLeft:'1.5rem'}}>
                {preview.summary.columnErrors.slice(0,8).map((error,index) =>
                  <li key={index}>행 {error.rowNumber} · {error.column} · {error.message}</li>
                )}
              </ul>
            </div>
          )}
          <div className="rw-table-container">
            <table className="rw-table">
              <caption style={{textAlign:'left',padding:'0.75rem'}}>
                결과 앞 {sample.length}행 미리보기 (전체 결과는 CSV로 내보내기)
              </caption>
              <thead>
                <tr><th scope="col">행</th><th scope="col">마켓</th>
                  <th scope="col">상태</th><th scope="col">조건부 비교</th>
                  <th scope="col">순경제비용</th></tr>
              </thead>
              <tbody>
                {sample.map((result) =>
                  <tr key={result.rowNumber}>
                    <td>{result.rowNumber}</td>
                    <td>{result.market}</td>
                    <td>{result.status}</td>
                    <td>{result.status==='ESTIMATE_ONLY'?result.bestOptionName:'검토 필요'}</td>
                    <td className="tabular-nums">
                      {result.status==='ESTIMATE_ONLY' && result.economicCost !== null
                        ? result.economicCost.toLocaleString('ko-KR') + '원'
                        : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="rw-help-text">
            이 결과는 법률 적합성·고객 합의·실현 수익을 보증하지 않습니다.
            서버 저장 또는 인증된 Pro 서비스를 제공하는 기능이 아닙니다.
          </p>
        </div>
      )}
    </section>
  );
};
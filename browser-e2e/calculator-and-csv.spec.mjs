import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const CSV_MINIMAL =
  '판매가,초기배송비,회수배송비,수수료율,마켓\n' +
  '30000,3000,3500,5.5,SMARTSTORE\n' +
  '-1,0,0,0,COUPANG';

const CSV_ATTESTED =
  '판매가,초기배송비,회수배송비,수수료율,마켓,환급액,검수비,회수순가치,수수료환급액,기타추가비,구매자회수비,귀책사유,고객요청,정책확인,권리확인,특례품목,정책구버전\n' +
  '30000,3000,3500,5.5,SMARTSTORE,30000,0,0,0,0,0,BUYER_REMORSE,REFUND,YES,YES,NO,NO';

function uploadCsv(page, content, name = 'safe-input.csv') {
  return page.locator('#batch-csv-file').setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
}

test.beforeEach(async ({page}) => {
  await page.goto('/');
});

test('production HTML loads the emitted CSS and renders the actual calculator', async ({page}) => {
  await expect(page.getByRole('heading', {level:1, name:/반품 한 건/})).toBeVisible();
  await expect(page.locator('#field-refund-amount')).toBeVisible();
  const details = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    layout: getComputedStyle(document.querySelector('.rw-container')).maxWidth,
    css: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/assets/index.css')),
  }));
  expect(details.bg).toBe('rgb(248, 250, 252)');
  expect(details.css).toBe(true);
  expect(details.layout).not.toBe('none');
});

test('fail-closed policy confirmation, correct example costs, metric toggle and reset', async ({page}) => {
  await expect(page.getByText('최저비용 추천 (1위)', {exact:true})).toHaveCount(0);
  await expect(page.locator('#step-results')).toContainText('적격');
  await page.getByRole('button', {name:'예시 1 (표준 반품)'}).click();
  await expect(page.locator('#step-results')).toContainText('25,500원');
  await expect(page.getByText('최저비용 추천 (1위)', {exact:true})).toHaveCount(1);
  await page.getByRole('tab', {name:'현금 지출 기준'}).click();
  await expect(page.getByRole('tab', {name:'현금 지출 기준'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button', {name:'전체 초기화'}).first().click();
  await expect(page.getByText('최저비용 추천 (1위)', {exact:true})).toHaveCount(0);
  await expect(page.locator('#field-refund-amount')).toHaveValue('');
});

test('invalid required amount is announced and cannot produce recommendation', async ({page}) => {
  await page.getByRole('button', {name:'예시 1 (표준 반품)'}).click();
  await page.locator('#field-refund-amount').fill('');
  await expect(page.locator('#field-refund-amount')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#field-refund-amount-error')).toBeVisible();
  await expect(page.getByText('최저비용 추천 (1위)', {exact:true})).toHaveCount(0);
});

test('320-to-mobile viewport contains no document-level horizontal overflow', async ({page}) => {
  // Pixel 5 emulation already supplies a mobile viewport; explicitly
  // exercise the minimum 320px layout for desktop browser contexts.
  if (test.info().project.name === 'chromium-desktop') {
    await page.setViewportSize({width:320,height:760});
  }
  const viewport = await page.evaluate(() => ({
    inner: window.innerWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(viewport.page, JSON.stringify(viewport)).toBeLessThanOrEqual(viewport.inner + 1);
  await expect(page.getByRole('link', {name:'CSV 미리보기'})).toBeVisible();
});

test('CSV browser upload: invalid row is shown without fake cost and result downloads', async ({page}) => {
  await uploadCsv(page, CSV_MINIMAL);
  const preview = page.locator('#batch-preview');
  await expect(preview.getByTestId('batch-preview-result')).toBeVisible();
  await expect(preview).toContainText('총 2행');
  await expect(preview).toContainText('입력 오류 1행');
  await expect(preview).toContainText('REVIEW_REQUIRED');
  await expect(preview).toContainText('ERROR');
  await expect(preview).not.toContainText('최저비용 추천');

  const pendingDownload = page.waitForEvent('download');
  await preview.getByRole('button', {name:'검증 결과 CSV 내보내기'}).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('returnwise-csv-review-results.csv');
  const saved = await readFile(await download.path(), 'utf8');
  expect(saved).toContain('REVIEW_REQUIRED');
  expect(saved).toContain('ERROR');
  expect(saved).not.toContain('0,0,0,SUCCESS');

  await preview.getByRole('button', {name:'미리보기 초기화'}).click();
  await expect(preview.getByTestId('batch-preview-result')).toHaveCount(0);
});

test('CSV conditional estimate follows attested facts but never claims certified eligibility', async ({page}) => {
  await uploadCsv(page, CSV_ATTESTED);
  const preview = page.locator('#batch-preview');
  await expect(preview).toContainText('ESTIMATE_ONLY');
  await expect(preview).toContainText('30,000원');
  await expect(preview).toContainText('법률 적합성');
});

test('PII CSV content is discarded from UI and never transmitted to any remote host', async ({page}) => {
  const outgoing = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      outgoing.push(request.url());
    }
  });
  const secret = '홍길동010-1234-5678';
  const csv = '판매가,초기배송비,회수배송비,수수료율,마켓,고객명\n' +
    '30000,3000,3500,5.5,SMARTSTORE,' + secret;
  await uploadCsv(page, csv);
  const preview = page.locator('#batch-preview');
  await expect(preview).toContainText('개인정보로 의심되는 열');
  await expect(preview).not.toContainText(secret);
  expect(outgoing).toEqual([]);
});

test('malformed CSV provides accessible non-PII error and keyboard actions', async ({page}) => {
  const preview = page.locator('#batch-preview');
  await uploadCsv(page, '판매가,초기배송비\n"30000,3000');
  await expect(preview.getByRole('alert')).toContainText('따옴표');
  await preview.locator('#batch-csv-file').focus();
  await expect(preview.locator('#batch-csv-file')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(preview.getByRole('button', {name:'미리보기 초기화'})).toBeFocused();
});

test('automated WCAG A/AA axe scan on real production HTML', async ({page}) => {
  const scan = await new AxeBuilder({page})
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(scan.violations, JSON.stringify(
    scan.violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n=>n.target)})),null,2
  )).toEqual([]);
});

test('local CSV error state passes automated WCAG A/AA checks', async ({page}) => {
  await uploadCsv(page, CSV_MINIMAL);
  await expect(page.locator('#batch-preview').getByTestId('batch-preview-result')).toBeVisible();
  const scan = await new AxeBuilder({page})
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(scan.violations, JSON.stringify(
    scan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),null,2
  )).toEqual([]);
});

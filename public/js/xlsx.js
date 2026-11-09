/**
 * 零依赖 XLSX 生成器（OOXML SpreadsheetML + STORE 方式 ZIP 容器）。
 *
 * 为什么自己写：项目零依赖约束（不引 SheetJS ~800KB），而 CSV 无法承载
 * 合并单元格 / 底纹 / 边框 / 列宽 / 数字格式——用户看到的「导出 Excel 是素 CSV」
 * 根因即在此。
 *
 * 技术要点：
 *  - ZIP 用 STORE（不压缩），只需 CRC32 + 本地/中央目录头，~90 行搞定，Excel 完全接受；
 *  - 字符串用 inlineStr，省掉 sharedStrings.xml；
 *  - 样式集中在 styles.xml 的 cellXfs，按索引引用；
 *  - 本文件不依赖 DOM / window，可直接在 Node 里单测。
 */

/* ---------------- XML 工具 ---------------- */

const escXml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // 过滤非法 XML 控制字符
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

const colLetter = (n) => { // 1 → A
  let s = '';
  while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/* ---------------- CRC32（ZIP 必需） ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------------- 最小 ZIP（STORE 不压缩） ---------------- */

function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

/** files: [{name, data(Uint8Array)}] → xlsx 字节流 */
export function zipStore(files) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : enc.encode(f.data);
    const crc = crc32(data);
    const sz = data.length;

    const lh = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), // sig, version, utf8 flag, store
      ...u16(0), ...u16(0x2100),                                 // time, date (固定值即可)
      ...u32(crc), ...u32(sz), ...u32(sz),
      ...u16(nameBytes.length), ...u16(0),
    ];
    localParts.push(new Uint8Array(lh), nameBytes, data);

    const ch = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x2100),
      ...u32(crc), ...u32(sz), ...u32(sz),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ];
    centralParts.push(new Uint8Array(ch), nameBytes);

    offset += lh.length + nameBytes.length + sz;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of [...localParts, ...centralParts, eocd]) { out.set(p, pos); pos += p.length; }
  return out;
}

/* ---------------- 样式索引（styles.xml cellXfs 顺序） ---------------- */

export const S = {
  DEFAULT: 0,
  TITLE: 1,        // 大标题
  SUBTITLE: 2,     // 副标题（灰、右对齐）
  LABEL: 3,        // 信息区标签（粗体）
  VALUE: 4,        // 信息区取值
  HEADER: 5,       // 表头（白字深蓝底、居中）
  CELL: 6,         // 明细文本
  CELL_CENTER: 7,  // 明细文本居中（单位/数量）
  MONEY: 8,        // 金额 #,##0.00
  MONEY_BOLD: 9,   // 汇总金额（粗体）
  SUMMARY_LABEL: 10, // 汇总标签（粗体、右对齐）
  NOTE: 11,        // 备注（自动换行）
  BOLD: 12,        // 普通粗体
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5">
  <font><sz val="11"/><name val="微软雅黑"/></font>
  <font><b/><sz val="11"/><name val="微软雅黑"/></font>
  <font><b/><sz val="18"/><name val="微软雅黑"/><color rgb="FF1E293B"/></font>
  <font><b/><sz val="11"/><name val="微软雅黑"/><color rgb="FFFFFFFF"/></font>
  <font><sz val="9"/><name val="微软雅黑"/><color rgb="FF94A3B8"/></font>
</fonts>
<fills count="4">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border>
    <left style="thin"><color rgb="FFCBD5E1"/></left>
    <right style="thin"><color rgb="FFCBD5E1"/></right>
    <top style="thin"><color rgb="FFCBD5E1"/></top>
    <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    <diagonal/>
  </border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* ---------------- sheet 构建 ---------------- */

/** cell: {v, s} 或原始值（number → 数字，其余按文本） */
function cellXml(ref, cell) {
  const s = cell && cell.s != null ? ` s="${cell.s}"` : '';
  const v = cell && typeof cell === 'object' ? cell.v : cell;
  if (typeof v === 'number' && isFinite(v)) {
    return `<c r="${ref}"${s}><v>${v}</v></c>`;
  }
  const text = escXml(v);
  if (text === '') return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

/**
 * 生成 sheet1.xml
 * rows: [{cells:[...], ht?}]，cells 下标即列号（从 0）
 * merges: ['A1:H1', ...]；cols: [{min,max,width}]；freezeRow: 冻结该行以上
 */
export function sheetXml({ rows, merges = [], cols = [], freezeRow = 0, colCount = 8 }) {
  const body = rows.map((r, i) => {
    const ht = r.ht ? ` ht="${r.ht}" customHeight="1"` : '';
    const cs = r.cells.map((c, j) => cellXml(`${colLetter(j + 1)}${i + 1}`, c)).join('');
    return `<row r="${i + 1}"${ht}>${cs}</row>`;
  }).join('');

  const colsXml = cols.length
    ? `<cols>${cols.map((c) => `<col min="${c.min}" max="${c.max || c.min}" width="${c.width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';
  const viewXml = freezeRow > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${viewXml}
<sheetFormatPr defaultRowHeight="20"/>
${colsXml}
<sheetData>${body}</sheetData>
${mergeXml}
</worksheet>`;
}

/* ---------------- 报价单排版 ---------------- */

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * 组装「装修报价单」工作表：标题 + 信息区 + 分类明细 + 汇总。
 * 返回 sheet1.xml 字符串。
 */
export function buildQuoteSheet(quote, items, org) {
  const q = quote || {};
  const list = Array.isArray(items) ? items : [];
  const subtotal = list.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
  const manage = Number(q.manage_fee) || 0;
  const tax = Number(q.tax_rate) || 0;
  const grand = (subtotal + manage) * (1 + tax / 100);

  const rows = [];
  const merges = [];

  // 标题 + 导出时间
  rows.push({ ht: 34, cells: [{ v: `${(org && org.name) || '云报价'} · 装修报价单`, s: S.TITLE }] });
  merges.push('A1:H1');
  rows.push({ ht: 16, cells: [{ v: `导出时间 ${new Date().toLocaleString('zh-CN', { hour12: false })}`, s: S.SUBTITLE }] });
  merges.push('A2:H2');
  rows.push({ cells: [] }); // 空行

  // 信息区：每行两组（标签+取值，取值各占 3 列合并）
  const info = [
    ['报价编号', q.quote_number, '项目名称', q.title],
    ['客户', q.customer_name, '小区 / 地址', q.community],
    ['城市', q.city, '建筑面积 (m²)', q.building_area],
    ['户型', q.layout, '装修档次', q.tier],
  ];
  for (const [l1, v1, l2, v2] of info) {
    const r = rows.length + 1;
    rows.push({ cells: [
      { v: l1, s: S.LABEL }, { v: v1 || '', s: S.VALUE }, { v: null, s: S.VALUE }, { v: null, s: S.VALUE },
      { v: l2, s: S.LABEL }, { v: v2 || '', s: S.VALUE }, { v: null, s: S.VALUE }, { v: null, s: S.VALUE },
    ] });
    merges.push(`B${r}:D${r}`, `F${r}:H${r}`);
  }
  rows.push({ cells: [] }); // 空行

  // 表头（此行冻结）
  const headerRow = rows.length;
  rows.push({ ht: 22, cells: ['分类', '项目', '单位', '数量', '单价(元)', '金额(元)', '成本(元)', '工艺说明']
    .map((v) => ({ v, s: S.HEADER })) });

  // 明细
  for (const it of list) {
    rows.push({ cells: [
      { v: it.group_name || '未分类', s: S.CELL },
      { v: it.name || '', s: S.CELL },
      { v: it.unit || '', s: S.CELL_CENTER },
      { v: Number(it.qty) || 0, s: S.CELL_CENTER },
      { v: money(it.unit_price), s: S.MONEY },
      { v: money((Number(it.unit_price) || 0) * (Number(it.qty) || 0)), s: S.MONEY },
      { v: money(it.cost_price), s: S.MONEY },
      { v: it.craft || '', s: S.CELL },
    ] });
  }
  if (!list.length) {
    rows.push({ cells: [{ v: '（暂无明细项目）', s: S.CELL_CENTER }, ...Array(7).fill({ v: '', s: S.CELL })] });
  }

  // 汇总：标签 A:E 合并右对齐，金额 F，G:H 空白封边
  const summary = [
    ['工程小计 (元)', money(subtotal)],
    ['管理费 (元)', money(manage)],
    ['税率 (%)', tax || 0],
    ['合计 (元)', money(grand)],
  ];
  for (const [label, val] of summary) {
    const r = rows.length + 1;
    const isMoney = label.includes('(元)');
    rows.push({ cells: [
      { v: label, s: S.SUMMARY_LABEL }, { v: null, s: S.SUMMARY_LABEL }, { v: null, s: S.SUMMARY_LABEL },
      { v: null, s: S.SUMMARY_LABEL }, { v: null, s: S.SUMMARY_LABEL },
      { v: val, s: isMoney ? S.MONEY_BOLD : S.MONEY_BOLD },
      { v: null, s: S.CELL }, { v: null, s: S.CELL },
    ] });
    merges.push(`A${r}:E${r}`, `G${r}:H${r}`);
  }

  // 备注
  const nr = rows.length + 1;
  rows.push({ ht: 30, cells: [
    { v: '备注', s: S.LABEL },
    { v: q.notes || '—', s: S.NOTE },
    ...Array(6).fill({ v: null, s: S.CELL }),
  ] });
  merges.push(`B${nr}:H${nr}`);

  return sheetXml({
    rows, merges,
    freezeRow: headerRow,
    cols: [
      { min: 1, width: 13 }, { min: 2, width: 28 }, { min: 3, width: 7 },
      { min: 4, width: 9 }, { min: 5, width: 12 }, { min: 6, width: 13 },
      { min: 7, width: 12 }, { min: 8, width: 38 },
    ],
  });
}

/** 组装完整 xlsx 字节流 */
export function buildQuoteXlsx(quote, items, org) {
  const enc = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`) },
    { name: '_rels/.rels', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`) },
    { name: 'xl/workbook.xml', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="报价单" sheetId="1" r:id="rId1"/></sheets>
</workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(buildQuoteSheet(quote, items, org)) },
  ];
  return zipStore(files);
}

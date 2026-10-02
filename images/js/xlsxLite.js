/**
 * xlsxLite.js
 * ------------------------------------------------------------------
 * 외부 CDN 라이브러리 없이 브라우저에서 .xlsx 파일을 직접 읽기 위한
 * 최소 구현체입니다. (ZIP 해제 + OOXML 워크시트 XML 파싱)
 *
 * 이렇게 자체 구현한 이유:
 * - GitHub Pages 등 외부망 접근이 제한될 수 있는 환경에서도
 *   추가 네트워크 요청/CDN 장애 없이 안정적으로 동작하도록 하기 위함.
 * - data 폴더의 표 형태(단일 시트, 일반 문자열/숫자 셀) 엑셀 파일만
 *   다루면 되므로, 병합 셀/차트/수식 등 복잡한 기능은 지원하지 않습니다.
 *
 * 지원 범위: xlsx(zip) 내부의 workbook.xml, workbook.xml.rels,
 * sharedStrings.xml, 시트 xml(sheetN.xml)을 해석하여
 * 2차원 배열(행 배열의 배열)로 변환합니다.
 * ------------------------------------------------------------------
 */

const xlsxLite = {

  SHEET_NS: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  REL_NS: "http://schemas.openxmlformats.org/package/2006/relationships",

  /**
   * xlsx 파일의 ArrayBuffer를 받아
   * { sheetNames: string[], sheets: { [name]: string[][] } } 형태로 반환.
   */
  async readWorkbook(arrayBuffer) {
    const entries = this._listZipEntries(arrayBuffer);

    const workbookXmlText = await this._readEntryText(entries, "xl/workbook.xml");
    const relsXmlText = await this._readEntryText(entries, "xl/_rels/workbook.xml.rels");
    const sharedStringsXmlText = await this._readEntryText(entries, "xl/sharedStrings.xml");

    if (!workbookXmlText) {
      throw new Error("INVALID_XLSX:workbook.xml 없음");
    }

    const parser = new DOMParser();

    // 1) 시트명 -> r:id 매핑
    const workbookDoc = parser.parseFromString(workbookXmlText, "application/xml");
    const sheetEls = Array.from(workbookDoc.getElementsByTagNameNS(this.SHEET_NS, "sheet"));
    const sheetNameToRid = {};
    const sheetNames = [];
    sheetEls.forEach((el) => {
      const name = el.getAttribute("name");
      const rid =
        el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
        el.getAttribute("r:id");
      sheetNameToRid[name] = rid;
      sheetNames.push(name);
    });

    // 2) r:id -> 실제 파일 경로 매핑
    const ridToTarget = {};
    if (relsXmlText) {
      const relsDoc = parser.parseFromString(relsXmlText, "application/xml");
      const relEls = Array.from(relsDoc.getElementsByTagNameNS(this.REL_NS, "Relationship"));
      relEls.forEach((el) => {
        ridToTarget[el.getAttribute("Id")] = el.getAttribute("Target");
      });
    }

    // 3) 공유 문자열 테이블
    const sharedStrings = sharedStringsXmlText
      ? this._parseSharedStrings(parser, sharedStringsXmlText)
      : [];

    // 4) 각 시트 xml 파싱
    const sheets = {};
    for (const name of sheetNames) {
      const rid = sheetNameToRid[name];
      let target = ridToTarget[rid];
      if (!target) continue;
      if (target.startsWith("/")) target = target.slice(1);
      const path = target.startsWith("xl/") ? target : `xl/${target}`;

      const sheetXmlText = await this._readEntryText(entries, path);
      if (!sheetXmlText) continue;

      sheets[name] = this._parseSheetXml(parser, sheetXmlText, sharedStrings);
    }

    return { sheetNames, sheets };
  },

  /* ================= ZIP 처리 ================= */

  /** ZIP 로컬 파일 헤더를 순차적으로 스캔하여 엔트리 목록 생성 */
  _listZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const entries = {};
    let offset = 0;
    const LOCAL_SIG = 0x04034b50;

    while (offset + 4 <= view.byteLength) {
      const sig = view.getUint32(offset, true);
      if (sig !== LOCAL_SIG) break; // 중앙 디렉터리 영역 등 도달 시 종료

      const method = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const nameStart = offset + 30;
      const nameBytes = new Uint8Array(arrayBuffer, nameStart, nameLen);
      const name = new TextDecoder("utf-8").decode(nameBytes);

      const dataStart = nameStart + nameLen + extraLen;

      entries[name] = { method, compressedSize, uncompressedSize, dataStart };

      offset = dataStart + compressedSize;
    }
    return { buffer: arrayBuffer, map: entries };
  },

  /** 특정 파일명을 압축 해제하여 UTF-8 텍스트로 반환 (없으면 null) */
  async _readEntryText(entries, name) {
    const info = entries.map[name];
    if (!info) return null;

    const raw = new Uint8Array(entries.buffer, info.dataStart, info.compressedSize);

    let bytes;
    if (info.method === 0) {
      // 저장(비압축)
      bytes = raw;
    } else if (info.method === 8) {
      // deflate 압축 해제 (브라우저 표준 DecompressionStream 사용)
      bytes = await this._inflateRaw(raw);
    } else {
      throw new Error(`UNSUPPORTED_ZIP_METHOD:${info.method}`);
    }

    return new TextDecoder("utf-8").decode(bytes);
  },

  async _inflateRaw(uint8) {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(uint8);
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  },

  /* ================= XML 파싱 ================= */

  _parseSharedStrings(parser, xmlText) {
    const doc = parser.parseFromString(xmlText, "application/xml");
    const siEls = Array.from(doc.getElementsByTagNameNS(this.SHEET_NS, "si"));
    return siEls.map((si) => {
      // <si><t>..</t></si> 또는 서식 있는 <si><r><t>..</t></r>...</si>
      const tEls = Array.from(si.getElementsByTagNameNS(this.SHEET_NS, "t"));
      return tEls.map((t) => t.textContent).join("");
    });
  },

  /** 셀 참조("C5")에서 0-based 열 인덱스 추출 */
  _colIndexFromRef(ref) {
    const match = /^([A-Z]+)/.exec(ref);
    if (!match) return 0;
    const letters = match[1];
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return col - 1;
  },

  _parseSheetXml(parser, xmlText, sharedStrings) {
    const doc = parser.parseFromString(xmlText, "application/xml");
    const rowEls = Array.from(doc.getElementsByTagNameNS(this.SHEET_NS, "row"));

    const rows = [];
    rowEls.forEach((rowEl) => {
      const cellEls = Array.from(rowEl.getElementsByTagNameNS(this.SHEET_NS, "c"));
      const rowArr = [];

      cellEls.forEach((cellEl) => {
        const ref = cellEl.getAttribute("r") || "";
        const colIdx = ref ? this._colIndexFromRef(ref) : rowArr.length;
        const type = cellEl.getAttribute("t");

        let value = null;
        const vEl = cellEl.getElementsByTagNameNS(this.SHEET_NS, "v")[0];

        if (type === "s") {
          const idx = vEl ? parseInt(vEl.textContent, 10) : -1;
          value = sharedStrings[idx] !== undefined ? sharedStrings[idx] : null;
        } else if (type === "inlineStr") {
          const isEl = cellEl.getElementsByTagNameNS(this.SHEET_NS, "is")[0];
          const tEl = isEl ? isEl.getElementsByTagNameNS(this.SHEET_NS, "t")[0] : null;
          value = tEl ? tEl.textContent : null;
        } else if (type === "str") {
          value = vEl ? vEl.textContent : null;
        } else if (type === "b") {
          value = vEl ? vEl.textContent === "1" : null;
        } else {
          // 숫자 (기본값)
          if (vEl && vEl.textContent !== "") {
            const num = Number(vEl.textContent);
            value = Number.isNaN(num) ? vEl.textContent : num;
          } else {
            value = null;
          }
        }

        // 비어있는 열은 null로 채워서 열 위치를 맞춤
        while (rowArr.length < colIdx) rowArr.push(null);
        rowArr[colIdx] = value;
      });

      rows.push(rowArr);
    });

    return rows;
  },
};

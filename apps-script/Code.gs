/**
 * 캐치볼 영상 평가 — 구글 드라이브·시트 연동용 앱스크립트
 *
 * 하는 일
 *  1. 학생이 올린 영상을 선생님 드라이브의 "캐치볼 제출" 폴더에 반/날짜별로 저장
 *  2. 제출 목록과 채점 결과를 구글 시트에 기록
 *  3. 선생님 페이지가 채점할 영상을 받아 갈 수 있게 전달
 *
 * 설치 방법은 같은 폴더의 README.md 를 보세요. (script.google.com 에 새 프로젝트 → 이 파일 붙여넣기 →
 * 배포 > 새 배포 > 웹 앱, "다음 사용자 인증 정보로 실행: 나", "액세스 권한: 모든 사용자" → 웹 앱 URL 복사)
 *
 * 설정값(프로젝트 설정 > 스크립트 속성)
 *  TEACHER_KEY  : 선생님 페이지에서 쓰는 비밀 키 (필수). 아무 문자열이나 길게.
 *  SUBMIT_CODE  : 학생이 제출할 때 입력해야 하는 제출 코드 (선택). 비워 두면 누구나 제출 가능.
 *  ROOT_FOLDER_ID : 영상을 넣을 드라이브 폴더 ID (선택). 비워 두면 "캐치볼 제출" 폴더를 자동으로 만듦.
 *  SHEET_ID     : 기록용 스프레드시트 ID (선택). 비워 두면 "캐치볼 평가 기록" 시트를 자동으로 만듦.
 */

var ROOT_FOLDER_NAME = '캐치볼 제출';
var SHEET_NAME = '캐치볼 평가 기록';
var SUBMISSIONS_SHEET = '제출목록';
var RESULTS_SHEET = '채점결과';
var MAX_RELAY_BYTES = 40 * 1024 * 1024; // 앱스크립트를 거쳐 올리는 경우(예비 경로) 최대 크기

function doGet() {
  return json_({ ok: true, service: 'catchball', version: 1 });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return json_({ ok: false, error: '요청 형식이 잘못되었습니다.' });
  }
  try {
    switch (req.action) {
      case 'ping':
        return json_({ ok: true });
      case 'start_upload':
        return json_(startUpload_(req));
      case 'upload_whole':
        return json_(uploadWhole_(req));
      case 'finish_upload':
        return json_(finishUpload_(req));
      case 'list_submissions':
        requireTeacher_(req);
        return json_({ ok: true, items: listSubmissions_() });
      case 'get_file':
        requireTeacher_(req);
        return json_(getFile_(req));
      case 'save_result':
        requireTeacher_(req);
        return json_(saveResult_(req));
      case 'list_results':
        requireTeacher_(req);
        return json_({ ok: true, items: listResults_() });
      default:
        return json_({ ok: false, error: '알 수 없는 요청: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// ── 공통 ──────────────────────────────────────────────

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function prop_(key) {
  return (PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function requireTeacher_(req) {
  var key = prop_('TEACHER_KEY');
  if (!key) throw new Error('스크립트 속성에 TEACHER_KEY 를 먼저 설정해 주세요.');
  if (!req.teacherKey || req.teacherKey !== key) throw new Error('선생님 키가 맞지 않습니다.');
}

function checkSubmitCode_(req) {
  var code = prop_('SUBMIT_CODE');
  if (code && String(req.submitCode || '').trim() !== code) throw new Error('제출 코드가 맞지 않습니다.');
}

function clean_(s, max) {
  return String(s == null ? '' : s).replace(/[\\/:*?"<>|\n\r\t]/g, ' ').trim().slice(0, max || 40);
}

function rootFolder_() {
  var id = prop_('ROOT_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var it = DriveApp.getRootFolder().getFoldersByName(ROOT_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.getRootFolder().createFolder(ROOT_FOLDER_NAME);
}

function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function targetFolder_(req) {
  var className = clean_(req.className, 30) || '반 미입력';
  var date = /^\d{4}-\d{2}-\d{2}$/.test(req.date || '') ? req.date : Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  return subFolder_(subFolder_(rootFolder_(), className), date);
}

function makeFileName_(req, originalName) {
  var ext = 'webm';
  var m = /\.([a-z0-9]{2,5})$/i.exec(originalName || '');
  if (m) ext = m[1].toLowerCase();
  var stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HHmmss');
  return clean_(req.student1, 20) + '_' + clean_(req.student2, 20) + '_' + stamp + '.' + ext;
}

function spreadsheet_() {
  var id = prop_('SHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    var files = DriveApp.getRootFolder().getFilesByName(SHEET_NAME);
    ss = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(SHEET_NAME);
  }
  ensureSheet_(ss, SUBMISSIONS_SHEET, ['제출시각', '평가일', '반', '학생1', '학생2', '파일ID', '파일명', '링크', '크기(MB)', '상태', '자동성공', '자동실패', '자동캐치시점(JSON)']);
  ensureSheet_(ss, RESULTS_SHEET, ['채점시각', '평가일', '반', '학생1', '학생2', '성공', '실패', '최대연속', '성공률(%)', '영상길이(초)', '파일ID', '비고', '캐치시점(JSON)']);
  return ss;
}

function ensureSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ── 학생 업로드 ─────────────────────────────────────────

/**
 * 1순위 경로: 드라이브 "이어 올리기(resumable)" 세션을 열어 주고, 학생 브라우저가 그 주소로 영상을 직접 보냄.
 * 영상이 앱스크립트를 거치지 않으므로 크기 제한이 사실상 없음.
 */
function startUpload_(req) {
  checkSubmitCode_(req);
  if (!clean_(req.student1) || !clean_(req.student2)) throw new Error('학생 이름 두 개를 입력해 주세요.');
  var folder = targetFolder_(req);
  var fileName = makeFileName_(req, req.fileName);
  var mime = req.mimeType || 'video/webm';
  var headers = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    'X-Upload-Content-Type': mime,
  };
  if (req.size) headers['X-Upload-Content-Length'] = String(req.size);
  if (req.origin) headers['Origin'] = req.origin; // 브라우저에서 바로 PUT 할 수 있게 CORS 출처 등록
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: headers,
    payload: JSON.stringify({ name: fileName, parents: [folder.getId()], mimeType: mime }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('드라이브 업로드 세션을 열지 못했습니다: ' + res.getContentText().slice(0, 200));
  var location = res.getHeaders()['Location'] || res.getHeaders()['location'];
  if (!location) throw new Error('드라이브가 업로드 주소를 주지 않았습니다.');
  return { ok: true, uploadUrl: location, folderId: folder.getId(), fileName: fileName };
}

/**
 * 예비 경로: 영상을 base64 로 앱스크립트에 보내면 여기서 드라이브에 저장. (압축한 영상, 40MB 이하)
 */
function uploadWhole_(req) {
  checkSubmitCode_(req);
  if (!clean_(req.student1) || !clean_(req.student2)) throw new Error('학생 이름 두 개를 입력해 주세요.');
  if (!req.data) throw new Error('영상 데이터가 없습니다.');
  var bytes = Utilities.base64Decode(req.data);
  if (bytes.length > MAX_RELAY_BYTES) throw new Error('영상이 너무 큽니다 (' + Math.round(bytes.length / 1048576) + 'MB). 압축해서 다시 올려 주세요.');
  var folder = targetFolder_(req);
  var fileName = makeFileName_(req, req.fileName);
  var file = folder.createFile(Utilities.newBlob(bytes, req.mimeType || 'video/webm', fileName));
  return { ok: true, fileId: file.getId(), fileName: fileName, size: bytes.length };
}

/** 업로드가 끝났다고 알리면 제출 목록 시트에 한 줄 기록 */
function finishUpload_(req) {
  checkSubmitCode_(req);
  var fileId = req.fileId;
  var file = null;
  if (fileId) {
    file = DriveApp.getFileById(fileId);
  } else if (req.fileName) {
    // 브라우저가 드라이브 응답을 못 읽은 경우: 폴더에서 이름으로 찾음
    var it = targetFolder_(req).getFilesByName(req.fileName);
    if (it.hasNext()) file = it.next();
  }
  if (!file) throw new Error('올라간 파일을 찾지 못했습니다.');
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(SUBMISSIONS_SHEET);
  var date = /^\d{4}-\d{2}-\d{2}$/.test(req.date || '') ? req.date : Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var hasAuto = req.autoSuccess != null || req.autoFail != null; // 앱 안에서 촬영하며 실시간으로 센 결과
  sh.appendRow([
    new Date(), date, clean_(req.className, 30), clean_(req.student1, 20), clean_(req.student2, 20),
    file.getId(), file.getName(), file.getUrl(), Math.round(file.getSize() / 1048576 * 10) / 10, '미채점',
    hasAuto ? Number(req.autoSuccess || 0) : '', hasAuto ? Number(req.autoFail || 0) : '',
    hasAuto ? JSON.stringify(req.autoEvents || []).slice(0, 45000) : '',
  ]);
  return { ok: true, fileId: file.getId(), fileName: file.getName(), link: file.getUrl() };
}

// ── 선생님 ───────────────────────────────────────────

function listSubmissions_() {
  var sh = spreadsheet_().getSheetByName(SUBMISSIONS_SHEET);
  var rows = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[5]) continue;
    out.push({
      row: i + 1,
      submittedAt: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      date: r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[1]),
      className: String(r[2]), student1: String(r[3]), student2: String(r[4]),
      fileId: String(r[5]), fileName: String(r[6]), link: String(r[7]), sizeMb: Number(r[8]) || 0, status: String(r[9]),
      autoSuccess: r[10] === '' || r[10] == null ? null : Number(r[10]),
      autoFail: r[11] === '' || r[11] == null ? null : Number(r[11]),
    });
  }
  return out.reverse();
}

/** 채점할 영상을 base64 로 돌려줌 (압축된 영상 기준. 큰 원본은 링크로 내려받아 직접 올리게 안내) */
function getFile_(req) {
  if (!req.fileId) throw new Error('fileId 가 없습니다.');
  var file = DriveApp.getFileById(req.fileId);
  var size = file.getSize();
  if (size > MAX_RELAY_BYTES) {
    return { ok: false, tooLarge: true, link: file.getUrl(), sizeMb: Math.round(size / 1048576), error: '영상이 커서(' + Math.round(size / 1048576) + 'MB) 바로 가져올 수 없습니다. 링크에서 내려받아 직접 올려 주세요.' };
  }
  var blob = file.getBlob();
  return { ok: true, fileName: file.getName(), mimeType: blob.getContentType() || 'video/webm', size: size, data: Utilities.base64Encode(blob.getBytes()) };
}

function saveResult_(req) {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(RESULTS_SHEET);
  var total = Number(req.success || 0) + Number(req.fail || 0);
  sh.appendRow([
    new Date(), req.date || '', clean_(req.className, 30), clean_(req.student1, 20), clean_(req.student2, 20),
    Number(req.success || 0), Number(req.fail || 0), Number(req.bestStreak || 0),
    total ? Math.round(Number(req.success || 0) / total * 100) : 0,
    Number(req.duration || 0), req.fileId || '', String(req.memo || '').slice(0, 200),
    JSON.stringify(req.events || []).slice(0, 45000),
  ]);
  if (req.fileId) {
    var sub = ss.getSheetByName(SUBMISSIONS_SHEET);
    var ids = sub.getRange(2, 6, Math.max(1, sub.getLastRow() - 1), 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(req.fileId)) sub.getRange(i + 2, 10).setValue('채점완료');
    }
  }
  return { ok: true };
}

function listResults_() {
  var sh = spreadsheet_().getSheetByName(RESULTS_SHEET);
  var rows = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    out.push({
      gradedAt: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      date: r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[1]),
      className: String(r[2]), student1: String(r[3]), student2: String(r[4]),
      success: Number(r[5]) || 0, fail: Number(r[6]) || 0, bestStreak: Number(r[7]) || 0,
      duration: Number(r[9]) || 0, fileId: String(r[10]), memo: String(r[11]),
    });
  }
  return out.reverse();
}

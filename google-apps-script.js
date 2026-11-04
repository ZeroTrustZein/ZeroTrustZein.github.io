/**
 * Beta sign-up desk — Google Apps Script backend for beta.html.
 *
 * Deploy:
 *   1. Open a Google Sheet > Extensions > Apps Script, paste this file.
 *   2. Deploy > New deployment > Web app.
 *        Execute as: Me    Who has access: Anyone
 *   3. Copy the /exec URL into SCRIPT_URL at the top of beta.html's script.
 *
 * Sheet "signups" (created on first post): ts | email | app | ip
 *
 * CORS: Apps Script can't set response headers, but web-app responses are
 * served via a googleusercontent redirect carrying
 * Access-Control-Allow-Origin: *, so a form-urlencoded POST (no preflight)
 * from the browser can read the JSON below.
 */

var SHEET_NAME = 'signups';
var APPS = {
  yomyom: {
    name: 'YomYom',
    pitch: 'the dashboard that reads your daily POS exports and flags the voids, comps and cash drift that don\u2019t match the receipts'
  },
  luka: {
    name: 'Luka',
    pitch: 'the archive for your family\u2019s photos, recordings and stories, with each family\u2019s data walled off at the database level'
  }
};
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Honeypot: bots fill "company". Pretend success, store nothing.
  if (p.company) return json_({ ok: true });

  var email = String(p.email || '').trim().toLowerCase();
  var key = String(p.app || '').toLowerCase();
  var app = APPS[key];
  if (!EMAIL_RE.test(email) || email.length > 254) return json_({ ok: false, error: 'invalid_email' });
  if (!app) return json_({ ok: false, error: 'invalid_app' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var duplicate;
  try {
    var sheet = sheet_();
    duplicate = sheet.getDataRange().getValues().some(function (r) {
      return String(r[1]).toLowerCase() === email && String(r[2]) === key;
    });
    // Apps Script never sees the client IP; record it only if a proxy forwards one.
    if (!duplicate) sheet.appendRow([new Date(), email, key, String(p.ip || '')]);
  } finally {
    lock.releaseLock();
  }

  if (!duplicate) {
    try { sendConfirmation_(email, app); } catch (err) { console.error(err); }
  }
  return json_({ ok: true, duplicate: duplicate });
}

function doGet() {
  return json_({ ok: true, service: 'beta-desk' });
}

function sendConfirmation_(email, app) {
  var subject = 'You\u2019re on the ' + app.name + ' beta list';
  var body = [
    'Hi,',
    '',
    'Thanks for signing up for the ' + app.name + ' private beta, ' + app.pitch + '.',
    '',
    'I\u2019m letting people in in small batches so I can read every piece of feedback myself. ' +
      'When a spot opens I\u2019ll email this address with an invite. That\u2019s the only email you\u2019ll get from this list.',
    '',
    'If you have a question, or want to tell me what you\u2019d use ' + app.name + ' for, just reply to this email.',
    '',
    'Zein Dergham',
    'https://zeindergham.me'
  ].join('\n');
  MailApp.sendEmail({ to: email, subject: subject, body: body, name: 'Zein Dergham' });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ts', 'email', 'app', 'ip']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

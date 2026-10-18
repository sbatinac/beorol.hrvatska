/**
 * BEOROL HRVATSKA — B2B Web Portal
 * Google Apps Script backend
 *
 * STRANICE:
 *   ?              -> Index.html
 *   ?page=proizvodi -> Proizvodi.html
 *   ?page=marka     -> Marka.html
 *   ?page=admin&pwd=XXX -> Admin.html (zaštićeno lozinkom)
 *
 * GOOGLE SHEET TABOVI:
 *   "Interesi"  -> Timestamp | CID | Stranica | Referrer
 *   "Upiti"     -> Timestamp | CID | Izvor | Tvrtka | Ime | Email | Telefon | Proizvodi | Poruka | Teme
 *   "Kontakti"  -> Email | Ime | CID | Poslano
 *
 * SCRIPT PROPERTIES:
 *   SHEET_ID    -> ID Google Sheeta
 *   ADMIN_PWD   -> Lozinka za admin stranicu (default: beorol2026)
 */

var PAGES = {
  'index':     'Index',
  'proizvodi': 'Proizvodi',
  'marka':     'Marka',
  'admin':     'Admin'
};
var DEFAULT_PAGE = 'index';

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var pageKey = (params.page && PAGES[params.page]) ? params.page : DEFAULT_PAGE;

  // ---- JSONP: hash lozinke za Marka stranicu ----
  // Staticna stranica na GitHub Pagesu ne moze citati obican odgovor
  // zbog CORS-a, pa se vraca JavaScript koji se ucita <script> tagom.
  if (params.action === 'markaPwdHash') {
    var cb = params.callback || 'callback';
    var hash = getMarkaPwdHash_();
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(hash) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // ---- ADMIN ZAŠTITA ----
  if (pageKey === 'admin') {
    var adminPwd = PropertiesService.getScriptProperties().getProperty('ADMIN_PWD') || 'beorol2026';
    if (params.pwd !== adminPwd) {
      var loginHtml = '<!DOCTYPE html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Beorol Admin</title>'
        + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;background:#F5F5F7;display:flex;align-items:center;justify-content:center;min-height:100vh}'
        + '.login{background:#fff;border-radius:16px;padding:40px 36px;box-shadow:0 4px 20px rgba(0,0,0,.08);text-align:center;max-width:380px;width:90%}'
        + '.login h1{font-size:20px;color:#1547B0;margin-bottom:6px}.login p{font-size:13px;color:#888;margin-bottom:24px}'
        + '.login input{width:100%;padding:12px 14px;border:1.5px solid #E3E3E3;border-radius:8px;font-size:14px;outline:none;text-align:center;letter-spacing:1px}'
        + '.login input:focus{border-color:#1547B0}'
        + '.login button{width:100%;padding:14px;background:#1547B0;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px}'
        + '.login button:hover{background:#103B90}'
        + '.err{color:#E2231A;font-size:12px;margin-top:10px;display:' + (params.pwd ? 'block' : 'none') + '}</style>'
        + '<div class="login"><h1>🔒 BEOROL ADMIN</h1><p>Unesite lozinku za pristup</p>'
        + '<input type="password" id="pwd" placeholder="Lozinka" autofocus '
        + 'onkeydown="if(event.key===\'Enter\')go()">'
        + '<button onclick="go()">Prijava</button>'
        + '<div class="err">Pogrešna lozinka</div></div>'
        + '<script>function go(){var p=document.getElementById("pwd").value;if(p)window.location.href="' + ScriptApp.getService().getUrl() + '?page=admin&pwd="+encodeURIComponent(p);}</script>';
      return HtmlService.createHtmlOutput(loginHtml)
        .setTitle('Beorol Admin – Prijava')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    var template = HtmlService.createTemplateFromFile('Admin');
    template.baseUrl = ScriptApp.getService().getUrl();
    template.pwd = adminPwd;
    return template.evaluate()
      .setTitle('Beorol Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var fileName = PAGES[pageKey];
  var cid = params.cid || generateCid_();

  try { logVisit_(cid, pageKey, params); } catch (err) { Logger.log('logVisit_ error: ' + err); }

  var template = HtmlService.createTemplateFromFile(fileName);
  template.cid = cid;
  template.baseUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle('Beorol – Grupacija Beorol')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function generateCid_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

function getSheet_(tabName) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID nije postavljen.');
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    if (tabName === 'Interesi') sheet.appendRow(['Timestamp', 'CID', 'Stranica', 'Referrer']);
    if (tabName === 'Upiti') sheet.appendRow(['Timestamp', 'CID', 'Izvor', 'Tvrtka', 'Ime', 'Email', 'Telefon', 'Proizvodi', 'Poruka', 'Teme']);
    if (tabName === 'Kontakti') sheet.appendRow(['Email', 'Ime', 'CID', 'Poslano']);
  }
  return sheet;
}

function logVisit_(cid, pageKey, params) {
  var sheet = getSheet_('Interesi');
  sheet.appendRow([new Date(), tekst_(cid), tekst_(pageKey), tekst_((params && params.ref) ? params.ref : '')]);
}

/**
 * Sprjecava da Sheets tumaci vrijednost kao formulu.
 * Vrijednost koja pocinje s =, +, - ili @ dobiva apostrof ispred,
 * sto Sheets tretira kao "prisilni tekst" i ne prikazuje ga.
 * Bez toga npr. telefon "+385 91 ..." zavrsi kao #ERROR!
 */
function tekst_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function saveUpit(data) {
  try {
    var sheet = getSheet_('Upiti');
    sheet.appendRow([
      new Date(),
      tekst_(data.cid),
      tekst_(data.izvor),
      tekst_(data.tvrtka),
      tekst_(data.ime),
      tekst_(data.email),
      tekst_(data.telefon),
      tekst_(data.proizvodi),
      tekst_(data.poruka),
      tekst_(data.teme)
    ]);

    // Pošalji potvrdu kupcu
    if (data.email) {
      try {
        Logger.log('Sending confirmation to: ' + data.email);
        var izvorLabel = data.izvor === 'marka' ? 'Beorol Prima (Private Label)' : 'Beorol asortiman';
        var proizvodi = (data.proizvodi || '').replace(/\n/g, '<br>');

        var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>'
          + '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#F5F5F7;">'
          + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:20px 0;"><tr><td align="center">'
          + '<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">'

          // Banner
          + '<tr><td style="padding:0;"><img src="https://i.imgur.com/acMj5jZ.png" alt="Beorol" width="600" style="display:block;width:100%;height:auto;"></td></tr>'

          // Naslov
          + '<tr><td style="padding:28px 32px 0;"><h2 style="font-family:Arial,sans-serif;color:#0D0D0D;font-size:20px;margin:0;">Hvala Vam na upitu!</h2></td></tr>'

          // Tekst
          + '<tr><td style="padding:16px 32px 0;"><p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#4A4A4A;margin:0;">'
          + 'Poštovani <strong>' + (data.ime || '') + '</strong>, zaprimili smo Vaš upit za <strong>' + izvorLabel + '</strong>. '
          + 'Naš tim će pregledati Vaše podatke i javiti Vam se u najkraćem mogućem roku, a najkasnije u roku od <strong>72 sata</strong>.</p></td></tr>'

          // Pregled
          + '<tr><td style="padding:20px 32px;"><div style="background:#F5F5F7;border-radius:10px;padding:18px 20px;">'
          + '<p style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#0D0D0D;margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px;">Pregled Vašeg upita:</p>'
          + '<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#4A4A4A;margin:0;">'
          + '<strong>Tvrtka:</strong> ' + (data.tvrtka || '—') + '<br>'
          + '<strong>Kontakt:</strong> ' + (data.ime || '—') + '<br>'
          + '<strong>Email:</strong> ' + (data.email || '—') + '<br>'
          + (data.telefon ? '<strong>Telefon:</strong> ' + data.telefon + '<br>' : '')
          + (proizvodi && proizvodi !== '(nije odabrano)' ? '<strong>Proizvodi:</strong><br>' + proizvodi + '<br>' : '')
          + (data.teme && data.teme !== '—' ? '<strong>Teme:</strong> ' + data.teme + '<br>' : '')
          + (data.poruka && data.poruka !== '—' ? '<strong>Poruka:</strong> ' + data.poruka : '')
          + '</p></div></td></tr>'

          // Kontakt
          + '<tr><td style="padding:0 32px 24px;">'
          + '<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#4A4A4A;margin:0;">Možete nas kontaktirati i izravno putem:</p>'
          + '<p style="font-family:Arial,sans-serif;font-size:12px;color:#0D0D0D;margin:6px 0 0;">'
          + '<a href="https://wa.me/385913584122" style="color:#25D366;font-weight:bold;text-decoration:none;">● WhatsApp</a> | '
          + '<a href="viber://chat/?number=%2B385913584122" style="color:#7360F2;font-weight:bold;text-decoration:none;">● Viber</a> | '
          + '<a href="mailto:batinac.s@beorol.com" style="color:#E2231A;font-weight:bold;text-decoration:none;">● Email</a> | '
          + '<a href="tel:+385913584122" style="color:#0D0D0D;font-weight:bold;text-decoration:none;">● +385 91 358 4122</a>'
          + '</p></td></tr>'

          // Potpis
          + '<tr><td style="padding:0 32px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-radius:10px;">'
          + '<tr><td style="padding:18px 22px;">'
          + '<p style="font-family:Arial,sans-serif;font-size:12px;color:#fff;margin:0 0 4px;"><strong>Saša Batinac</strong>, univ.spec.oec. · Predstavništvo Hrvatska</p>'
          + '<p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.7);margin:0;">📧 batinac.s@beorol.com · 📱 +385 91 358 4122</p>'
          + '</td></tr></table></td></tr>'

          // Footer
          + '<tr><td style="padding:12px 32px;" align="center"><p style="font-family:Arial,sans-serif;font-size:10px;color:#aaa;margin:0;">© 2026 Horizont LHB d.o.o. Osijek</p></td></tr>'
          + '</table></td></tr></table></body></html>';

        MailApp.sendEmail({
          to: data.email,
          subject: 'Potvrda upita — Grupacija Beorol',
          htmlBody: htmlBody,
          name: 'Grupacija Beorol — Predstavništvo Hrvatska',
          replyTo: 'batinac.s@beorol.com'
        });

      } catch (mailErr) {
        Logger.log('Confirmation mail error: ' + mailErr);
      }
    } else {
      Logger.log('No email provided, skipping confirmation mail');
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getAdminData() {
  var result = { posjeti: [], upiti: [], stats: {} };
  try {
    var interesi = getSheet_('Interesi');
    var iData = interesi.getDataRange().getValues();
    for (var i = Math.max(1, iData.length - 500); i < iData.length; i++) {
      result.posjeti.push({
        timestamp: iData[i][0] ? new Date(iData[i][0]).toISOString() : '',
        cid: iData[i][1] || '', stranica: iData[i][2] || '', ref: iData[i][3] || ''
      });
    }
    result.posjeti.reverse();

    var danas = new Date();
    var danasStr = danas.toISOString().substring(0, 10);
    var posjetaDanas = 0, posjetaTjedan = 0;
    var sedam = new Date(danas.getTime() - 7*24*60*60*1000);
    var uniqueCids = {}, stranice = {};
    for (var j = 1; j < iData.length; j++) {
      var ts = iData[j][0] ? new Date(iData[j][0]) : null;
      var cid = iData[j][1] || 'x';
      var str = iData[j][2] || 'x';
      uniqueCids[cid] = true;
      stranice[str] = (stranice[str] || 0) + 1;
      if (ts) {
        if (ts.toISOString().substring(0,10) === danasStr) posjetaDanas++;
        if (ts >= sedam) posjetaTjedan++;
      }
    }
    result.stats = {
      ukupno: iData.length - 1, danas: posjetaDanas, tjedan: posjetaTjedan,
      unique: Object.keys(uniqueCids).length, stranice: stranice
    };

    try {
      var upiti = getSheet_('Upiti');
      var uData = upiti.getDataRange().getValues();
      for (var k = 1; k < uData.length; k++) {
        result.upiti.push({
          timestamp: uData[k][0] ? new Date(uData[k][0]).toISOString() : '',
          cid: uData[k][1]||'', izvor: uData[k][2]||'', tvrtka: uData[k][3]||'',
          ime: uData[k][4]||'', email: uData[k][5]||'', telefon: uData[k][6]||'',
          proizvodi: uData[k][7]||'', poruka: uData[k][8]||'', teme: uData[k][9]||''
        });
      }
      result.upiti.reverse();
    } catch(e){}
  } catch(err) { result.error = err.toString(); }
  return result;
}

function clearSheet(tabName) {
  try {
    if (tabName !== 'Interesi' && tabName !== 'Upiti') {
      return { success: false, error: 'Nedozvoljen tab: ' + tabName };
    }
    var sheet = getSheet_(tabName);
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    return { success: true, tab: tabName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * ---- API ZA STATICNE STRANICE (GitHub Pages) ----
 * Stranice na GitHub Pagesu salju POST s JSON-om u tijelu.
 * Salje se kao text/plain da se izbjegne CORS preflight,
 * i s mode:'no-cors' jer odgovor nije potreban.
 *
 * Ocekivani oblik:
 *   { akcija: 'posjet', cid, stranica, ref }
 *   { akcija: 'upit',   cid, izvor, tvrtka, ime, email, telefon, proizvodi, poruka, teme }
 */
function doPost(e) {
  var out = { success: false };
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.akcija === 'posjet') {
      logVisit_(data.cid || '', data.stranica || '', { ref: data.ref || '' });
      out = { success: true, akcija: 'posjet' };

    } else if (data.akcija === 'upit') {
      out = saveUpit(data);

    } else {
      out = { success: false, error: 'Nepoznata akcija: ' + data.akcija };
    }
  } catch (err) {
    out = { success: false, error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ---- LOZINKA ZA MARKA STRANICU ----
 * Cuva se kao SHA-256 hash, nikad kao citljiv tekst,
 * da lozinka ne curi kroz javni JSONP odgovor.
 */
function sha256_(s) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    s,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b).toString(16)).slice(-2).padStart(2, '0');
  }).join('');
}

function getMarkaPwdHash_() {
  var props = PropertiesService.getScriptProperties();
  var hash = props.getProperty('MARKA_PWD_HASH');
  if (!hash) {
    hash = sha256_('prima2026');          // pocetna lozinka
    props.setProperty('MARKA_PWD_HASH', hash);
  }
  return hash;
}

/** Poziva se iz Admina. */
function setMarkaPwd(pwd) {
  try {
    pwd = String(pwd || '').trim();
    if (pwd.length < 4) {
      return { success: false, error: 'Lozinka mora imati barem 4 znaka.' };
    }
    PropertiesService.getScriptProperties()
      .setProperty('MARKA_PWD_HASH', sha256_(pwd));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

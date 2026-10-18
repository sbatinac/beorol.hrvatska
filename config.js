/**
 * BEOROL HRVATSKA — zajednicka konfiguracija za staticne stranice
 *
 * VAZNO: zamijeni GAS_API svojim Apps Script /exec URL-om.
 * Nadjes ga u Apps Script editoru: Deploy -> Manage deployments -> Web app URL.
 */
var GAS_API = 'https://script.google.com/macros/s/AKfycbxbUSrsse1kY-pEWDpcMnUmycJEQONnjUQzacjm5edH4FN8u4tm2TzaW3ZoRg9B3XHC/exec';

/* ---------- CID: stabilan identifikator posjetitelja ---------- */
function getCid() {
  var cid = '';
  try { cid = localStorage.getItem('beorol_cid') || ''; } catch (e) {}

  // CID iz URL-a ima prednost (npr. link iz email kampanje)
  var fromUrl = new URLSearchParams(location.search).get('cid');
  if (fromUrl) {
    cid = fromUrl;
  } else if (!cid) {
    cid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 10);
  }

  try { localStorage.setItem('beorol_cid', cid); } catch (e) {}
  return cid;
}

/* ---------- Slanje na Apps Script (fire-and-forget) ----------
   text/plain izbjegava CORS preflight; no-cors jer odgovor ne treba. */
function sendToGas(payload) {
  if (!GAS_API || GAS_API.indexOf('ZAMIJENI_ME') === 0) return;
  try {
    fetch(GAS_API, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(function () {});
  } catch (e) {}
}

/* ---------- Logiranje posjeta u tab Interesi ---------- */
function logVisit(stranica) {
  sendToGas({
    akcija: 'posjet',
    cid: getCid(),
    stranica: stranica,
    ref: document.referrer || ''
  });
}

/* ---------- Spremanje upita u tab Upiti + potvrdni mail ---------- */
function saveUpit(data) {
  data.akcija = 'upit';
  if (!data.cid) data.cid = getCid();
  sendToGas(data);
}

/* ---------- Admin link dobiva GAS adresu ---------- */
document.addEventListener('DOMContentLoaded', function () {
  var el = document.querySelectorAll('[data-gas-admin]');
  for (var i = 0; i < el.length; i++) {
    el[i].setAttribute('href', GAS_API + '?page=admin');
  }
});

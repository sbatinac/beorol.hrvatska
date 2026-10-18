# Beorol Hrvatska

B2B portal Grupacije Beorol — Predstavništvo Hrvatska.

## Što je gdje

| Datoteka | Opis |
|---|---|
| `index.html` | Naslovnica |
| `proizvodi.html` | Asortiman proizvoda + obrazac za upit |
| `marka.html` | Beorol Prima (private label) + obrazac za upit |
| `config.js` | Zajednička konfiguracija: GAS adresa, CID, logiranje |
| `apps-script/Code.gs` | Backend koji ostaje u Google Apps Scriptu |

## Postavljanje

### 1. Apps Script

Kopiraj `apps-script/Code.gs` u svoj Apps Script projekt (dodan je `doPost` koji prima pozive sa statičnih stranica).

Deploy → New deployment → Web app:

- **Execute as:** Me
- **Who has access:** Anyone

Kopiraj `/exec` URL.

### 2. config.js

Upiši taj URL u `config.js`:

```js
var GAS_API = 'https://script.google.com/macros/s/.../exec';
```

### 3. GitHub Pages

Settings → Pages → Source: `main`, folder `/ (root)`.

Portal je zatim na `https://sbatinac.github.io/beorol.hrvatska/`.

## Admin

Admin ostaje u Apps Scriptu jer provjera lozinke mora biti na serveru:

```
<GAS_API>?page=admin&pwd=...
```

Link u dnu naslovnice vodi onamo automatski.

## Što radi gdje

| | GitHub Pages | Apps Script |
|---|---|---|
| Tri stranice | ✅ | |
| Obrasci (Formspree) | ✅ | |
| Upiti u Sheet + potvrdni mail | | ✅ |
| Logiranje posjeta | | ✅ |
| Admin | | ✅ |

## Microsoft Clarity

Svaka stranica ima svoj projekt:

| Stranica | Project ID |
|---|---|
| `index.html` | `yb59y98wzs` |
| `proizvodi.html` | `yb5gtcapo6` |
| `marka.html` | `yb5fycq18l` |

Na GitHub Pagesu Clarity radi normalno — nema Apps Script iframea koji je prije blokirao snimke.

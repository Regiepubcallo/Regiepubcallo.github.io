/* Régie publicitaire Callo 2027 — comportement des pages */
(function () {
  'use strict';
  var CFG = window.CALLO_CONFIG || {};
  var KEY = 'callo2027';

  // ---------- Données ----------
  var FORMATS = {
    e16: { label: 'Encart 1/6 de page', prix: '320 €', file: 'Encart-1-6' },
    e14: { label: 'Encart 1/4 de page', prix: '400 €', file: 'Encart-1-4' },
    e12: { label: 'Encart 1/2 page', prix: '650 €', file: 'Encart-1-2' },
    p16: { label: 'Pack Partenaire 1/6 + logo', prix: '400 €', file: 'Pack-Partenaire-1-6' },
    p14: { label: 'Pack Partenaire 1/4 + logo', prix: '480 €', file: 'Pack-Partenaire-1-4' },
    p12: { label: 'Pack Partenaire 1/2 + logo', prix: '700 €', file: 'Pack-Partenaire-1-2' }
  };
  var BC_DIR = 'docs/bons-de-commande/BC_Callo_2027_';

  // ---------- Outils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function params() {
    var o = {}, q = location.search.replace(/^\?/, '');
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      try { o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); } catch (e) {}
    });
    return o;
  }
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(o) { try { sessionStorage.setItem(KEY, JSON.stringify(Object.assign(load(), o))); } catch (e) {} }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  // ---------- Empreinte de visite (navigateur, appareil, écran) ----------
  function navigateur() {
    var ua = navigator.userAgent || '';
    var v = (ua.match(/(Edg|OPR|Chrome|Firefox|Version|SamsungBrowser)\/([0-9]+)/) || [])[2] || '';
    if (/Edg\//.test(ua)) return 'Edge ' + v;
    if (/OPR\/|Opera/.test(ua)) return 'Opera ' + v;
    if (/SamsungBrowser/.test(ua)) return 'Samsung ' + v;
    if (/Firefox\//.test(ua)) return 'Firefox ' + v;
    if (/Chrome\//.test(ua)) return 'Chrome ' + v;
    if (/Safari\//.test(ua)) return 'Safari ' + v;
    return 'Autre';
  }
  function appareil() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua)) return 'Tablette';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'Mobile';
    return 'Ordinateur';
  }
  var UA = {
    navigateur: navigateur(),
    appareil: appareil(),
    ecran: (window.screen ? screen.width + 'x' + screen.height : '')
  };

  function post(payload, opts) {
    payload.token = CFG.TOKEN;
    var ctx = load();
    if (!payload.campagne) payload.campagne = ctx.c || '';
    if (!payload.source) payload.source = ctx.c || 'direct';
    if (!payload.page) payload.page = ctx.page || '';
    if (!payload.referrer) payload.referrer = ctx.referrer || '';
    if (!payload.navigateur) payload.navigateur = UA.navigateur;
    if (!payload.appareil) payload.appareil = UA.appareil;
    if (!payload.ecran) payload.ecran = UA.ecran;
    if (!payload.email && ctx.e) payload.email = ctx.e;
    if (!CFG.APPS_SCRIPT_URL) {
      if (window.console) console.warn('[Callo] Mode démonstration : aucun envoi (APPS_SCRIPT_URL vide).', payload.action);
      return new Promise(function (res) { setTimeout(function () { res({ ok: true, demo: true }); }, 500); });
    }
    if (opts && opts.beacon && navigator.sendBeacon) {
      try { navigator.sendBeacon(CFG.APPS_SCRIPT_URL, new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' })); } catch (e) {}
      return Promise.resolve({ ok: true });
    }
    return fetch(CFG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  // ---------- Contexte campagne / provenance (?e=mail&c=email1 & utm_source=…) ----------
  (function ctx() {
    var p = params(), o = {}, old = load();
    if (p.e && isEmail(p.e)) o.e = p.e.toLowerCase();
    // La source sert à mesurer la provenance : mailing, relance, QR, lien, direct.
    var src = (p.utm_source || p.c || p.ref || '').toLowerCase().trim();
    if (src) o.c = src.replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    if (p.utm_medium) o.medium = String(p.utm_medium).toLowerCase().slice(0, 30);
    if (!old.page) {
      o.page = (location.pathname.split('/').pop() || 'index.html');
      o.referrer = document.referrer ? (document.referrer.split('/')[2] || 'direct') : 'direct';
    }
    if (o.e || o.c || o.page) save(o);
  })();

  // ---------- Suivi des téléchargements ----------
  function trackDownloads() {
    $$('[data-doc]').forEach(function (a) {
      a.addEventListener('click', function () {
        post({ action: 'download', doc: a.getAttribute('data-doc'), detail: a.getAttribute('data-detail') || '' }, { beacon: true });
      });
    });
  }

  // ---------- Page formulaire ----------
  function initForm() {
    var f = $('#form-reponse'); if (!f) return;
    var ctx = load();
    if (ctx.e && !f.mail.value) f.mail.value = ctx.e;
    if (!sessionStorage.getItem(KEY + '_visite')) {
      post({ action: 'visite' }, { beacon: true });
      try { sessionStorage.setItem(KEY + '_visite', '1'); } catch (e) {}
    }
    var formats = $('#bloc-formats'), raison = $('#bloc-raison'), txt = $('#raison'), cnt = $('#raison-count');
    function sync() {
      var v = (f.querySelector('input[name=interet]:checked') || {}).value;
      formats.hidden = (v === 'non' || !v);
      raison.hidden = (v !== 'non');
    }
    $$('input[name=interet]', f).forEach(function (r) { r.addEventListener('change', sync); });
    sync();
    txt.addEventListener('input', function () { cnt.textContent = txt.value.length + ' / 300 caractères'; });

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = $('#err'), btn = $('#envoyer');
      err.textContent = '';
      var interet = (f.querySelector('input[name=interet]:checked') || {}).value;
      var chosen = $$('input[name=format]:checked', f).map(function (i) { return i.value; });
      var req = ['entreprise', 'nom', 'prenom', 'fonction', 'tel', 'mail'];
      for (var i = 0; i < req.length; i++) {
        if (!f[req[i]].value.trim()) { err.textContent = 'Merci de renseigner tous les champs obligatoires.'; f[req[i]].focus(); return; }
      }
      if (!isEmail(f.mail.value.trim())) { err.textContent = 'Adresse e-mail invalide.'; f.mail.focus(); return; }
      if (!interet) { err.textContent = 'Indiquez si vous êtes intéressé(e) : oui, peut-être ou non.'; return; }
      if (interet === 'oui' && !chosen.length) { err.textContent = 'Choisissez au moins un format (encart ou pack partenaire).'; return; }
      if (!f.rgpd.checked) { err.textContent = 'Merci de cocher la confirmation RGPD pour continuer.'; f.rgpd.focus(); return; }
      if (f.website.value) return; // anti-spam (champ piège)
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      var data = {
        action: 'reponse', entreprise: f.entreprise.value.trim(), nom: f.nom.value.trim(), prenom: f.prenom.value.trim(),
        fonction: f.fonction.value.trim(), tel: f.tel.value.trim(), email: f.mail.value.trim().toLowerCase(),
        interet: interet, formats: interet === 'non' ? [] : chosen.map(function (k) { return FORMATS[k].label + ' (' + FORMATS[k].prix + ')'; }),
        formatIds: interet === 'non' ? [] : chosen,
        raison: interet === 'non' ? txt.value.slice(0, 300) : '', rgpd: true
      };
      post(data).then(function (r) {
        if (r && r.ok === false) throw new Error(r.error || 'Erreur');
        save({ prenom: data.prenom, entreprise: data.entreprise, mail: data.email, e: data.email, interet: interet, formatIds: data.formatIds });
        location.href = interet === 'non' ? 'merci-non.html' : 'merci.html';
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Envoyer ma réponse';
        err.textContent = 'Envoi impossible pour le moment. Réessayez dans un instant ou écrivez à d.bougreau@lyceemarcelcallo.org.';
      });
    });
  }

  // ---------- Page merci (oui / peut-être) ----------
  function initMerci() {
    if (!$('#page-merci')) return;
    var c = load();
    $$('[data-prenom]').forEach(function (n) { n.textContent = c.prenom || ''; });
    var sel = $('#bc-select'), pdf = $('#bc-pdf'), docx = $('#bc-docx'), lab = $('#bc-label');
    Object.keys(FORMATS).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = FORMATS[k].label + ' — ' + FORMATS[k].prix + ' nets'; sel.appendChild(o);
    });
    var pre = (c.formatIds && c.formatIds[0]) || 'p16';
    sel.value = pre;
    function upd() {
      var k = sel.value, base = BC_DIR + FORMATS[k].file;
      pdf.href = base + '.pdf'; docx.href = base + '.docx';
      pdf.setAttribute('data-detail', FORMATS[k].label); docx.setAttribute('data-detail', FORMATS[k].label);
      lab.textContent = (c.formatIds && c.formatIds.length) ? 'Pré-rempli selon votre choix. Vous pouvez changer de variante :' : 'Choisissez votre variante (6 possibles) :';
    }
    sel.addEventListener('change', upd); upd();
    trackDownloads();

    var cf = $('#form-commentaire');
    if (cf) cf.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = $('#com-msg'), t = cf.message.value.trim(), b = $('#com-btn');
      if (!t) { msg.textContent = 'Écrivez votre message avant d\'envoyer.'; return; }
      b.disabled = true; msg.textContent = '';
      post({ action: 'commentaire', message: t.slice(0, 2000), email: c.mail || c.e || '', entreprise: c.entreprise || '' }).then(function () {
        msg.textContent = 'Merci, votre message a bien été transmis.'; cf.reset(); b.disabled = false;
      }).catch(function () { msg.textContent = 'Envoi impossible pour le moment, réessayez.'; b.disabled = false; });
    });
  }

  // ---------- Page dépôt ----------
  function readB64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  function initDepot() {
    var f = $('#form-depot'); if (!f) return;
    var c = load();
    if (c.entreprise) f.entreprise.value = c.entreprise;
    if (c.mail || c.e) f.mail.value = c.mail || c.e;
    var EXT = { bon: ['pdf'], encart: ['pdf', 'png', 'jpg', 'jpeg'], logo: ['ai', 'eps', 'svg', 'pdf', 'png'], bat: ['pdf', 'jpg', 'jpeg', 'png'] };
    var CHAMPS = ['bon', 'encart', 'logo', 'bat'];
    CHAMPS.forEach(function (k) {
      if (!f[k]) return;
      f[k].addEventListener('change', function () {
        var n = $('#n-' + k), file = f[k].files[0];
        n.textContent = file ? 'Fichier choisi : ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' Mo)' : '';
      });
    });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = $('#err'), btn = $('#envoyer'); err.textContent = '';
      if (!f.entreprise.value.trim()) { err.textContent = 'Indiquez le nom de votre entreprise.'; f.entreprise.focus(); return; }
      if (!isEmail(f.mail.value.trim())) { err.textContent = 'Indiquez votre adresse e-mail (pour recevoir le BAT).'; f.mail.focus(); return; }
      var files = [], total = 0, k, file, ext;
      var OBLIG = ['bon', 'encart', 'logo'];
      for (var i = 0; i < OBLIG.length; i++) {
        k = OBLIG[i]; file = f[k].files[0];
        if (!file) { err.textContent = 'Il manque un fichier : ' + { bon: 'le bon de commande signé', encart: 'votre encart', logo: 'votre logo' }[k] + '.'; return; }
        ext = (file.name.split('.').pop() || '').toLowerCase();
        if (EXT[k].indexOf(ext) < 0) { err.textContent = 'Format non accepté pour ' + k + ' (' + EXT[k].join(', ').toUpperCase() + ').'; return; }
        total += file.size; files.push({ k: k, file: file });
      }
      if (f.bat && f.bat.files[0]) {
        var bat = f.bat.files[0], bext = (bat.name.split('.').pop() || '').toLowerCase();
        if (EXT.bat.indexOf(bext) < 0) { err.textContent = 'Format non accepté pour le BAT signé (PDF, JPG ou PNG).'; return; }
        total += bat.size; files.push({ k: 'bat', file: bat });
      }
      if (total > (CFG.MAX_UPLOAD_MB || 20) * 1048576) { err.textContent = 'Fichiers trop volumineux (' + (total / 1048576).toFixed(1) + ' Mo). Maximum : ' + (CFG.MAX_UPLOAD_MB || 20) + ' Mo au total.'; return; }
      btn.disabled = true; btn.textContent = 'Envoi en cours, merci de patienter…';
      Promise.all(files.map(function (x) {
        return readB64(x.file).then(function (b64) { return { field: x.k, name: x.file.name, mime: x.file.type || 'application/octet-stream', data: b64 }; });
      })).then(function (arr) {
        return post({ action: 'depot', entreprise: f.entreprise.value.trim(), email: f.mail.value.trim().toLowerCase(), files: arr });
      }).then(function (r) {
        if (r && r.ok === false) throw new Error(r.error || 'Erreur');
        $('#bloc-form').hidden = true; $('#bloc-merci').hidden = false;
        window.scrollTo(0, 0);
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Envoyer mes documents';
        err.textContent = 'Envoi impossible pour le moment. Réessayez ou écrivez à d.bougreau@lyceemarcelcallo.org.';
      });
    });
  }

  // ---------- Temps passé sur le site et pages vues ----------
  function initMesure() {
    if (window.__calloMesureFaite) return;   // un seul compteur par page
    window.__calloMesureFaite = true;
    var PAGE = location.pathname.split('/').pop() || 'index.html';
    var vues = [];
    try { vues = JSON.parse(sessionStorage.getItem(KEY + '_pages') || '[]'); } catch (e) { vues = []; }
    if (vues[vues.length - 1] !== PAGE) vues.push(PAGE);
    try { sessionStorage.setItem(KEY + '_pages', JSON.stringify(vues)); } catch (e) {}

    var t0 = Date.now(), actif = 0, dernier = Date.now();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { actif += Date.now() - dernier; }
      else { dernier = Date.now(); }
    });
    function envoyer() {
      if (!document.hidden) { actif += Date.now() - dernier; }
      dernier = Date.now();
      var s = Math.round(actif / 1000);
      if (s < 2) return;
      actif = 0; // remis à zéro : le cumul est fait côté serveur, pas de double comptage
      post({ action: 'duree', seconds: s, pages: vues.length, page: PAGE }, { beacon: true });
    }
    window.addEventListener('pagehide', envoyer);
    document.addEventListener('visibilitychange', function () { if (document.hidden) envoyer(); });
    // envoi intermédiaire au bout de 45 s pour ne rien perdre si l'onglet reste ouvert
    setTimeout(envoyer, 45000);
  }


  // ---------- Contrôle qualité en direct sur la page de dépôt ----------
  // Mêmes seuils que le document Pré-BAT : 300 dpi exigés, 240 dpi plancher,
  // 1,5 % d'écart de proportions admis, arrondi de 1 dpi sur la densité.
  var GAB = {
    '1/6': { mm: [90, 85] },
    '1/4': { mm: [90, 130] },
    '1/2': { mm: [185, 130] },
    'logo': { mm: [90, 130], prebat: 'logo_kakemono' }
  };
  var PENDING = null;   // fichier à transmettre au Pré-BAT ouvert dans un autre onglet

  function px(mm, dpi) { return Math.round(mm / 25.4 * dpi); }

  function controlerFichier(file, cle) {
    return new Promise(function (resolve) {
      var g = GAB[cle], mm = g.mm;
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      var vecteur = ['ai', 'eps', 'svg'].indexOf(ext) >= 0;
      var res = {
        verdict: 'reserve', mesure: '', fichier: file.name,
        attendu: px(mm[0], 300) + ' × ' + px(mm[1], 300) + ' px',
        format: g.prebat || document.getElementById('format-encart').value
      };
      if (vecteur || ext === 'pdf') {
        res.raison = (vecteur ? 'Fichier vectoriel' : 'Fichier PDF') +
          ' : pas de définition en pixels. Contrôle visuel de l\'atelier, copie conservée.';
        return resolve(res);
      }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var dpi = Math.min(w / (mm[0] / 25.4), h / (mm[1] / 25.4));
        var ecart = Math.abs((w / h) / (mm[0] / mm[1]) - 1) * 100;
        res.mesure = w + ' × ' + h + ' px — ' + Math.round(dpi) + ' dpi';
        if (Math.round(dpi) < 240) {
          res.verdict = 'ko';
          res.raison = 'Définition insuffisante : ' + Math.round(dpi) + ' dpi. Il faut ' + res.attendu + '.';
        } else if (ecart > 1.5) {
          res.verdict = 'ko';
          res.raison = 'Proportions différentes du format : ' + ecart.toFixed(1) + ' % d\'écart.';
        } else if (Math.round(dpi) < 300) {
          res.verdict = 'reserve';
          res.raison = 'Définition limite (' + Math.round(dpi) + ' dpi). Acceptable, reprise recommandée pour un texte fin.';
        } else {
          res.verdict = 'ok';
          res.raison = 'Proportions et définition conformes : votre encart est prêt.';
        }
        URL.revokeObjectURL(url);
        resolve(res);
      };
      img.onerror = function () {
        res.raison = 'Image illisible par le navigateur. Vérifiez le fichier.';
        resolve(res);
      };
      img.src = url;
    });
  }

  function afficherControle(zone, res) {
    if (!zone) return;
    var mot = res.verdict === 'ok' ? 'Conforme' : (res.verdict === 'reserve' ? 'À confirmer' : 'Refusé');
    zone.className = 'ctl ' + res.verdict;
    zone.hidden = false;
    zone.innerHTML =
      '<div class="ctl-h"><span class="ctl-badge">' + mot + '</span>' +
      '<span class="ctl-m">' + (res.mesure || res.fichier) + '</span></div>' +
      '<p>' + res.raison + (res.verdict === 'ok' ? '' : ' Attendu : ' + res.attendu + '.') + '</p>' +
      '<a class="ctl-a" href="prebat.html" target="_blank" rel="noopener">Voir et imprimer mon Pré-BAT</a>';
    var lien = zone.querySelector('.ctl-a');
    lien.addEventListener('click', function () { PENDING = res; });
  }

  function initControle() {
    var f = document.getElementById('form-depot');
    if (!f || !f.encart) return;

    // format présélectionné d'après le choix fait plus tôt sur le site
    try {
      var ctx = load(), ids = ctx.formatIds || [];
      var sel = document.getElementById('format-encart');
      var map = { e16: '1/6', e14: '1/4', e12: '1/2', p16: '1/6', p14: '1/4', p12: '1/2' };
      if (sel && ids.length && map[ids[0]]) sel.value = map[ids[0]];
    } catch (e) {}

    f.encart.addEventListener('change', function () {
      var file = f.encart.files[0];
      if (!file) return;
      controlerFichier(file, document.getElementById('format-encart').value)
        .then(function (r) { afficherControle(document.getElementById('ctl-encart'), r); });
    });
    if (f.logo) f.logo.addEventListener('change', function () {
      var file = f.logo.files[0];
      if (!file) return;
      controlerFichier(file, 'logo')
        .then(function (r) { afficherControle(document.getElementById('ctl-logo'), r); });
    });

    // le Pré-BAT ouvert dans un onglet voisin réclame le fichier
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'prebat-ready' || !PENDING) return;
      e.source.postMessage({ type: 'prebat-file', file: PENDING.fichier, format: PENDING.format }, location.origin);
    });
  }

  document.addEventListener('DOMContentLoaded', function () { initMesure(); initForm(); initMerci(); initDepot(); initControle(); });
})();

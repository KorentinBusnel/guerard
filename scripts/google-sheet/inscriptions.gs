/**
 * Inscriptions « Again and Again » → la feuille Google à laquelle ce script est lié.
 *
 * Mise en place (une fois) :
 *  1. Ouvrir la feuille « Inscriptions — Again and Again » → Extensions → Apps Script.
 *  2. Remplacer le contenu de Code.gs par ce fichier, enregistrer.
 *  3. Déployer → Nouveau déploiement → type « Application Web » :
 *     Exécuter en tant que : Moi ; Qui a accès : Tout le monde → Déployer → autoriser.
 *  4. Copier l'URL de l'application Web (…/exec) : c'est VITE_INSCRIPTION_ENDPOINT.
 *
 * POST (JSON envoyé en text/plain par le site) : une ligne par coureur (deux pour un duo).
 * GET : le nombre de dossards restants, affiché sur la page.
 * Chaque réponse porte `dossards` (le plafond ci-dessous) : le site n'affiche les
 * restants que si ce plafond est le sien (évite un compte faux après un changement).
 *
 * Après modification de ce fichier : Déployer → Gérer les déploiements → crayon →
 * Version : « Nouvelle version » → Déployer (l'URL /exec ne change pas).
 */
const DOSSARDS = 40;
const EDITION = "Again and Again";
const EMAIL_COL = 4; // Horodatage | Formule | Nom et prénom | E-mail | Binôme | Édition

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data._gotcha) return json({ ok: true }); // pot de miel : un robot, on ne garde rien
    const runners = [{ nom: clean(data.nom), email: clean(data.email) }];
    if (data.formule === "duo") runners.push({ nom: clean(data.ami_nom), email: clean(data.ami_email) });
    const valid = runners.every((r) => r.nom && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
    if (!valid) return json({ ok: false, error: "invalide" });

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const taken = Math.max(sheet.getLastRow() - 1, 0);
    if (taken + runners.length > DOSSARDS) return json({ ok: false, error: "complet", restants: Math.max(DOSSARDS - taken, 0), dossards: DOSSARDS });
    const emails = taken
      ? sheet.getRange(2, EMAIL_COL, taken, 1).getValues().map((row) => String(row[0]).toLowerCase())
      : [];
    if (runners.some((r) => emails.indexOf(r.email.toLowerCase()) !== -1)) return json({ ok: false, error: "deja-inscrit" });

    const now = new Date();
    const formule = runners.length === 2 ? "Avec un ami" : "Seul";
    runners.forEach((r, i) => {
      const binome = runners.length === 2 ? runners[1 - i].nom : "";
      sheet.appendRow([now, formule, r.nom, r.email, binome, EDITION]);
    });
    return json({ ok: true, restants: DOSSARDS - taken - runners.length, dossards: DOSSARDS });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const taken = Math.max(sheet.getLastRow() - 1, 0);
  return json({ ok: true, restants: Math.max(DOSSARDS - taken, 0), dossards: DOSSARDS });
}

/** Texte nettoyé ; un début « = + - @ » serait lu comme une formule par Sheets. */
function clean(value) {
  const s = String(value || "").trim().slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

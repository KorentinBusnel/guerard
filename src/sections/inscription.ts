/**
 * Inscription seul ou avec un ami, enregistrée dans un Google Sheet.
 *
 * `VITE_INSCRIPTION_ENDPOINT` est l'URL de l'application Web Apps Script liée à la
 * feuille (scripts/google-sheet/inscriptions.gs) :
 * - GET  → `{ ok, restants, dossards }` : d'où le nombre d'inscrits ;
 * - POST → une ligne par coureur, `{ ok, restants, dossards }` ou `{ ok: false, error }`
 *   (`complet`, `deja-inscrit`, `invalide`).
 * La page fait aussi respecter SON nombre de dossards (`event.bibs`) : elle compte les
 * inscrits (plafond du script − restants) et ferme le formulaire une fois plein, même si
 * le script déployé compte sur un plafond plus haut (version sans `dossards` : 50).
 * Le corps part en `text/plain` (JSON dedans) : une requête « simple », sans pré-vol CORS,
 * qu'Apps Script accepte ; sa réponse est lisible depuis le site.
 */
import { event } from "../content/event";

const ENDPOINT = (import.meta.env.VITE_INSCRIPTION_ENDPOINT as string | undefined) || "";
/** Plafond du script déployé quand il ne le renvoie pas (version d'avant `dossards`). */
const LEGACY_SCRIPT_CAP = 50;

interface SheetReply {
  ok: boolean;
  restants?: number;
  /** Plafond de dossards du script ; absent des anciennes versions. */
  dossards?: number;
  error?: "complet" | "deja-inscrit" | "invalide";
}

const ERRORS: Record<NonNullable<SheetReply["error"]>, string> = {
  complet: "C'est complet : il ne reste pas assez de dossards.",
  "deja-inscrit": "Cette adresse e-mail est déjà inscrite.",
  invalide: "Vérifie les noms et les adresses e-mail.",
};

export function initInscription() {
  const form = document.querySelector<HTMLFormElement>("[data-inscription]");
  if (!form) return;
  const friend = form.querySelector<HTMLFieldSetElement>("[data-friend]")!;
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]")!;
  const status = form.querySelector<HTMLElement>("[data-status]")!;
  const restantsEl = form.querySelector<HTMLElement>("[data-restants]");
  let full = false;
  /** Dossards encore libres selon la page ; inconnu tant que la feuille n'a pas répondu. */
  let restants: number | null = null;

  const say = (text: string, tone: "info" | "error" = "info") => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const showRestants = (reply: SheetReply) => {
    if (typeof reply.restants !== "number") return;
    // inscrits = plafond du script − ses restants ; restants = dossards de la page − inscrits
    const inscrits = Math.max((reply.dossards ?? LEGACY_SCRIPT_CAP) - reply.restants, 0);
    const n = event.bibs === null ? reply.restants : Math.max(event.bibs - inscrits, 0);
    restants = n;
    if (restantsEl) restantsEl.textContent = n > 0 ? ` · ${n} restant${n > 1 ? "s" : ""}` : " · complet";
    full = n <= 0;
    if (full) {
      submit.disabled = true;
      say("C'est complet. Merci à tous !");
    }
  };

  const syncFormule = () => {
    const duo = (form.elements.namedItem("formule") as RadioNodeList).value === "duo";
    // fieldset désactivé : ses champs ne sont ni validés ni envoyés
    friend.hidden = !duo;
    friend.disabled = !duo;
    submit.textContent = duo ? "Envoyer nos inscriptions" : "Envoyer l'inscription";
  };
  form.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).name === "formule") syncFormule();
  });
  syncFormule();

  if (!ENDPOINT) {
    // Pas encore de feuille branchée : on le dit, sans faire semblant d'envoyer.
    submit.disabled = true;
    say("Les inscriptions ouvrent très bientôt.");
    return;
  }

  // Dossards restants (sans bloquer l'affichage si la feuille ne répond pas).
  fetch(ENDPOINT)
    .then((res) => res.json() as Promise<SheetReply>)
    .then((reply) => showRestants(reply))
    .catch(() => {});

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled || full) return;
    const data = new FormData(form);
    const duo = data.get("formule") === "duo";
    if (restants !== null && (duo ? 2 : 1) > restants) {
      say(restants === 1 ? "Il ne reste qu'un dossard : inscription seule uniquement." : ERRORS.complet, "error");
      return;
    }
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const payload = {
      formule: duo ? "duo" : "solo",
      nom: text("nom"),
      email: text("email"),
      ...(duo ? { ami_nom: text("ami_nom"), ami_email: text("ami_email") } : {}),
      edition: event.edition ?? event.name,
      _gotcha: text("_gotcha"),
    };

    submit.disabled = true;
    say("Envoi…");
    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reply = (await res.json()) as SheetReply;
      showRestants(reply);
      if (!reply.ok) {
        say(ERRORS[reply.error ?? "invalide"] ?? ERRORS.invalide, "error");
        return;
      }
      form.reset();
      syncFormule();
      say(duo ? "C'est noté pour vous deux. À très vite sur la boucle !" : "C'est noté. À très vite sur la boucle !");
    } catch (err) {
      console.error("[guerard] inscription", err);
      say("L'envoi a échoué. Vérifie ta connexion et réessaie.", "error");
    } finally {
      if (!full) submit.disabled = false;
    }
  });
}

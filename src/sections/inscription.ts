/**
 * Inscription seul ou avec un ami : envoi JSON vers `VITE_INSCRIPTION_ENDPOINT`
 * (point d'entrée compatible Formspree : POST JSON, `Accept: application/json`).
 * Rien n'est gardé dans la page ; l'organisation reçoit chaque inscription.
 */
import { event, tbc } from "../content/event";

const ENDPOINT = (import.meta.env.VITE_INSCRIPTION_ENDPOINT as string | undefined) || "";

export function initInscription() {
  const form = document.querySelector<HTMLFormElement>("[data-inscription]");
  if (!form) return;
  const friend = form.querySelector<HTMLFieldSetElement>("[data-friend]")!;
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]")!;
  const status = form.querySelector<HTMLElement>("[data-status]")!;

  const say = (text: string, tone: "info" | "error" = "info") => {
    status.textContent = text;
    status.dataset.tone = tone;
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
    // Pas d'adresse d'envoi configurée : on le dit, sans faire semblant d'envoyer.
    submit.disabled = true;
    say(tbc("adresse d'envoi des inscriptions"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ENDPOINT || submit.disabled) return;
    const data = new FormData(form);
    if (data.get("_gotcha")) return; // robot
    const duo = data.get("formule") === "duo";
    const edition = event.edition ?? event.name;
    const payload = {
      formule: duo ? "duo" : "solo",
      nom: String(data.get("nom") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      ...(duo
        ? { ami_nom: String(data.get("ami_nom") ?? "").trim(), ami_email: String(data.get("ami_email") ?? "").trim() }
        : {}),
      consentement: true,
      edition,
      _subject: `Inscription ${edition} — ${duo ? "duo" : "solo"}`,
      _replyto: String(data.get("email") ?? "").trim(),
    };

    submit.disabled = true;
    say("Envoi…");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      syncFormule();
      say(duo ? "C'est noté pour vous deux. L'organisation revient vers vous par mail." : "C'est noté. L'organisation revient vers toi par mail.");
    } catch (err) {
      console.error("[guerard] inscription", err);
      say("L'envoi a échoué. Vérifie ta connexion et réessaie.", "error");
    } finally {
      submit.disabled = false;
    }
  });
}

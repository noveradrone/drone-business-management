const { thermographyOpenAiKey, thermographyOpenAiModel } = require("../config");
const { clean } = require("../utils/pdfHelpers");

function tempDelta(max, min) {
  const a = Number(max);
  const b = Number(min);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

function prudenceByGravite(gravite) {
  const key = String(gravite || "").toLowerCase();
  if (key === "critique") return "Le niveau de vigilance est eleve et une verification rapide est recommandee.";
  if (key === "elevee") return "Un controle technique rapproche peut etre pertinent pour confirmer l'observation.";
  if (key === "moderee") return "Une verification complementaire est recommandee pour confirmer l'origine exacte.";
  return "L'observation thermique laisse supposer une anomalie a surveiller.";
}

function buildAnomalyInterpretation(inspection, anomaly) {
  const delta = Number.isFinite(Number(anomaly.ecart_thermique))
    ? Number(anomaly.ecart_thermique)
    : tempDelta(anomaly.temperature_max, anomaly.temperature_min);
  const deltaText = Number.isFinite(delta) ? `${delta.toFixed(1)}°C` : "non mesure";
  const type = clean(anomaly.type_anomalie, "anomalie thermique");
  const zone = clean(anomaly.zone, "zone non precisee");
  const gravite = clean(anomaly.gravite, "moderee");

  return [
    `L'observation thermique laisse supposer une zone atypique (${type}) localisee sur ${zone}.`,
    `L'ecart thermique observe (${deltaText}) peut indiquer un comportement thermique non uniforme.`,
    anomaly.description_terrain
      ? `Le contexte terrain mentionne (${anomaly.description_terrain}) semble renforcer cette hypothese.`
      : "Les donnees de terrain disponibles semblent reveler un contraste thermique localise.",
    anomaly.image_thermique_url || anomaly.image_visible_url
      ? "Les images jointes semblent reveler des variations localisees, a interpreter avec prudence."
      : "En l'absence d'analyse image detaillee, l'interpretation reste basee sur les mesures saisies.",
    prudenceByGravite(gravite)
  ].join(" ");
}

function buildAnomalyRecommendation(anomaly) {
  const gravite = clean(anomaly.gravite, "moderee");
  const base = anomaly.verification_recommandee
    ? clean(anomaly.verification_recommandee)
    : "Une verification complementaire sur site est recommandee.";

  const risk = clean(anomaly.risques_potentiels);
  const riskLine = risk
    ? `Compte tenu des risques potentiels mentionnes (${risk}), il peut etre pertinent de prioriser cette verification.`
    : "Un controle technique cible peut aider a confirmer l'origine de la signature thermique.";

  return `${base} ${riskLine} Niveau de gravite renseigne: ${gravite}.`;
}

function buildFallbackReport({ inspection, anomalies, client }) {
  const intro = [
    `Cette inspection thermographique a ete realisee pour ${clean(client?.company_name, "le client")} le ${clean(
      inspection.date_inspection,
      "date non renseignee"
    )}.`,
    `La mission, de type ${clean(inspection.type_inspection, "autre")}, avait pour objectif: ${clean(
      inspection.objectif_mission,
      "analyse visuelle et thermique des zones ciblees"
    )}.`,
    "Les observations presentes dans ce rapport peuvent indiquer des zones d'ecart thermique et necessitent, selon les cas, une verification complementaire."
  ].join(" ");

  const methodology = [
    `L'inspection a ete conduite avec le drone ${clean(inspection.drone_utilise, "non renseigne")} et la camera thermique ${clean(
      inspection.camera_thermique,
      "non renseignee"
    )}.`,
    `Conditions d'intervention: temperature ambiante ${clean(
      inspection.temperature_ambiante,
      "non renseignee"
    )}°C, meteo ${clean(inspection.meteo, "non renseignee")}, vent ${clean(inspection.vent, "non renseigne")}.`,
    "Les images thermiques et visibles sont interpretees avec prudence: elles semblent reveler des tendances, sans constituer un diagnostic certain."
  ].join(" ");

  const interpreted = anomalies.map((anomaly) => ({
    id: anomaly.id,
    interpretation_ai: buildAnomalyInterpretation(inspection, anomaly),
    recommandation_ai: buildAnomalyRecommendation(anomaly)
  }));

  const criticalCount = anomalies.filter((a) => String(a.gravite || "").toLowerCase() === "critique").length;
  const highCount = anomalies.filter((a) => String(a.gravite || "").toLowerCase() === "elevee").length;

  const conclusion = [
    `L'inspection a permis d'identifier ${anomalies.length} observation(s) thermique(s).`,
    criticalCount > 0
      ? `${criticalCount} zone(s) critique(s) ont ete relevees et semblent necessiter un suivi prioritaire.`
      : "Aucune zone critique n'a ete clairement identifiee sur la base des donnees saisies.",
    highCount > 0
      ? `${highCount} zone(s) de gravite elevee peuvent indiquer un besoin de verification technique rapide.`
      : "Les anomalies restantes paraissent de gravite faible a moderee, sous reserve de controle terrain.",
    "Cette synthese reste informative: une verification complementaire est recommandee avant toute decision technique."
  ].join(" ");

  const recommandationsGlobales = [
    "Planifier une verification ciblee des zones presentant les plus forts ecarts thermiques.",
    "Comparer les observations thermiques avec un controle visuel et, si necessaire, des mesures instrumentees sur site.",
    "Documenter l'evolution des zones a surveiller lors d'une inspection de suivi.",
    "Adapter la priorisation des interventions selon la criticite, l'usage du site et les contraintes de securite."
  ].join(" ");

  return {
    introduction_ai: intro,
    methodologie_ai: methodology,
    conclusion_ai: conclusion,
    recommandations_globales_ai: recommandationsGlobales,
    anomalies: interpreted
  };
}

async function generateWithOpenAI(payload) {
  const prompt = `
Tu rediges un rapport thermographique professionnel en francais uniquement.
Reste prudent. N'utilise jamais de certitude diagnostique.
Utilise des formulations: "peut indiquer", "semble reveler", "verification complementaire recommandee".

Contexte inspection:
${JSON.stringify(payload.inspection)}

Anomalies:
${JSON.stringify(payload.anomalies)}

Renvoie un JSON strict:
{
  "introduction_ai": "...",
  "methodologie_ai": "...",
  "conclusion_ai": "...",
  "recommandations_globales_ai": "...",
  "anomalies": [
    { "id": 1, "interpretation_ai": "...", "recommandation_ai": "..." }
  ]
}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${thermographyOpenAiKey}`
    },
    body: JSON.stringify({
      model: thermographyOpenAiModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status})`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response vide.");
  return JSON.parse(content);
}

async function generateThermographyReport(payload) {
  const fallback = buildFallbackReport(payload);
  if (!thermographyOpenAiKey) return fallback;
  try {
    const ai = await generateWithOpenAI(payload);
    return {
      introduction_ai: clean(ai.introduction_ai, fallback.introduction_ai),
      methodologie_ai: clean(ai.methodologie_ai, fallback.methodologie_ai),
      conclusion_ai: clean(ai.conclusion_ai, fallback.conclusion_ai),
      recommandations_globales_ai: clean(ai.recommandations_globales_ai, fallback.recommandations_globales_ai),
      anomalies: Array.isArray(ai.anomalies) && ai.anomalies.length ? ai.anomalies : fallback.anomalies
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  generateThermographyReport
};

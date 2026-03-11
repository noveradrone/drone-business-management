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
  if (key === "critique") return "Niveau de vigilance: eleve. Verification prioritaire recommandee.";
  if (key === "elevee") return "Niveau de vigilance: soutenu. Controle technique rapproche recommande.";
  if (key === "moderee") return "Niveau de vigilance: modere. Verification complementaire recommandee.";
  return "Niveau de vigilance: a surveiller. Observation a recontroler selon le contexte.";
}

function imageAvailability(anomaly) {
  if (anomaly.image_thermique_url && anomaly.image_visible_url) {
    return "Les images thermique et visible sont disponibles pour l'analyse.";
  }
  if (anomaly.image_thermique_url) {
    return "Seule l'image thermique est disponible: l'analyse visuelle reste partielle.";
  }
  if (anomaly.image_visible_url) {
    return "Seule l'image visible est disponible: l'analyse thermique reste limitee.";
  }
  return "Aucune image exploitable n'est jointe: interpretation fondee sur les informations saisies.";
}

function structuredInterpretationParts(inspection, anomaly) {
  const delta = Number.isFinite(Number(anomaly.ecart_thermique))
    ? Number(anomaly.ecart_thermique)
    : tempDelta(anomaly.temperature_max, anomaly.temperature_min);
  const deltaText = Number.isFinite(delta) ? `${delta.toFixed(1)} degC` : "non mesure";
  const type = clean(anomaly.type_anomalie, "anomalie thermique");
  const zone = clean(anomaly.zone, "zone non precisee");
  const gravite = clean(anomaly.gravite, "moderee");

  const observation = [
    `La zone "${zone}" presente une signature associee a ${type}.`,
    imageAvailability(anomaly)
  ].join(" ");

  const interpretation = [
    `L'image thermique met en evidence un ecart de ${deltaText}.`,
    "Cette repartition de temperature peut etre compatible avec une non-uniformite locale.",
    "Sous reserve des conditions d'acquisition, cette anomalie peut suggerer un comportement thermique atypique."
  ].join(" ");

  const hypotheses = anomaly.causes_probables
    ? `Hypotheses issues du terrain: ${clean(anomaly.causes_probables)}.`
    : "Hypotheses possibles: pont thermique localise, materiau humide, defaut d'assemblage ou source de chaleur parasite.";

  const vigilance = `${prudenceByGravite(gravite)} Gravite declaree: ${gravite}.`;

  const recommendation = [
    clean(
      anomaly.verification_recommandee,
      "Une verification complementaire par un professionnel qualifie est recommandee."
    ),
    anomaly.risques_potentiels
      ? `Points de vigilance complementaires: ${clean(anomaly.risques_potentiels)}.`
      : "Un controle terrain cible est recommande pour confirmer l'origine de l'ecart thermique observe."
  ].join(" ");

  return { observation, interpretation, hypotheses, vigilance, recommendation };
}

function buildStructuredInterpretation(inspection, anomaly) {
  const parts = structuredInterpretationParts(inspection, anomaly);
  return [
    `Observation visuelle: ${parts.observation}`,
    `Interpretation thermique: ${parts.interpretation}`,
    `Hypotheses possibles: ${parts.hypotheses}`,
    `Niveau de vigilance: ${parts.vigilance}`
  ].join("\n");
}

function buildAnomalyRecommendation(inspection, anomaly) {
  return structuredInterpretationParts(inspection, anomaly).recommendation;
}

function buildFallbackReport({ inspection, anomalies, client }) {
  const intro = [
    `Cette inspection thermographique a ete realisee pour ${clean(client?.company_name, "le client")} le ${clean(
      inspection.date_inspection,
      "date non renseignee"
    )}.`,
    `La mission de type ${clean(inspection.type_inspection, "autre")} vise ${clean(
      inspection.objectif_mission,
      "l'identification d'ecarts thermiques potentiels"
    )}.`,
    "Le rapport est redige pour rester exploitable par un particulier, un thermicien et un bureau d'etude.",
    "Les observations peuvent indiquer des tendances thermiques mais ne constituent pas un diagnostic certain."
  ].join(" ");

  const methodology = [
    `Inspection realisee avec le drone ${clean(inspection.drone_utilise, "non renseigne")} et la camera ${clean(
      inspection.camera_thermique,
      "non renseignee"
    )}.`,
    `Conditions d'acquisition: temperature ambiante ${clean(
      inspection.temperature_ambiante,
      "non renseignee"
    )} degC, meteo ${clean(inspection.meteo, "non renseignee")}, vent ${clean(inspection.vent, "non renseigne")}.`,
    "L'interpretation reste dependante des conditions de prise de vue, de l'emissivite des surfaces et du contexte d'exploitation."
  ].join(" ");

  const interpreted = anomalies.map((anomaly) => ({
    id: anomaly.id,
    interpretation_ai: buildStructuredInterpretation(inspection, anomaly),
    recommandation_ai: buildAnomalyRecommendation(inspection, anomaly)
  }));

  const criticalCount = anomalies.filter((a) => String(a.gravite || "").toLowerCase() === "critique").length;
  const highCount = anomalies.filter((a) => String(a.gravite || "").toLowerCase() === "elevee").length;

  const conclusion = [
    `L'inspection a permis d'identifier ${anomalies.length} observation(s) thermique(s).`,
    criticalCount > 0
      ? `${criticalCount} zone(s) critique(s) semblent necessiter une action prioritaire.`
      : "Aucune zone critique n'a ete identifiee selon les donnees disponibles.",
    highCount > 0
      ? `${highCount} zone(s) de gravite elevee meritent un controle technique rapproche.`
      : "Les autres zones relevent plutot d'une surveillance ou d'un controle cible.",
    "Selon les bonnes pratiques d'inspection thermographique, un recoupement par controle terrain peut etre necessaire."
  ].join(" ");

  const recommandationsGlobales = [
    "Prioriser les zones avec les ecarts thermiques les plus marques.",
    "Completer l'analyse par un controle visuel de proximite et, si necessaire, des mesures instrumentees.",
    "Documenter l'evolution des zones sensibles lors d'un passage de suivi.",
    "Conserver une approche prudente: les images thermiques doivent etre interpretees dans leur contexte d'acquisition."
  ].join(" ");

  return {
    introduction_ai: intro,
    methodologie_ai: methodology,
    conclusion_ai: conclusion,
    recommandations_globales_ai: recommandationsGlobales,
    anomalies: interpreted
  };
}

function buildPromptPayload(payload) {
  return {
    inspection: {
      type_inspection: payload.inspection?.type_inspection,
      date_inspection: payload.inspection?.date_inspection,
      objectif_mission: payload.inspection?.objectif_mission,
      drone_utilise: payload.inspection?.drone_utilise,
      camera_thermique: payload.inspection?.camera_thermique,
      temperature_ambiante: payload.inspection?.temperature_ambiante,
      meteo: payload.inspection?.meteo,
      vent: payload.inspection?.vent,
      observations_generales: payload.inspection?.observations_generales
    },
    client: {
      company_name: payload.client?.company_name,
      contact_name: payload.client?.contact_name
    },
    anomalies: (payload.anomalies || []).map((a) => ({
      id: a.id,
      titre: a.titre,
      zone: a.zone,
      type_anomalie: a.type_anomalie,
      gravite: a.gravite,
      temperature_max: a.temperature_max,
      temperature_min: a.temperature_min,
      ecart_thermique: a.ecart_thermique,
      description_terrain: a.description_terrain,
      causes_probables: a.causes_probables,
      risques_potentiels: a.risques_potentiels,
      verification_recommandee: a.verification_recommandee,
      image_thermique_url: a.image_thermique_url,
      image_visible_url: a.image_visible_url
    }))
  };
}

function formatAnomalyFromAi(aiItem, fallbackItem) {
  const observation = clean(aiItem?.observation_visuelle);
  const interpretation = clean(aiItem?.interpretation_thermique);
  const hypotheses = clean(aiItem?.hypotheses_possibles);
  const vigilance = clean(aiItem?.niveau_vigilance);
  const recommendation = clean(aiItem?.recommandation, fallbackItem?.recommandation_ai);

  const interpretationLines = [
    observation ? `Observation visuelle: ${observation}` : "",
    interpretation ? `Interpretation thermique: ${interpretation}` : "",
    hypotheses ? `Hypotheses possibles: ${hypotheses}` : "",
    vigilance ? `Niveau de vigilance: ${vigilance}` : ""
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return {
    interpretation_ai: clean(interpretationLines, fallbackItem?.interpretation_ai),
    recommandation_ai: clean(recommendation, fallbackItem?.recommandation_ai)
  };
}

async function generateWithOpenAI(payload) {
  const compactPayload = buildPromptPayload(payload);

  const prompt = `
Tu rediges un rapport thermographique professionnel en francais uniquement.
Public cible: particulier, thermicien, bureau d'etude.

Contraintes obligatoires:
- Rester prudent, jamais de diagnostic certain.
- Utiliser des formulations du type: "peut indiquer", "semble reveler", "sous reserve des conditions de prise de vue".
- Prioriser l'analyse des images (thermique + visible) quand elles sont disponibles.
- Si une image est absente ou peu exploitable, le dire explicitement et completer avec les donnees mesurees/saisies.
- Donner un texte utile, concret, pas generique.

Donnees d'entree:
${JSON.stringify(compactPayload)}

Pour CHAQUE anomalie, fournir:
1) observation_visuelle
2) interpretation_thermique
3) hypotheses_possibles
4) niveau_vigilance
5) recommandation

Renvoie uniquement un JSON strict, sans markdown:
{
  "introduction_ai": "...",
  "methodologie_ai": "...",
  "conclusion_ai": "...",
  "recommandations_globales_ai": "...",
  "anomalies": [
    {
      "id": 1,
      "observation_visuelle": "...",
      "interpretation_thermique": "...",
      "hypotheses_possibles": "...",
      "niveau_vigilance": "...",
      "recommandation": "..."
    }
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
      temperature: 0.25,
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
    const aiAnomaliesById = new Map(
      (Array.isArray(ai?.anomalies) ? ai.anomalies : [])
        .map((item) => [Number(item?.id), item])
        .filter(([id]) => Number.isFinite(id))
    );

    const anomalies = fallback.anomalies.map((fallbackItem) => {
      const target = aiAnomaliesById.get(Number(fallbackItem.id));
      return {
        id: fallbackItem.id,
        ...formatAnomalyFromAi(target, fallbackItem)
      };
    });

    return {
      introduction_ai: clean(ai.introduction_ai, fallback.introduction_ai),
      methodologie_ai: clean(ai.methodologie_ai, fallback.methodologie_ai),
      conclusion_ai: clean(ai.conclusion_ai, fallback.conclusion_ai),
      recommandations_globales_ai: clean(ai.recommandations_globales_ai, fallback.recommandations_globales_ai),
      anomalies
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  generateThermographyReport
};

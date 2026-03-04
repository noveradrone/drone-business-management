const { clean, buildLines } = require("../utils/pdfHelpers");

const STATUS_VALUES = new Set(["todo", "in_progress", "done"]);
const OPEN_SUBCATEGORIES = new Set(["A1", "A2", "A3"]);
const SPECIFIC_TYPES = new Set(["STS-01", "STS-02", "PDRA", "SORA", "OTHER"]);
const PDRA_TYPES = new Set(["PDRA-S01", "PDRA-S02"]);
const CATEGORY_TYPES = new Set(["open", "specific", "certified"]);

const LINKS = {
  flyby: "https://app.flyby.aero/login",
  alphaTango: "https://alphatango.aviation-civile.gouv.fr",
  sia: "https://www.sia.aviation-civile.gouv.fr",
  geoportail: "https://www.geoportail.gouv.fr",
  notam: "https://www.sia.aviation-civile.gouv.fr/schedules",
  regulation: "https://www.easa.europa.eu"
};

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const raw = String(value).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "oui" || raw === "on";
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanStatus(value, fallback = "todo") {
  return STATUS_VALUES.has(value) ? value : fallback;
}

function defaultPreparation(mission = {}) {
  return {
    category_type: "open",
    open_subcategory: "A3",
    specific_type: null,
    pdra_type: null,
    sora_required: 0,
    sts_declaration_required: 0,
    operational_authorization_required: 0,
    validation_manuel: 0,
    location_address: mission.location || "",
    location_lat: null,
    location_lng: null,
    operation_date: mission.mission_date || new Date().toISOString().slice(0, 10),
    start_time: "",
    end_time: "",
    altitude_max_m: 120,
    distance_to_people_m: null,
    over_assemblies: 0,
    in_urban_area: 0,
    night_operation: 0,
    near_airport_or_ctr: 0,
    near_airport_details: "",
    restricted_zone: 0,
    restricted_zone_details: "",
    aircraft_class: "",
    mtom_kg: null,
    remote_id: 0,
    observers_needed: 0,
    flyby_status: "todo",
    alphatango_status: "todo",
    municipality_status: "todo",
    landowner_status: "todo",
    military_status: "todo",
    doc_pack_zip_url: null,
    risk_assessment_pdf_url: null,
    ops_manual_extract_pdf_url: null,
    sts_declaration_pdf_url: null,
    sora_pack_pdf_url: null
  };
}

function normalizePreparationPayload(payload = {}, existing = {}) {
  const base = { ...defaultPreparation(), ...(existing || {}) };
  const merged = { ...base, ...(payload || {}) };
  const category_type = CATEGORY_TYPES.has(merged.category_type) ? merged.category_type : base.category_type;
  const open_subcategory = OPEN_SUBCATEGORIES.has(merged.open_subcategory) ? merged.open_subcategory : null;
  const specific_type = SPECIFIC_TYPES.has(merged.specific_type) ? merged.specific_type : null;
  const pdra_type = PDRA_TYPES.has(merged.pdra_type) ? merged.pdra_type : null;

  return {
    category_type,
    open_subcategory: category_type === "open" ? open_subcategory || "A3" : null,
    specific_type: category_type === "specific" ? specific_type || "STS-01" : null,
    pdra_type: category_type === "specific" && specific_type === "PDRA" ? pdra_type : null,
    sora_required: toBool(merged.sora_required) ? 1 : 0,
    sts_declaration_required: toBool(merged.sts_declaration_required) ? 1 : 0,
    operational_authorization_required: toBool(merged.operational_authorization_required) ? 1 : 0,
    validation_manuel: toBool(merged.validation_manuel) ? 1 : 0,
    location_address: clean(merged.location_address),
    location_lat: toNumber(merged.location_lat, null),
    location_lng: toNumber(merged.location_lng, null),
    operation_date: clean(merged.operation_date),
    start_time: clean(merged.start_time),
    end_time: clean(merged.end_time),
    altitude_max_m: toNumber(merged.altitude_max_m, null),
    distance_to_people_m: toNumber(merged.distance_to_people_m, null),
    over_assemblies: toBool(merged.over_assemblies) ? 1 : 0,
    in_urban_area: toBool(merged.in_urban_area) ? 1 : 0,
    night_operation: toBool(merged.night_operation) ? 1 : 0,
    near_airport_or_ctr: toBool(merged.near_airport_or_ctr) ? 1 : 0,
    near_airport_details: clean(merged.near_airport_details),
    restricted_zone: toBool(merged.restricted_zone) ? 1 : 0,
    restricted_zone_details: clean(merged.restricted_zone_details),
    aircraft_class: clean(merged.aircraft_class),
    mtom_kg: toNumber(merged.mtom_kg, null),
    remote_id: toBool(merged.remote_id) ? 1 : 0,
    observers_needed: toBool(merged.observers_needed) ? 1 : 0,
    flyby_status: cleanStatus(merged.flyby_status, "todo"),
    alphatango_status: cleanStatus(merged.alphatango_status, "todo"),
    municipality_status: cleanStatus(merged.municipality_status, "todo"),
    landowner_status: cleanStatus(merged.landowner_status, "todo"),
    military_status: cleanStatus(merged.military_status, "todo"),
    doc_pack_zip_url: clean(merged.doc_pack_zip_url) || null,
    risk_assessment_pdf_url: clean(merged.risk_assessment_pdf_url) || null,
    ops_manual_extract_pdf_url: clean(merged.ops_manual_extract_pdf_url) || null,
    sts_declaration_pdf_url: clean(merged.sts_declaration_pdf_url) || null,
    sora_pack_pdf_url: clean(merged.sora_pack_pdf_url) || null
  };
}

function suggestCategory(prep = {}) {
  const altitude = toNumber(prep.altitude_max_m, 120) || 120;
  const closePeople = toNumber(prep.distance_to_people_m, null);
  const aircraftClass = String(prep.aircraft_class || "").toUpperCase();
  const highRisk =
    toBool(prep.over_assemblies) ||
    toBool(prep.near_airport_or_ctr) ||
    toBool(prep.restricted_zone) ||
    toBool(prep.night_operation) ||
    altitude > 120;

  if (highRisk) {
    const specific_type =
      toBool(prep.in_urban_area) || (closePeople !== null && closePeople < 30) ? "STS-01" : "STS-02";
    return {
      category_type: "specific",
      open_subcategory: null,
      specific_type,
      pdra_type: null
    };
  }

  if (aircraftClass === "C2" && closePeople !== null && closePeople < 30) {
    return {
      category_type: "open",
      open_subcategory: "A2",
      specific_type: null,
      pdra_type: null
    };
  }

  if (aircraftClass === "C0" || aircraftClass === "C1") {
    return {
      category_type: "open",
      open_subcategory: closePeople !== null && closePeople < 20 ? "A1" : "A3",
      specific_type: null,
      pdra_type: null
    };
  }

  return {
    category_type: "open",
    open_subcategory: "A3",
    specific_type: null,
    pdra_type: null
  };
}

function buildObligations(prep = {}, suggested = {}) {
  const obligations = [];
  const mode = prep.category_type || suggested.category_type;
  const specificType = prep.specific_type || suggested.specific_type;
  const openSub = prep.open_subcategory || suggested.open_subcategory;

  if (mode === "open") {
    obligations.push({
      level: "requis",
      text: `Verifier la sous-categorie OUVERTE (${openSub || "A3"}) et les limites operationnelles.`
    });
    obligations.push({
      level: "a_verifier",
      text: "Verifier enregistrement exploitant et attestations pilote selon sous-categorie."
    });
  } else if (mode === "specific") {
    obligations.push({
      level: "requis",
      text: `Scenario SPECIFIQUE ${specificType || "STS/PDRA/SORA"} a confirmer avant vol.`
    });
    obligations.push({
      level: "requis",
      text: "Documenter mitigations et volume operationnel."
    });
    if (specificType === "PDRA" || specificType === "SORA" || toBool(prep.sora_required)) {
      obligations.push({
        level: "requis",
        text: "Autorisation operationnelle potentiellement requise (a confirmer manuellement)."
      });
    }
  } else if (mode === "certified") {
    obligations.push({
      level: "a_verifier",
      text: "Categorie certifiee: exigences complementaires a valider avec autorite competente."
    });
  }

  if (toBool(prep.near_airport_or_ctr) || toBool(prep.restricted_zone)) {
    obligations.push({
      level: "requis",
      text: "Coordination espace aerien (CTR/zones reglementees) avant mission."
    });
  } else {
    obligations.push({
      level: "recommande",
      text: "Controle cartographie aeronautique (SIA/Geoportail) avant mission."
    });
  }
  return obligations;
}

const CHECKLIST_TEMPLATES = {
  OPEN: {
    title: "Checklist OPEN (A1/A2/A3)",
    steps: [
      {
        id: "open-step-1",
        title: "1. Cadre operationnel",
        items: [
          {
            id: "operator-registration",
            label: "Verifier l'enregistrement exploitant et n° operateur",
            helpText: "Selon profil exploitant et activite.",
            links: [LINKS.alphaTango],
            required: true
          },
          {
            id: "pilot-training",
            label: "Verifier formation/attestation du pilote (A2 si necessaire)",
            helpText: "Conserver justificatif a disposition.",
            links: [LINKS.alphaTango],
            required: true
          }
        ]
      },
      {
        id: "open-step-2",
        title: "2. Zone et trajectoire",
        items: [
          {
            id: "airspace-check",
            label: "Verifier CTR/zonage drone et contraintes locales",
            helpText: "SIA + Geoportail + check FlyBy.",
            links: [LINKS.sia, LINKS.geoportail, LINKS.flyby],
            required: true
          },
          {
            id: "distance-people",
            label: "Confirmer distance aux personnes conforme sous-categorie",
            helpText: "A1/A2/A3 a verifier selon drone et contexte.",
            links: [LINKS.regulation],
            required: true
          }
        ]
      },
      {
        id: "open-step-3",
        title: "3. Preparation pre-vol",
        items: [
          {
            id: "mission-brief",
            label: "Brief securite equipe/client",
            helpText: "Perimetre, points de replis, consignes public.",
            links: [],
            required: true
          },
          {
            id: "meteo-batterie",
            label: "Controle meteo, batteries, firmware, failsafe",
            helpText: "Inclure NOTAM si pertinent.",
            links: [LINKS.notam],
            required: true
          }
        ]
      }
    ]
  },
  "STS-01": {
    title: "Checklist SPECIFIQUE STS-01",
    steps: [
      {
        id: "sts01-step-1",
        title: "1. Eligibility STS-01",
        items: [
          {
            id: "sts01-prerequisites",
            label: "Confirmer prerequis STS-01 et limites scenario",
            helpText: "Si doute: marquer 'a verifier' et valider manuellement.",
            links: [LINKS.regulation],
            required: true
          },
          {
            id: "sts01-zone",
            label: "Verifier volume operationnel et environnement urbain",
            helpText: "Inclure zones sensibles et perimetres de securite.",
            links: [LINKS.sia, LINKS.geoportail],
            required: true
          }
        ]
      },
      {
        id: "sts01-step-2",
        title: "2. Demarches administratives",
        items: [
          {
            id: "sts01-declaration",
            label: "Declaration STS prete et envoyee si applicable",
            helpText: "Conserver accusé/recepisse.",
            links: [LINKS.alphaTango],
            required: true
          },
          {
            id: "sts01-authorities",
            label: "Coordination mairie/proprietaire/autorites selon site",
            helpText: "Tracer les autorisations recues.",
            links: [LINKS.geoportail],
            required: false
          }
        ]
      },
      {
        id: "sts01-step-3",
        title: "3. Operation et securite",
        items: [
          {
            id: "sts01-team-brief",
            label: "Brief equipe + observateur (si requis)",
            helpText: "Roles, zones d'exclusion, plan d'urgence.",
            links: [],
            required: true
          },
          {
            id: "sts01-emergency",
            label: "Plan urgence / lost-link valide",
            helpText: "Procedure claire et testee.",
            links: [],
            required: true
          }
        ]
      }
    ]
  },
  "STS-02": {
    title: "Checklist SPECIFIQUE STS-02",
    steps: [
      {
        id: "sts02-step-1",
        title: "1. Eligibility STS-02",
        items: [
          {
            id: "sts02-prerequisites",
            label: "Confirmer prerequis STS-02 et limites scenario",
            helpText: "Verifier adequation mission/scenario.",
            links: [LINKS.regulation],
            required: true
          },
          {
            id: "sts02-zone",
            label: "Verifier environnement operationnel non controle",
            helpText: "Analyser obstacles et volume operationnel.",
            links: [LINKS.sia, LINKS.geoportail],
            required: true
          }
        ]
      },
      {
        id: "sts02-step-2",
        title: "2. Demarches et conformite",
        items: [
          {
            id: "sts02-declaration",
            label: "Declaration STS traçable + accusé si applicable",
            helpText: "Dossier a archiver dans mission.",
            links: [LINKS.alphaTango],
            required: true
          },
          {
            id: "sts02-mitigations",
            label: "Mesures de mitigation documentees",
            helpText: "Inclure contraintes geographiques et public.",
            links: [LINKS.regulation],
            required: true
          }
        ]
      },
      {
        id: "sts02-step-3",
        title: "3. Execution",
        items: [
          {
            id: "sts02-brief",
            label: "Brief equipe et check pre-vol complet",
            helpText: "Batteries, liaisons, RTH, NOTAM si necessaire.",
            links: [LINKS.notam],
            required: true
          },
          {
            id: "sts02-contingency",
            label: "Plan de contingence / interruption de mission",
            helpText: "Declencheurs et roles definis.",
            links: [],
            required: true
          }
        ]
      }
    ]
  }
};

function getChecklistTemplateType(prep = {}, suggestion = {}) {
  const category = prep.category_type || suggestion.category_type;
  const specificType = prep.specific_type || suggestion.specific_type;
  if (category === "specific" && (specificType === "STS-01" || specificType === "STS-02")) return specificType;
  return "OPEN";
}

function flattenChecklistTemplate(templateType, template) {
  const rows = [];
  let sort = 1;
  (template.steps || []).forEach((step, stepIndex) => {
    (step.items || []).forEach((item, itemIndex) => {
      rows.push({
        template_type: templateType,
        step_key: step.id,
        step_title: step.title,
        step_order: stepIndex + 1,
        item_order: itemIndex + 1,
        item_key: `${step.id}:${item.id}`,
        label: item.label,
        description: item.helpText || "",
        obligatoire: item.required ? 1 : 0,
        link_url: (item.links || [])[0] || "",
        links_json: JSON.stringify(item.links || []),
        sort_order: sort++,
        state: "todo"
      });
    });
  });
  return rows;
}

function checklistTemplate(prep = {}, suggestion = {}) {
  const type = getChecklistTemplateType(prep, suggestion);
  const template = CHECKLIST_TEMPLATES[type] || CHECKLIST_TEMPLATES.OPEN;
  return flattenChecklistTemplate(type, template);
}

function buildRecommendation(prep = {}) {
  const suggested = suggestCategory(prep);
  const obligations = buildObligations(prep, suggested);
  return {
    suggested_category: suggested.category_type,
    suggested_open_subcategory: suggested.open_subcategory,
    suggested_specific_type: suggested.specific_type,
    suggested_pdra_type: suggested.pdra_type,
    obligations,
    notes: [
      "Assistant indicatif: verifier manuellement la reglementation applicable avant validation finale.",
      "Aucune connexion automatique FlyBy/AlphaTango n'est effectuee."
    ]
  };
}

function mergeChecklistState(templateItems, existingItems = []) {
  const stateByKey = new Map(existingItems.map((item) => [item.item_key, item.state]));
  return templateItems.map((item) => ({
    ...item,
    state: stateByKey.get(item.item_key) === "done" ? "done" : "todo"
  }));
}

function groupChecklistBySteps(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const stepKey = item.step_key || "default";
    if (!grouped.has(stepKey)) {
      grouped.set(stepKey, {
        step_key: stepKey,
        step_title: item.step_title || "Checklist",
        step_order: Number(item.step_order || 1),
        items: []
      });
    }
    grouped.get(stepKey).items.push({
      ...item,
      links: (() => {
        try {
          const parsed = item.links_json ? JSON.parse(item.links_json) : null;
          if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch {
          // noop
        }
        return item.link_url ? [item.link_url] : [];
      })()
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      ...step,
      items: step.items.sort((a, b) => {
        const s = Number(a.step_order || 1) - Number(b.step_order || 1);
        if (s !== 0) return s;
        const o = Number(a.item_order || 0) - Number(b.item_order || 0);
        if (o !== 0) return o;
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      })
    }));
}

function buildMissionCopySummary(mission = {}, prep = {}, recommendation = {}) {
  const categoryLabel =
    prep.category_type === "open"
      ? `Ouverte ${prep.open_subcategory || recommendation.suggested_open_subcategory || ""}`.trim()
      : prep.category_type === "specific"
        ? `Specifique ${prep.specific_type || recommendation.suggested_specific_type || ""}`.trim()
        : "Certifiee";

  const lines = buildLines([
    `Mission #${mission.id || "-"}`,
    mission.company_name ? `Client: ${mission.company_name}` : "",
    prep.location_address ? `Lieu: ${prep.location_address}` : mission.location ? `Lieu: ${mission.location}` : "",
    prep.operation_date ? `Date: ${prep.operation_date}` : mission.mission_date ? `Date: ${mission.mission_date}` : "",
    buildLines([prep.start_time ? `Debut: ${prep.start_time}` : "", prep.end_time ? `Fin: ${prep.end_time}` : ""]).join(" | "),
    prep.altitude_max_m !== null && prep.altitude_max_m !== undefined ? `Altitude max: ${prep.altitude_max_m} m` : "",
    `Categorie: ${categoryLabel || "A verifier"}`,
    prep.near_airport_or_ctr ? `CTR/Aeroport: Oui (${clean(prep.near_airport_details) || "details a verifier"})` : "CTR/Aeroport: Non",
    prep.restricted_zone ? `Zone restreinte: Oui (${clean(prep.restricted_zone_details) || "details a verifier"})` : "Zone restreinte: Non"
  ]);
  return lines.join("\n");
}

module.exports = {
  LINKS,
  defaultPreparation,
  normalizePreparationPayload,
  buildRecommendation,
  checklistTemplate,
  mergeChecklistState,
  buildMissionCopySummary,
  groupChecklistBySteps,
  getChecklistTemplateType
};

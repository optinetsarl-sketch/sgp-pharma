/**
 * Configuration Officielle du Réseau des PRA (Pharmacies Régionales d'Approvisionnement) CAMEG Togo
 * et Répartiteurs Pharmaceutiques Régionaux.
 */

export const TOGO_REGIONS = [
  { id: "savanes", name: "Région des Savanes", defaultPraId: "cameg-pra-dapaong", cities: ["Dapaong", "Mango", "Cinkassé", "Tandjouaré", "Mandouri", "Kpendjal"] },
  { id: "kara", name: "Région de la Kara", defaultPraId: "cameg-pra-kara", cities: ["Kara", "Bafilo", "Niamtougou", "Bassir", "Kanté", "Guérin-Kouka", "Kozah", "Pagouda"] },
  { id: "centrale", name: "Région Centrale", defaultPraId: "cameg-pra-sokode", cities: ["Sokodé", "Tchamba", "Sotouboua", "Blitta", "Mô"] },
  { id: "plateaux-est", name: "Région des Plateaux (Est)", defaultPraId: "cameg-pra-atakpame", cities: ["Atakpamé", "Anié", "Notsé", "Amlamé", "Elavagnon"] },
  { id: "plateaux-ouest", name: "Région des Plateaux (Ouest)", defaultPraId: "cameg-pra-kpalime", cities: ["Kpalimé", "Kloto", "Agou", "Kévé", "Danyi", "Kougnohou"] },
  { id: "maritime", name: "Région Maritime", defaultPraId: "cameg-pra-tsevie", cities: ["Tsévié", "Tabligbo", "Vogan", "Aného", "Afagnan", "Kévé"] },
  { id: "lome", name: "Grand Lomé / Lomé Commune", defaultPraId: "cameg-lome-centrale", cities: ["Lomé", "Agoè", "Bè", "Adidogomé", "Baguida", "Aflao", "Hedzranawoé"] },
];

export const CAMEG_PRA_LIST = [
  {
    id: "cameg-lome-centrale",
    code: "PRA-LOM-01",
    name: "CAMEG Togo - Siège Central & PRA Lomé Commune",
    shortName: "PRA Lomé Commune (Siège Centrale)",
    region: "Grand Lomé / Maritime",
    city: "Lomé",
    address: "Quartier Bé, Bd du Mono, Lomé",
    telephone: "+228 22 21 80 00 / 22 21 80 01",
    email: "pra.lome@cameg.tg",
  },
  {
    id: "cameg-pra-tsevie",
    code: "PRA-MAR-02",
    name: "CAMEG Togo - PRA Tsévié (Région Maritime)",
    shortName: "PRA Tsévié (Maritime)",
    region: "Région Maritime",
    city: "Tsévié",
    address: "En face du CHR Tsévié",
    telephone: "+228 23 30 42 10",
    email: "pra.tsevie@cameg.tg",
  },
  {
    id: "cameg-pra-atakpame",
    code: "PRA-PLA-03",
    name: "CAMEG Togo - PRA Atakpamé (Plateaux Est)",
    shortName: "PRA Atakpamé (Plateaux)",
    region: "Région des Plateaux",
    city: "Atakpamé",
    address: "Zone Hospitalière, Atakpamé",
    telephone: "+228 24 45 01 25",
    email: "pra.atakpame@cameg.tg",
  },
  {
    id: "cameg-pra-kpalime",
    code: "PRA-PLA-04",
    name: "CAMEG Togo - PRA Kpalimé (Plateaux Ouest)",
    shortName: "PRA Kpalimé (Kloto)",
    region: "Région des Plateaux",
    city: "Kpalimé",
    address: "Quartier Kpeta, Kpalimé",
    telephone: "+228 24 41 04 50",
    email: "pra.kpalime@cameg.tg",
  },
  {
    id: "cameg-pra-sokode",
    code: "PRA-CEN-05",
    name: "CAMEG Togo - PRA Sokodé (Région Centrale)",
    shortName: "PRA Sokodé (Centrale)",
    region: "Région Centrale",
    city: "Sokodé",
    address: "Près du CHR Sokodé",
    telephone: "+228 25 50 03 80",
    email: "pra.sokode@cameg.tg",
  },
  {
    id: "cameg-pra-kara",
    code: "PRA-KAR-06",
    name: "CAMEG Togo - PRA Kara (Région de la Kara)",
    shortName: "PRA Kara (Kara)",
    region: "Région de la Kara",
    city: "Kara",
    address: "Zone Industrielle / CHU Kara",
    telephone: "+228 26 60 02 14",
    email: "pra.kara@cameg.tg",
  },
  {
    id: "cameg-pra-dapaong",
    code: "PRA-SAV-07",
    name: "CAMEG Togo - PRA Dapaong (Région des Savanes)",
    shortName: "PRA Dapaong (Savanes)",
    region: "Région des Savanes",
    city: "Dapaong",
    address: "Route Nationale 1, Dapaong",
    telephone: "+228 27 70 81 40",
    email: "pra.dapaong@cameg.tg",
  },
];

/**
 * Normalise une chaîne de caractères pour comparaison (minuscules, sans accents)
 */
function normalizeStr(str) {
  if (!str) return "";
  return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Détermine la PRA la plus proche selon la ville ou la région de la pharmacie
 */
export function getNearestPra(cityOrRegion) {
  if (!cityOrRegion) return CAMEG_PRA_LIST[0]; // fallback Lomé
  const q = normalizeStr(cityOrRegion);

  // Recherche par ville dans les régions
  for (const reg of TOGO_REGIONS) {
    if (normalizeStr(reg.name).includes(q) || q.includes(normalizeStr(reg.id))) {
      const found = CAMEG_PRA_LIST.find((p) => p.id === reg.defaultPraId);
      if (found) return found;
    }
    for (const city of reg.cities) {
      if (normalizeStr(city).includes(q) || q.includes(normalizeStr(city))) {
        const found = CAMEG_PRA_LIST.find((p) => p.id === reg.defaultPraId);
        if (found) return found;
      }
    }
  }

  // Recherche directe dans la liste des PRA
  const directMatch = CAMEG_PRA_LIST.find(
    (p) => normalizeStr(p.city).includes(q) || normalizeStr(p.region).includes(q)
  );
  return directMatch || CAMEG_PRA_LIST[0];
}

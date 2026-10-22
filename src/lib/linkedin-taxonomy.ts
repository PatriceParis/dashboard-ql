// Libellés français des référentiels LinkedIn utilisés par les pivots démographiques
// (publicités) et les statistiques d'abonnés (page). Les identifiants inconnus
// sont affichés avec leur code.

export const SENIORITY_LABELS: Record<string, string> = {
  "1": "Non rémunéré",
  "2": "Stagiaire / formation",
  "3": "Débutant",
  "4": "Confirmé",
  "5": "Manager",
  "6": "Directeur",
  "7": "Vice-président",
  "8": "Dirigeant (CxO)",
  "9": "Associé",
  "10": "Propriétaire",
};

export const FUNCTION_LABELS: Record<string, string> = {
  "1": "Comptabilité",
  "2": "Administration",
  "3": "Arts et design",
  "4": "Développement commercial",
  "5": "Services sociaux",
  "6": "Conseil",
  "7": "Éducation",
  "8": "Ingénierie",
  "9": "Entrepreneuriat",
  "10": "Finance",
  "11": "Santé",
  "12": "Ressources humaines",
  "13": "Informatique",
  "14": "Juridique",
  "15": "Marketing",
  "16": "Médias et communication",
  "17": "Armée et protection",
  "18": "Opérations",
  "19": "Gestion de produit",
  "20": "Gestion de programme et de projet",
  "21": "Achats",
  "22": "Assurance qualité",
  "23": "Immobilier",
  "24": "Recherche",
  "25": "Ventes",
  "26": "Support et succès client",
};

export const STAFF_COUNT_LABELS: Record<string, string> = {
  SIZE_1: "Indépendant",
  SIZE_2_TO_10: "2 à 10",
  SIZE_11_TO_50: "11 à 50",
  SIZE_51_TO_200: "51 à 200",
  SIZE_201_TO_500: "201 à 500",
  SIZE_501_TO_1000: "501 à 1 000",
  SIZE_1001_TO_5000: "1 001 à 5 000",
  SIZE_5001_TO_10000: "5 001 à 10 000",
  SIZE_10001_OR_MORE: "Plus de 10 000",
};

export const STAFF_COUNT_ORDER = Object.keys(STAFF_COUNT_LABELS);

// Effectif minimal d'une tranche, pour le filtre « grandes entreprises » (ICP : 200 et plus).
export function staffCountMin(range?: string): number {
  if (!range) return 0;
  const m = range.match(/SIZE_(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Codes secteur LinkedIn (référentiel historique renvoyé par les pivots).
export const INDUSTRY_LABELS: Record<string, string> = {
  "1": "Défense et espace",
  "3": "Matériel informatique",
  "4": "Logiciels",
  "5": "Réseaux informatiques",
  "6": "Internet",
  "7": "Semi-conducteurs",
  "8": "Télécommunications",
  "9": "Droit",
  "10": "Gestion d'actifs",
  "11": "Technologies et services biotechnologiques",
  "12": "Industrie pharmaceutique",
  "13": "Santé",
  "14": "Hôpitaux",
  "15": "Dispositifs médicaux",
  "16": "Vente au détail",
  "17": "Grande distribution",
  "18": "Alimentation et boissons",
  "19": "Biens de consommation",
  "23": "Services financiers",
  "24": "Immobilier",
  "25": "Logistique et chaîne d'approvisionnement",
  "26": "Conseil en gestion",
  "27": "Services aux entreprises",
  "28": "Industrie manufacturière",
  "29": "Ingénierie",
  "30": "Sport",
  "31": "Génie civil",
  "32": "Agriculture",
  "33": "Médias audiovisuels",
  "34": "Télévision",
  "35": "Édition",
  "36": "Presse",
  "37": "Industrie musicale",
  "38": "Cinéma",
  "39": "Divertissement",
  "41": "Banque",
  "42": "Assurance",
  "43": "Services financiers",
  "44": "Capital-investissement",
  "45": "Capital-risque",
  "46": "Comptabilité",
  "47": "Conseil",
  "48": "Construction",
  "49": "Matériaux de construction",
  "50": "Architecture",
  "51": "Électronique grand public",
  "52": "Aéronautique et aérospatial",
  "53": "Automobile",
  "54": "Chimie",
  "55": "Machines industrielles",
  "56": "Mines et métaux",
  "57": "Pétrole et énergie",
  "58": "Transport maritime",
  "59": "Énergies renouvelables",
  "60": "Services publics",
  "61": "Textile",
  "62": "Services environnementaux",
  "63": "Papier et produits forestiers",
  "64": "Emballage",
  "67": "Administration publique",
  "68": "Hôtellerie",
  "69": "Enseignement supérieur",
  "70": "Enseignement primaire et secondaire",
  "71": "Formation professionnelle",
  "72": "Recherche",
  "73": "Administration territoriale",
  "74": "Militaire",
  "75": "Affaires internationales",
  "76": "Organisations internationales",
  "77": "Politique",
  "78": "Secteur associatif",
  "79": "Recherche de fonds",
  "80": "Marketing et publicité",
  "81": "Relations publiques",
  "82": "Design",
  "84": "Relations gouvernementales",
  "86": "Sécurité et investigations",
  "87": "Transport routier",
  "88": "Travail social",
  "89": "Conditionnement",
  "90": "Santé mentale",
  "91": "Agroalimentaire",
  "92": "Transport et logistique",
  "93": "Ressources humaines",
  "94": "Recrutement",
  "95": "Services aux particuliers",
  "96": "Services informatiques",
  "97": "Vente en gros",
  "98": "Import-export",
  "99": "Conseil en gestion",
  "100": "Organisation d'événements",
  "101": "Gouvernement",
  "102": "Événementiel",
  "104": "Supermarchés",
  "105": "Transport de marchandises",
  "106": "Aviation",
  "107": "Restauration",
  "108": "Services de bien-être",
  "109": "Compagnies aériennes",
  "110": "Électronique",
  "111": "Pharmacie",
  "112": "Cosmétiques",
  "113": "Mode",
  "114": "Luxe",
  "115": "Agences de voyage",
  "116": "Biens de luxe et bijouterie",
  "117": "Jeux vidéo",
  "118": "Sécurité informatique et réseaux",
  "119": "Technologies sans fil",
  "120": "Édition en ligne",
  "121": "Design graphique",
  "122": "Nanotechnologies",
  "123": "Banque d'investissement",
  "124": "Jeux de hasard",
  "125": "Médias en ligne",
  "126": "Marketing direct",
  "127": "Logiciels",
  "128": "Mobilier",
  "129": "Équipements électriques",
  "130": "Externalisation",
  "131": "Matériel ferroviaire",
  "132": "Énergie nucléaire",
  "133": "Formation en ligne",
  "134": "Vente et distribution",
  "135": "Services vétérinaires",
  "136": "Beaux-arts",
  "137": "Plateformes et agrégation",
  "138": "Logiciels et services informatiques",
  "139": "Enquêtes et sécurité",
  "140": "Impression",
  "141": "Enseignement",
  "142": "Marchés financiers",
  "143": "Transport",
  "144": "Services réseaux",
  "145": "Programmation informatique",
  "146": "Services de données",
  "147": "Cybersécurité",
  "148": "Gestion de bases de données",
  "150": "Fabrication de machines",
  "1594": "Ingénierie industrielle",
  "1810": "Technologie, information et internet",
  "1862": "Services informatiques et conseil",
  "3099": "Conseil en technologies",
  "3100": "Développement de logiciels",
  "3101": "Sécurité informatique et réseaux",
  "3102": "Télécommunications",
  "3128": "Services financiers",
  "3131": "Robotique",
  "3242": "Semi-conducteurs",
  "3247": "Logiciels embarqués",
  "3248": "Données et IA",
  "3251": "Infrastructure cloud",
};

export function industryLabel(urn?: string): string {
  if (!urn) return "Secteur inconnu";
  const id = urn.split(":").pop() || urn;
  return INDUSTRY_LABELS[id] || `Secteur ${id}`;
}

export function functionLabel(urn?: string): string {
  if (!urn) return "Fonction inconnue";
  const id = urn.split(":").pop() || urn;
  return FUNCTION_LABELS[id] || `Fonction ${id}`;
}

export function seniorityLabel(urn?: string): string {
  if (!urn) return "Niveau inconnu";
  const id = urn.split(":").pop() || urn;
  return SENIORITY_LABELS[id] || `Niveau ${id}`;
}

export function staffCountLabel(range?: string): string {
  if (!range) return "Taille inconnue";
  return STAFF_COUNT_LABELS[range] || range;
}

export const COUNTRY_LABELS: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  LU: "Luxembourg",
  DE: "Allemagne",
  GB: "Royaume-Uni",
  US: "États-Unis",
  ES: "Espagne",
  IT: "Italie",
  NL: "Pays-Bas",
  CA: "Canada",
  MA: "Maroc",
  TN: "Tunisie",
  IN: "Inde",
  AR: "Argentine",
};

export function countryLabel(code?: string): string {
  if (!code) return "";
  return COUNTRY_LABELS[code] || code;
}

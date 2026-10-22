// English labels for the LinkedIn reference data used by the demographic pivots
// (ads) and follower statistics (Page). Unknown identifiers are shown with their code.

export const SENIORITY_LABELS: Record<string, string> = {
  "1": "Unpaid",
  "2": "Training",
  "3": "Entry",
  "4": "Senior",
  "5": "Manager",
  "6": "Director",
  "7": "VP",
  "8": "CXO",
  "9": "Partner",
  "10": "Owner",
};

export const FUNCTION_LABELS: Record<string, string> = {
  "1": "Accounting",
  "2": "Administrative",
  "3": "Arts and design",
  "4": "Business development",
  "5": "Community and social services",
  "6": "Consulting",
  "7": "Education",
  "8": "Engineering",
  "9": "Entrepreneurship",
  "10": "Finance",
  "11": "Healthcare services",
  "12": "Human resources",
  "13": "Information technology",
  "14": "Legal",
  "15": "Marketing",
  "16": "Media and communication",
  "17": "Military and protective services",
  "18": "Operations",
  "19": "Product management",
  "20": "Program and project management",
  "21": "Purchasing",
  "22": "Quality assurance",
  "23": "Real estate",
  "24": "Research",
  "25": "Sales",
  "26": "Customer success and support",
};

export const STAFF_COUNT_LABELS: Record<string, string> = {
  SIZE_1: "Self-employed",
  SIZE_2_TO_10: "2 to 10",
  SIZE_11_TO_50: "11 to 50",
  SIZE_51_TO_200: "51 to 200",
  SIZE_201_TO_500: "201 to 500",
  SIZE_501_TO_1000: "501 to 1,000",
  SIZE_1001_TO_5000: "1,001 to 5,000",
  SIZE_5001_TO_10000: "5,001 to 10,000",
  SIZE_10001_OR_MORE: "10,001 or more",
};

export const STAFF_COUNT_ORDER = Object.keys(STAFF_COUNT_LABELS);

// Lower bound of a size bracket, used by the "large companies" segment.
export function staffCountMin(range?: string): number {
  if (!range) return 0;
  const m = range.match(/SIZE_(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export const INDUSTRY_LABELS: Record<string, string> = {
  "1": "Defense and space",
  "3": "Computer hardware",
  "4": "Computer software",
  "5": "Computer networking",
  "6": "Internet",
  "7": "Semiconductors",
  "8": "Telecommunications",
  "9": "Law practice",
  "10": "Legal services",
  "11": "Management consulting",
  "12": "Biotechnology",
  "13": "Medical practice",
  "14": "Hospital and health care",
  "15": "Pharmaceuticals",
  "16": "Veterinary",
  "17": "Medical devices",
  "18": "Cosmetics",
  "19": "Apparel and fashion",
  "20": "Sporting goods",
  "21": "Tobacco",
  "22": "Supermarkets",
  "23": "Food production",
  "24": "Consumer electronics",
  "25": "Consumer goods",
  "26": "Furniture",
  "27": "Retail",
  "28": "Entertainment",
  "29": "Gambling and casinos",
  "30": "Leisure, travel and tourism",
  "31": "Hospitality",
  "32": "Restaurants",
  "33": "Sports",
  "34": "Food and beverages",
  "35": "Motion pictures and film",
  "36": "Broadcast media",
  "37": "Museums and institutions",
  "38": "Fine art",
  "39": "Performing arts",
  "40": "Recreational facilities and services",
  "41": "Banking",
  "42": "Insurance",
  "43": "Financial services",
  "44": "Real estate",
  "45": "Investment banking",
  "46": "Investment management",
  "47": "Accounting",
  "48": "Construction",
  "49": "Building materials",
  "50": "Architecture and planning",
  "51": "Civil engineering",
  "52": "Aviation and aerospace",
  "53": "Automotive",
  "54": "Chemicals",
  "55": "Machinery",
  "56": "Mining and metals",
  "57": "Oil and energy",
  "58": "Shipbuilding",
  "59": "Utilities",
  "60": "Textiles",
  "61": "Paper and forest products",
  "62": "Railroad manufacture",
  "63": "Farming",
  "64": "Ranching",
  "65": "Dairy",
  "66": "Fishery",
  "67": "Primary and secondary education",
  "68": "Higher education",
  "69": "Education management",
  "70": "Research",
  "71": "Military",
  "72": "Legislative office",
  "73": "Judiciary",
  "74": "International affairs",
  "75": "Government administration",
  "76": "Executive office",
  "77": "Law enforcement",
  "78": "Public safety",
  "79": "Public policy",
  "80": "Marketing and advertising",
  "81": "Newspapers",
  "82": "Publishing",
  "83": "Printing",
  "84": "Information services",
  "85": "Libraries",
  "86": "Environmental services",
  "87": "Package and freight delivery",
  "88": "Individual and family services",
  "89": "Religious institutions",
  "90": "Civic and social organization",
  "91": "Consumer services",
  "92": "Transportation, trucking and railroad",
  "93": "Warehousing",
  "94": "Airlines and aviation",
  "95": "Maritime",
  "96": "Information technology and services",
  "97": "Market research",
  "98": "Public relations and communications",
  "99": "Design",
  "100": "Non-profit organization management",
  "101": "Fundraising",
  "102": "Program development",
  "103": "Writing and editing",
  "104": "Staffing and recruiting",
  "105": "Professional training and coaching",
  "106": "Venture capital and private equity",
  "107": "Political organization",
  "108": "Translation and localization",
  "109": "Computer games",
  "110": "Events services",
  "111": "Arts and crafts",
  "112": "Electrical and electronic manufacturing",
  "113": "Online media",
  "114": "Nanotechnology",
  "115": "Music",
  "116": "Logistics and supply chain",
  "117": "Plastics",
  "118": "Computer and network security",
  "119": "Wireless",
  "120": "Alternative dispute resolution",
  "121": "Security and investigations",
  "122": "Facilities services",
  "123": "Outsourcing and offshoring",
  "124": "Health, wellness and fitness",
  "125": "Alternative medicine",
  "126": "Media production",
  "127": "Animation",
  "128": "Commercial real estate",
  "129": "Capital markets",
  "130": "Think tanks",
  "131": "Philanthropy",
  "132": "E-learning",
  "133": "Wholesale",
  "134": "Import and export",
  "135": "Mechanical or industrial engineering",
  "136": "Photography",
  "137": "Human resources",
  "138": "Business supplies and equipment",
  "139": "Mental health care",
  "140": "Graphic design",
  "141": "International trade and development",
  "142": "Wine and spirits",
  "143": "Luxury goods and jewelry",
  "144": "Renewables and environment",
  "145": "Glass, ceramics and concrete",
  "146": "Packaging and containers",
  "147": "Industrial automation",
  "148": "Government relations",
  "1594": "Industrial engineering",
  "1673": "Technology, information and media",
  "1029": "IT system custom software development",
  "1810": "Technology, information and internet",
  "1862": "IT services and IT consulting",
  "3099": "Technology consulting",
  "3100": "Software development",
  "3101": "Computer and network security",
  "3102": "Telecommunications",
  "3128": "Financial services",
  "3131": "Robotics engineering",
  "3242": "Semiconductor manufacturing",
  "3247": "Embedded software products",
  "3248": "Data infrastructure and analytics",
  "3251": "Cloud infrastructure",
};

export function industryLabel(urn?: string): string {
  if (!urn) return "Unknown industry";
  const id = urn.split(":").pop() || urn;
  return INDUSTRY_LABELS[id] || `Industry ${id}`;
}

export function functionLabel(urn?: string): string {
  if (!urn) return "Unknown function";
  const id = urn.split(":").pop() || urn;
  return FUNCTION_LABELS[id] || `Function ${id}`;
}

export function seniorityLabel(urn?: string): string {
  if (!urn) return "Unknown seniority";
  const id = urn.split(":").pop() || urn;
  return SENIORITY_LABELS[id] || `Seniority ${id}`;
}

export function staffCountLabel(range?: string): string {
  if (!range) return "Unknown size";
  return STAFF_COUNT_LABELS[range] || range;
}

export const ORG_TYPE_LABELS: Record<string, string> = {
  PUBLIC_COMPANY: "Public company",
  PRIVATELY_HELD: "Privately held",
  GOVERNMENT_AGENCY: "Government agency",
  NON_PROFIT: "Non-profit",
  EDUCATIONAL: "Educational",
  SELF_OWNED: "Self-owned",
  SELF_EMPLOYED: "Self-employed",
  PARTNERSHIP: "Partnership",
};

export function orgTypeLabel(type?: string): string {
  if (!type) return "–";
  return ORG_TYPE_LABELS[type] || type;
}

export const COUNTRY_LABELS: Record<string, string> = {
  FR: "France",
  BE: "Belgium",
  CH: "Switzerland",
  LU: "Luxembourg",
  DE: "Germany",
  GB: "United Kingdom",
  US: "United States",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  CA: "Canada",
  MA: "Morocco",
  TN: "Tunisia",
  IN: "India",
  AR: "Argentina",
  SE: "Sweden",
  IE: "Ireland",
  PT: "Portugal",
  AT: "Austria",
  DK: "Denmark",
  NO: "Norway",
  FI: "Finland",
  PL: "Poland",
  IL: "Israel",
  SG: "Singapore",
  JP: "Japan",
  AU: "Australia",
};

export function countryLabel(code?: string): string {
  if (!code) return "";
  return COUNTRY_LABELS[code] || code;
}

/** Arbetsförmedlingen's top-level occupation fields (JobTech taxonomy concept ids). */
export const OCCUPATION_FIELDS = [
  { id: "X82t_awd_Qyc", label: "Administration, ekonomi, juridik", english: "Administration, economics, finance, law" },
  { id: "j7Cq_ZJe_GkT", label: "Bygg och anläggning", english: "Construction" },
  { id: "bh3H_Y3h_5eD", label: "Chefer och verksamhetsledare", english: "Managers and executives" },
  { id: "apaJ_2ja_LuF", label: "Data/IT", english: "Data and IT" },
  { id: "RPTn_bxG_ExZ", label: "Försäljning, inköp, marknadsföring", english: "Sales, purchasing, marketing" },
  { id: "PaxQ_o1G_wWH", label: "Hantverk", english: "Crafts" },
  { id: "ScKy_FHB_7wT", label: "Hotell, restaurang, storhushåll", english: "Hotel, restaurant, catering" },
  { id: "NYW6_mP6_vwf", label: "Hälso- och sjukvård", english: "Healthcare" },
  { id: "wTEr_CBC_bqh", label: "Industriell tillverkning", english: "Manufacturing" },
  { id: "yhCP_AqT_tns", label: "Installation, drift, underhåll", english: "Installation, operations, maintenance" },
  { id: "Uuf1_GMh_Uvw", label: "Kropps- och skönhetsvård", english: "Body and beauty care" },
  { id: "9puE_nYg_crq", label: "Kultur, media, design", english: "Culture, media, design" },
  { id: "bH5L_uXD_ZAX", label: "Militära yrken", english: "Military" },
  { id: "VuuL_7CH_adj", label: "Naturbruk", english: "Agriculture, forestry, animals" },
  { id: "kJeN_wmw_9wX", label: "Naturvetenskap", english: "Natural sciences" },
  { id: "MVqp_eS8_kDZ", label: "Pedagogik", english: "Education and teaching" },
  { id: "whao_Q6A_ScE", label: "Sanering och renhållning", english: "Cleaning and sanitation" },
  { id: "E7hm_BLq_fqZ", label: "Säkerhet och bevakning", english: "Security" },
  { id: "ASGV_zcE_bWf", label: "Transport, distribution, lager", english: "Transport, distribution, warehousing" },
  { id: "GazW_2TU_kJw", label: "Yrken med social inriktning", english: "Social work" },
  { id: "6Hq3_tKo_V57", label: "Yrken med teknisk inriktning", english: "Engineering and technical" },
] as const;

export const FIELD_LABELS = OCCUPATION_FIELDS.map((f) => f.label) as [string, ...string[]];

const BY_LABEL = new Map<string, string>(OCCUPATION_FIELDS.map((f) => [f.label, f.id]));
const IDS = new Set<string>(OCCUPATION_FIELDS.map((f) => f.id));

export const fieldIdsFromLabels = (labels: string[]) => [...new Set(labels.flatMap((l) => BY_LABEL.get(l) ?? []))];
export const validFieldIds = (ids: string[]) => [...new Set(ids.filter((id) => IDS.has(id)))];

/**
 * The fields the search is restricted to: the user's own choice if they made one,
 * otherwise what was read from the CV. Empty means no restriction.
 */
export function effectiveFields(profile: { occupationFields?: string[] } | null, prefs: { occupationFields: string[] | null }): string[] {
  return validFieldIds(prefs.occupationFields ?? profile?.occupationFields ?? []);
}

import nlp from "compromise";
import SentimentAnalyzer from "sentiment";
import type { Sentiment as NewsSentiment } from "@/lib/news-data";

type TopicRule = {
  category: string;
  subcategory: string;
  signals: RegExp[];
};

type ImpactSignal = {
  pattern: RegExp;
  weight: number;
};

export type NewsTextAnalysis = {
  impact: NewsSentiment;
  impactConfidence: number;
  tone: NewsSentiment;
  toneConfidence: number;
  category: string;
  subcategory: string;
  topicConfidence: number;
  placeCandidates: string[];
};

const sentimentAnalyzer = new SentimentAnalyzer();

const TONE_PHRASE_ADJUSTMENTS: ImpactSignal[] = [
  { pattern: /\b(cut|cuts|cutting|reduce[sd]?|lower(?:ed|s|ing)?)\s+(?:\w+\s+){0,2}(pollution|emissions?|deaths?|crime)\b/i, weight: 3 },
  { pattern: /\b(no|without)\s+(deaths?|casualties|injuries)\b/i, weight: 3 },
  { pattern: /\b(grow(?:s|ing|th)|recover(?:y|ed|ing)|improv(?:e|es|ed|ing))\b/i, weight: 2 },
  { pattern: /\b(avert(?:s|ed)|prevent(?:s|ed)|contain(?:s|ed))\b/i, weight: 2 },
];

const IMPACT_SIGNALS: ImpactSignal[] = [
  { pattern: /\b(ceasefire|peace deal|peace agreement)\b/i, weight: 4 },
  { pattern: /\b(breakthrough|cure|eradicated|rescued|saved)\b/i, weight: 4 },
  { pattern: /\b(prevent(?:s|ed|ing)?|protect(?:s|ed|ing|ors?)?|avert(?:s|ed|ing)?|safeguard(?:s|ed|ing)?)\b/i, weight: 7 },
  { pattern: /\b(free entry|free access|injury boost|milestone|record high|awarded|wins?)\b/i, weight: 3 },
  { pattern: /\b(recovery|recovered|restored|reopened|contained)\b/i, weight: 3 },
  { pattern: /\b(agreement|approved|launched|expanded|improved|growth|growing|record low)\b/i, weight: 2 },
  { pattern: /\b(cut|cuts|cutting|reduce[sd]?|lower(?:ed|s|ing)?)\s+(?:\w+\s+){0,2}(pollution|emissions?|deaths?|crime)\b/i, weight: 3 },
  { pattern: /\b(open(?:s|ed)?(?: up)?|begins?|starts?)\s+(?:a\s+|an\s+|new\s+)?(?:\w+\s+){0,3}(hospital|clinic|school|service|program|project|facility|trail|route|park|museum|trek)\b/i, weight: 2 },
  { pattern: /\b(killed|deaths?|fatalities|casualties)\b/i, weight: -5 },
  { pattern: /\b(murder(?:s|ed|ing)?|homicides?|manslaughter|assassinat(?:e[sd]?|ions?)|slayings?)\b/i, weight: -5 },
  { pattern: /\b(robber(?:y|ies)|robbed|kidnapp(?:ed|ing|ings?)?|abduct(?:ed|ion|ions)|terrorism|terrorists?|suicides?|suicidal|self-harm)\b/i, weight: -5 },
  { pattern: /\b(hack(?:ed|ing)|ransomware|cyberattacks?|data breaches?)\b/i, weight: -4 },
  { pattern: /\b(war|invasion|airstrikes?|bombing|shooting|massacre|terror attacks?)\b/i, weight: -5 },
  { pattern: /\b(disaster|earthquake|tsunami|hurricane|cyclone|wildfire|flooding?)\b/i, weight: -4 },
  { pattern: /\b(crisis|attacks?|explosion|collapse|outbreak|famine|drought)\b/i, weight: -3 },
  { pattern: /\b(outage|shortage|evacuation|layoffs?|sanctions?|decline|disruption)\b/i, weight: -2 },
];

const TOPIC_RULES: TopicRule[] = [
  { category: "Crime", subcategory: "Violent crime", signals: [/\bmurder(?:s|ed|ing)?\b/i, /\bhomicides?\b/i, /\bmanslaughter\b/i, /\bassassinat(?:e[sd]?|ions?)\b/i, /\bslayings?\b/i] },
  { category: "Crime", subcategory: "Robbery", signals: [/\brobber(?:y|ies)\b/i, /\brobbed\b/i] },
  { category: "Crime", subcategory: "Kidnapping", signals: [/\bkidnapp(?:ed|ing|ings?)?\b/i, /\babduct(?:ed|ion|ions)\b/i] },
  { category: "Conflict", subcategory: "Terrorism", signals: [/\bterrorism\b/i, /\bterrorists?\b/i, /\bterror attacks?\b/i] },
  { category: "Health", subcategory: "Suicide & self-harm", signals: [/\bsuicides?\b/i, /\bsuicidal\b/i, /\bself-harm\b/i] },
  { category: "Conflict", subcategory: "Armed conflict", signals: [/\bwar\b/i, /\binvasion\b/i, /\bmilitary\b/i, /\bairstrike\b/i, /\bcombat\b/i] },
  { category: "Conflict", subcategory: "Security", signals: [/\battacks?\b/i, /\bterror/i, /\bnational security\b/i, /\bpublic security\b/i, /\bshooting\b/i, /\bexplosion\b/i] },
  { category: "Politics", subcategory: "Elections", signals: [/\belection/i, /\bvot(?:e|er|ing)\b/i, /\bballot\b/i, /\bcampaign\b/i] },
  { category: "Politics", subcategory: "Government", signals: [/\bgovernment\b/i, /\bparliament\b/i, /\bminister\b/i, /\bpresident\b/i, /\bpolicy\b/i] },
  { category: "Politics", subcategory: "Diplomacy", signals: [/\bdiploma/i, /\bsummit\b/i, /\btreaty\b/i, /\bceasefire\b/i, /\bsanctions?\b/i] },
  { category: "Climate", subcategory: "Extreme weather", signals: [/\bhurricane\b/i, /\bcyclone\b/i, /\bstorm\b/i, /\bflood/i, /\bdrought\b/i, /\bheatwave\b/i] },
  { category: "Climate", subcategory: "Wildfire", signals: [/\bwildfire\b/i, /\bforest fire\b/i, /\bfire crews?\b/i] },
  { category: "Climate", subcategory: "Environment", signals: [/\bclimate\b/i, /\benvironment/i, /\bpollution\b/i, /\bconservation\b/i, /\bemissions?\b/i] },
  { category: "Disaster", subcategory: "Earthquake", signals: [/\bearthquake\b/i, /\bseismic\b/i, /\btremor\b/i, /\btsunami\b/i] },
  { category: "Health", subcategory: "Disease & outbreaks", signals: [/\bdisease\b/i, /\boutbreak\b/i, /\bvirus\b/i, /\binfection\b/i, /\bepidemic\b/i] },
  { category: "Health", subcategory: "Medicine", signals: [/\bhospital\b/i, /\bmedical\b/i, /\bmedicine\b/i, /\btreatment\b/i, /\bvaccine\b/i, /\bclinical trial\b/i] },
  { category: "Science", subcategory: "Space", signals: [/\bspace\b/i, /\bnasa\b/i, /\bsatellite\b/i, /\brocket\b/i, /\borbit\b/i] },
  { category: "Science", subcategory: "Research", signals: [/\bscience\b/i, /\bresearch/i, /\bstudy\b/i, /\bscientists?\b/i, /\bdiscovery\b/i] },
  { category: "Technology", subcategory: "Artificial intelligence", signals: [/\bartificial intelligence\b/i, /\bmachine learning\b/i, /\bAI\b/] },
  { category: "Technology", subcategory: "Cybersecurity", signals: [/\bcyber/i, /\bhack(?:ed|ing)?\b/i, /\bransomware\b/i, /\bdata breaches?\b/i] },
  { category: "Technology", subcategory: "Innovation", signals: [/\btechnology\b/i, /\bsoftware\b/i, /\bchips?\b/i, /\bstartup\b/i, /\bdigital\b/i] },
  { category: "Economy", subcategory: "Energy markets", signals: [/\boil prices?\b/i, /\bgas prices?\b/i, /\benergy market\b/i, /\bcrude\b/i] },
  { category: "Economy", subcategory: "Markets", signals: [/\bmarket/i, /\bstocks?\b/i, /\bshares?\b/i, /\binvestor/i, /\binflation\b/i, /\bcentral bank\b/i, /\binterest rates?\b/i] },
  { category: "Economy", subcategory: "Trade & business", signals: [/\beconom/i, /\bbusiness\b/i, /\btrade\b/i, /\btariffs?\b/i, /\bcompany\b/i, /\bjobs?\b/i] },
  { category: "Education", subcategory: "Higher education", signals: [/\buniversit(?:y|ies)\b/i, /\bcolleges?\b/i, /\bcampus\b/i, /\bstudents?\b/i] },
  { category: "Sports", subcategory: "Competition", signals: [/\bsports?\b/i, /\bmatch\b/i, /\btournament\b/i, /\bchampionship\b/i, /\b league\b/i] },
  { category: "Culture", subcategory: "Arts & culture", signals: [/\bculture\b/i, /\bfilm\b/i, /\bmusic\b/i, /\bartists?\b/i, /\bmuseum\b/i, /\barchaeolog/i] },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function labelFromScore(score: number, threshold: number): NewsSentiment {
  if (score >= threshold) return "positive";
  if (score <= -threshold) return "negative";
  return "neutral";
}

function cleanPlace(value: string) {
  return value.replace(/^[\s,.;:]+|[\s,.;:]+$/g, "").replace(/\s+/g, " ");
}

export function analyzeNewsText(title: string, snippet = ""): NewsTextAnalysis {
  const text = `${title}. ${snippet}`.trim();
  const document = nlp(text);
  const sentiment = sentimentAnalyzer.analyze(text);
  const tonePhraseScore = TONE_PHRASE_ADJUSTMENTS
    .filter((signal) => signal.pattern.test(text))
    .reduce((score, signal) => score + signal.weight, 0);
  const adjustedToneScore = sentiment.score + tonePhraseScore;
  const adjustedComparative = adjustedToneScore / Math.max(sentiment.tokens.length, 1);
  const tone = labelFromScore(adjustedComparative, 0.1);
  const toneEvidence = sentiment.positive.length + sentiment.negative.length;
  const toneConfidence = clamp(
    0.52 + Math.abs(adjustedComparative) * 0.9 + Math.min(toneEvidence, 4) * 0.035,
    0.52,
    0.93,
  );

  const matchedImpactSignals = IMPACT_SIGNALS.filter((signal) => signal.pattern.test(text));
  const impactScore = matchedImpactSignals.reduce((total, signal) => total + signal.weight, 0);
  const impact = labelFromScore(impactScore, 2);
  const impactConfidence = matchedImpactSignals.length
    ? clamp(0.58 + Math.abs(impactScore) * 0.045 + matchedImpactSignals.length * 0.035, 0.58, 0.94)
    : 0.5;

  const rankedTopics = TOPIC_RULES.map((rule) => ({
    ...rule,
    score: rule.signals.reduce((score, signal) => score + (signal.test(text) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const bestTopic = rankedTopics[0];
  const category = bestTopic?.score ? bestTopic.category : "World";
  const subcategory = bestTopic?.score ? bestTopic.subcategory : "Current affairs";
  const topicConfidence = bestTopic?.score ? clamp(0.58 + bestTopic.score * 0.1, 0.58, 0.9) : 0.45;

  const placeCandidates = Array.from(
    new Set(
      (document.places().out("array") as string[])
        .map(cleanPlace)
        .filter((place) => place.length > 2),
    ),
  ).slice(0, 3);

  return {
    impact,
    impactConfidence,
    tone,
    toneConfidence,
    category,
    subcategory,
    topicConfidence,
    placeCandidates,
  };
}

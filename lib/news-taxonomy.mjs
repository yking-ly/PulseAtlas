export const NEWS_TAXONOMY = {
  Crime: ["Violent crime", "Robbery", "Kidnapping"],
  Conflict: ["Terrorism", "Armed conflict", "Security"],
  Health: ["Suicide & self-harm", "Disease & outbreaks", "Medicine"],
  Politics: ["Elections", "Government", "Diplomacy"],
  Climate: ["Extreme weather", "Wildfire", "Environment"],
  Disaster: ["Earthquake"],
  Science: ["Space", "Research"],
  Technology: ["Artificial intelligence", "Cybersecurity", "Innovation"],
  Economy: ["Energy markets", "Markets", "Trade & business"],
  Education: ["Higher education"],
  Sports: ["Competition"],
  Culture: ["Arts & culture"],
  World: ["Current affairs"],
};

export function countTaxonomyMatches(events, selectedCategory = "all") {
  const topics = Object.fromEntries(Object.keys(NEWS_TAXONOMY).map((topic) => [topic, 0]));
  const subtopics = Object.fromEntries(Object.values(NEWS_TAXONOMY).flat().map((subtopic) => [subtopic, 0]));
  for (const event of events) {
    if (event.category in topics) topics[event.category] += 1;
    if ((selectedCategory === "all" || event.category === selectedCategory) && event.subcategory in subtopics) {
      subtopics[event.subcategory] += 1;
    }
  }
  return { topics, subtopics };
}

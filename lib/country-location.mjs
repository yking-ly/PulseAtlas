import { geoCentroid, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json" with { type: "json" };
import { countryFromInput } from "./news-search.mjs";

const COUNTRY_ALIASES = {
  "Bosnia and Herz.": "Bosnia & Herzegovina",
  "Central African Rep.": "Central African Republic",
  Congo: "Congo - Brazzaville",
  "Côte d'Ivoire": "Côte d’Ivoire",
  "Dem. Rep. Congo": "Congo - Kinshasa",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  Macedonia: "North Macedonia",
  Myanmar: "Myanmar (Burma)",
  Palestine: "Palestinian Territories",
  "S. Sudan": "South Sudan",
  "Solomon Is.": "Solomon Islands",
  Turkey: "Türkiye",
  "United States of America": "United States",
};

const countries = feature(worldAtlas, worldAtlas.objects.countries).features;

function newsEditionForFeature(country) {
  const atlasName = country?.properties?.name;
  return atlasName ? countryFromInput(COUNTRY_ALIASES[atlasName] ?? atlasName) : null;
}

export function countryAtCoordinates(latitude, longitude) {
  const match = countries.find((country) => geoContains(country, [longitude, latitude]));
  return newsEditionForFeature(match);
}

export function countryFocus(value) {
  if (typeof value !== "string") return null;
  const edition = countryFromInput(value);
  if (!edition || edition.code === "world") return null;
  const country = countries.find((candidate) => newsEditionForFeature(candidate)?.code === edition.code);
  if (!country) return null;
  const [longitude, latitude] = geoCentroid(country);
  return { ...edition, longitude, latitude, feature: country };
}

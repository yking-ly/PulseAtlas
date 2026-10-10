const IMPACT_ORDER = ["positive", "negative", "neutral"];

/** Pick one event for each impact, in the order shown on the landing page. */
export function onePerImpact(events) {
  return IMPACT_ORDER.flatMap((impact) => {
    const event = events.find((item) => item.sentiment === impact);
    return event ? [event] : [];
  });
}

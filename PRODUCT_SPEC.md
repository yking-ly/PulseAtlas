# Pulse Atlas — Product and Architecture Specification

## Product promise

Pulse Atlas helps people understand where current events are happening, how strongly different places are receiving attention, and how coverage changes across a rolling seven-day window.

The primary audience is a curious news reader, researcher, student, or analyst who wants spatial context without opening dozens of news tabs.

## Core experience

The first viewport is the working product: filters on the left, the globe in the center, and an evidence panel for the selected event. A person can rotate the globe, select a pulse, inspect the clustered coverage, change the time window, or switch to an attention heatmap.

The default window contains the newest seven days. The oldest day leaves automatically as a new day enters. Saved events are full snapshots and remain in the user's saved-stories collection.

## Event semantics

An event is distinct from an article. Several articles may describe one event.

Each event records:

- primary event location;
- affected locations where available;
- publisher location when known;
- source articles and source count;
- inferred topic and subcategory;
- article tone;
- inferred real-world impact;
- confidence for every inferred field; and
- publication and ingestion timestamps.

The interface never presents inferred sentiment or location as an objective fact. It labels the interpretation, separates tone from impact, and exposes confidence.

## Heatmap definition

The MVP heatmap represents **source attention**. Intensity increases with the number of source mentions in an event cluster. It does not claim to measure severity, public importance, or affected population.

Later versions can offer explicitly named alternatives:

- event density;
- unique-source attention;
- estimated geographic reach; and
- change in attention over time.

## System architecture

    SerpApi Google News
            |
            v
    Ingestion route
      - rolling 7-day query
      - grouped-result flattening
      - schema normalization
            |
            v
    Enrichment pipeline
      - event-location extraction
      - Google Maps coordinate verification
      - topic/subcategory classification
      - tone and impact classification
      - confidence calibration and unresolved-location exclusion
            |
            v
    Event clustering
      - title/semantic similarity
      - time proximity
      - geographic overlap
      - source deduplication
            |
            +------> globe and heatmap
            |
            +------> D1 snapshot bookmarks

## Current MVP boundary

The deployed MVP includes the complete exploration interface, SerpApi Google News ingestion, SerpApi Google Maps coordinate verification, a transparent baseline classifier, rolling-window filters, durable coordinate caching, and durable bookmark storage.

The included preview dataset makes the product reviewable without consuming search credits. Live mode activates when the deployment receives SERPAPI_KEY.

The next engineering milestone is replacing the baseline keyword classifier with a structured enrichment job that produces calibrated multi-location extraction and semantic event clusters. The UI and data model already expose the required distinctions.

## Hackathon demonstration

A concise demo should show:

1. Live SerpApi results entering the seven-day globe.
2. Several reports represented as one event cluster.
3. A switch from event markers to source-attention heat.
4. Positive or negative impact filtering with subcategories.
5. The distinction between neutral article tone and negative event impact.
6. A saved snapshot remaining accessible independently of the rolling feed.

## Success measures

- A user can locate and understand a relevant event in under 30 seconds.
- Duplicate coverage reduces to a readable cluster rather than overlapping markers.
- Low-confidence location and impact inferences are visibly distinguishable.
- The globe remains responsive with at least 1,000 clustered events.
- Every visible story provides a direct path to its original source.

# AI tools disclosure

OpenAI ChatGPT and Codex were used as development assistants for Pulse Atlas. They helped with:

- refining the product concept and user workflows;
- planning the SerpApi and geospatial data pipeline;
- implementing and reviewing React, TypeScript, CSS, and server code;
- debugging UI, authentication, and deployment issues;
- improving accessibility and responsive layouts;
- creating tests and technical documentation; and
- reasoning about event location, duplicate coverage, impact, tone, confidence, and privacy.

All generated suggestions and code were reviewed and tested against the running application.

Pulse Atlas does not call ChatGPT, Codex, or another generative-AI API at runtime. It does not generate or rewrite news reports. Live news content comes from SerpApi, and the original source links remain available to users.

Runtime text analysis is local and deterministic. It uses rules, the `compromise` NLP library, and a sentiment lexicon to extract place candidates and estimate topic, article tone, and event impact. The current implementation does not use a custom-trained news model or training dataset.

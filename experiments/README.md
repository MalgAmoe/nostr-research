# Experiments

This directory is Nostrarium's open-ended interpretation layer.

Experiments may arrange the stable engine and controller into systems,
composers, vessels, tools, interfaces, or combinations that do not yet have a
name. They are built seriously and tested against real research, but they are
not expected to converge on one canonical design.

Rules:

- ordinary controller commands and handles remain the shared boundary;
- experiments may overlap in capability and contradict one another;
- navigator choice and conclusions stay outside the engine;
- an experiment may be revised, combined, forked, or deleted without migration
  ceremony;
- reusable code is promoted only after repeated evidence, not to rescue a
  prototype.

Current experiments:

- [`schema-composer/`](./schema-composer/): one factual schema-backed command
  and observation composer;
- [`field-system/`](./field-system/): one field-oriented interpretation, still
  intentionally incomplete.

Historical voyage evidence belongs under [`docs/voyages/`](../docs/voyages/),
not here.

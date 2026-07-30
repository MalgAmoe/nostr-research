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
- [`darkroom-composer/`](./darkroom-composer/): fixed Ground and paired A/B
  exposures;
- [`evidence-desk/`](./evidence-desk/): a voyage-tested single-frame note/account
  decision surface with separate schema-backed visible controls;
- [`flight-console/`](./flight-console/): research sensors, transparent
  movements, position, and complete-engine escape;
- [`local-interfaces/`](./local-interfaces/): local control support currently
  used by the overlapping cockpits;
- [`overlap-cockpits/`](./overlap-cockpits/): Bridge, Parallax, and Expedition;
- [`spacecraft-organs/`](./spacecraft-organs/): tiny independent Navigator,
  Questions, Reservoirs, and Comparison organs sharing ordinary handles and
  the complete controller command surface.

Superseded experimental implementations are removed once their findings are
distilled. Historical voyage evidence belongs under
[`docs/voyages/`](../docs/voyages/), not here.

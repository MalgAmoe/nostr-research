# Spacecraft cockpit laboratory

A deliberately literal visual experiment over Nostrarium's current concepts.
It is not a product UI and does not yet connect to the research Worker.

Four configurations share one simulated bounded Nostr field:

- **Surveyor:** long-range field orientation around a fixed Home;
- **Interceptor:** reactive Pinball-like movement and a visible trajectory;
- **Darkroom:** optical A/B comparison;
- **Anatomical:** two reservoirs and a retractable probe embodied in the craft.

The controls are interactive. Sensors change the central field, pulse changes
the selected contact, probe/retract actions update the flight computer, and
contacts can be pulled into either reservoir.

Run:

```sh
npm start --workspace @nostrarium/spacecraft-cockpit
```

Then open `http://127.0.0.1:4178`.

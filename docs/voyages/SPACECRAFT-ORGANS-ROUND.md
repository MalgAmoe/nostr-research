# Spacecraft organs round

This experiment tested whether small independent caller-side subsystems can
retain almost the complete research system.

## Organs

- **Navigator:** Home, current attention, trail, alternatives, and known
  handles. It accepts any ordinary controller command unchanged.
- **Questions:** open text, status, and attributed evidence-handle references.
- **Reservoirs:** named bounded handle references with a custody intent.
- **Comparison:** ordinary handles assigned to named slots.

The controller remains the flight computer and recorder. The schema composer
remains available for contextual command construction. No organ introduces a
private operation vocabulary or result type.

## Live voyage

One random 300-event field was acquired from three relays. The Navigator then
executed ordinary commands:

```text
relate
→ aggregate by event.kind
→ sort by eventCount
→ return to shared rows
→ filter dominant kind
→ filter rare kind
```

The field contained 49 represented kinds. Kind 22668 dominated with 104 rows;
rare visible kind 23003 contained 4 rows. Nine controller commands completed
the voyage, including previews.

The rare handle simultaneously became:

- the Navigator's current position;
- evidence for an open question;
- comparison slot B;
- and an entry in the anomaly reservoir.

The dominant handle simultaneously remained:

- a Navigator alternative;
- evidence for another question;
- comparison slot A;
- and an entry in the gravity reservoir.

All references pointed to the same ordinary session handles. No copying or
conversion between organs was required.

## Result

The small-organs hypothesis survived this first voyage.

The arrangement preserved complete command freedom while externalizing the
state previously held in the navigator's head. It was simpler than the
complete Airlock, Pinball, Darkroom, or Cock and Balls state machines because
their useful pieces could be expressed as combinations of roles:

```text
Airlock      Navigator(Home protected) + Questions
Pinball      Navigator(result always becomes current)
Darkroom     Comparison + fixed Navigator position
Cock/Balls   retractable Navigator + two Reservoirs
```

The voyage also repeated an empirical warning: dominant and rare selections
both belonged to the same machine-signaling ecology. Multiple organs improve
state organization; they do not manufacture semantic diversity.

One naming issue was corrected after the voyage. Reservoir entries now carry a
custody `intent`, not a claimed retention state. Real notebook, archive, and
export actions must still be executed explicitly.

The live harness is `experiments/spacecraft-organs-live.mjs`.

# Spacecraft organs

An experiment in small caller-side subsystems that retain nearly the complete
research system.

- **Navigator** owns Home, current attention, trail, known handles, and
  alternatives. Its `execute()` accepts any ordinary controller command.
- **Questions** owns text, status, and evidence-handle references.
- **Reservoirs** owns named bounded handle references and an explicit custody
  intent. `remember`, `preserve`, and export remain separate visible actions;
  assigning an intent does not execute them.
- **Comparison** owns two or more named handle slots.

No organ creates a private result type, operation vocabulary, or engine state.
One ordinary handle may inhabit every organ simultaneously.

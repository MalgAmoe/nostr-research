# Flight console

An experimental navigator-facing interface above the neutral controller.

It has three distances from the engine:

- `exec()` performs one visible engine operation and accepts handles directly;
- `sense()` applies a named, handle-aware observation projection;
- `movement()` expands a reusable manoeuvre into ordinary recorded commands.

It does not interpret evidence, recommend a next action, rank subjects, or
hide commands. `command()` remains the complete escape hatch.

```js
const field = await flight.exec('acquire', {
  relays,
  filter: { kinds: [1], limit: 500 },
  timeoutMs: 15_000,
  observationLimit: 800,
  distinctEventLimit: 500,
  concurrency: 3,
  as: 'field',
  placement: 'home',
});

const aperture = await flight.movement('diversity-aperture', {
  field,
  maxLocalNotes: 3,
  sampleLimit: 40,
});

const view = await flight.sense(aperture.result, 'identities');
```

Every failed semantic command throws `FlightCommandError` immediately with
the engine error code, message, response, and exact command. Every successful
result exposes `handle`, `completeness`, `bounds`, and `warnings` directly,
while retaining the raw result and response for deep inspection.

Built-in sensors:

- `structure`
- `preview`
- `voices`
- `identities`
- `conversation`
- `raw`

Built-in transparent movements:

- `diversity-aperture`
- `local-recognition`
- `profile-descent`
- `authored-descent`

Callers can add disposable movements with `defineMovement()`. The supplied
movement function receives the same `exec()` primitive, and every step remains
visible in both the returned movement trace and the controller transcript.

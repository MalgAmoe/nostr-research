import { describe, expect, it } from 'vitest';
import {
  discardPending,
  executeStaged,
  initialFlightState,
  placePending,
  preserveFocus,
  stageOperation,
  travelTo,
} from './flight-model';

describe('fixture flight model', () => {
  it('keeps command execution separate from result placement', () => {
    const staged = stageOperation(initialFlightState, 'conversation');
    expect(staged.staged?.command.command).toBe('continue');
    expect(staged.placedFieldIds).toEqual(['ground']);

    const executed = executeStaged(staged);
    expect(executed.staged).toBeNull();
    expect(executed.pendingFieldId).toBe('conversation');
    expect(executed.placedFieldIds).toEqual(['ground']);

    const placed = placePending(executed);
    expect(placed.pendingFieldId).toBeNull();
    expect(placed.placedFieldIds).toEqual(['ground', 'conversation']);
  });

  it('discard removes only the voyage reference', () => {
    const executed = executeStaged(stageOperation(initialFlightState, 'author-history'));
    const discarded = discardPending(executed);
    expect(discarded.pendingFieldId).toBeNull();
    expect(discarded.placedFieldIds).toEqual(['ground']);
    expect(discarded.log[0]).toContain('engine release not issued');
  });

  it('uses one shared focus when traveling and preserves explicitly', () => {
    const placed = placePending(executeStaged(stageOperation(initialFlightState, 'conversation')));
    const traveled = travelTo(placed, 'conversation');
    expect(traveled.activeFieldId).toBe('conversation');
    expect(traveled.focusId).toBe('7e4a');
    const preserved = preserveFocus(traveled);
    expect(preserved.preservedIds).toEqual(['7e4a']);
    expect(preserveFocus(preserved).preservedIds).toEqual(['7e4a']);
  });
});

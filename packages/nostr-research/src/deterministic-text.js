export function compareCodePoints(left, right) {
  if (left === right) return 0;
  const leftPoints = left[Symbol.iterator]();
  const rightPoints = right[Symbol.iterator]();
  while (true) {
    const leftNext = leftPoints.next();
    const rightNext = rightPoints.next();
    if (leftNext.done || rightNext.done) {
      if (leftNext.done && rightNext.done) return 0;
      return leftNext.done ? -1 : 1;
    }
    const difference = leftNext.value.codePointAt(0) - rightNext.value.codePointAt(0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
}

export function foldCase(value) {
  return value.toLowerCase();
}

export function foldCaseWithOffsets(value) {
  const text = foldCase(value);
  const starts = [];
  const ends = [];
  let originalOffset = 0;
  for (const character of value) {
    const originalEnd = originalOffset + character.length;
    const folded = foldCase(character);
    for (let offset = 0; offset < folded.length; offset += 1) {
      starts.push(originalOffset);
      ends.push(originalEnd);
    }
    originalOffset = originalEnd;
  }
  return { text, starts, ends };
}

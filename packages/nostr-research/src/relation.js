import { ResearchMemoryError } from './index.js';

const MAX_LIMIT = 1000;
const MAX_DERIVED_STRING = 280;
const MAX_DERIVED_ARRAY = 20;
const SOURCE_FIELDS = Object.freeze([
  'evidence.resolutionSource',
  'observedRelays',
  'event.author',
  'event.kind',
  'event.text',
  'event.createdAt',
  'event.tags',
  'event.links',
  'event.domains',
  'event.hasMedia',
  'account.name',
  'account.display_name',
  'account.description',
  'account.nip05',
]);
const RELATION_OPERATIONS = new Set([
  'relate', 'filter', 'project', 'distinct', 'sort',
  'join', 'aggregate', 'derive', 'slice', 'explode', 'scan', 'balance',
]);

export function isResearchRelation(value) {
  return value?.type === 'research-relation' && Array.isArray(value.rows);
}

export function relationOperationNames() {
  return [...RELATION_OPERATIONS];
}

export function relationFrom(memory, value) {
  if (isResearchRelation(value)) return cloneRelation(value);
  const collection = memory.asCollection(value);
  if (!['subjects', 'events', 'accounts', 'relationships'].includes(collection.kind)) {
    throw new ResearchMemoryError(`Cannot convert ${collection.kind} into a research relation.`);
  }
  return researchRelation(collection.items.map((item) => ({
    values: relationValues(item),
    references: Object.fromEntries(SOURCE_FIELDS.map((field) => [
      field, { subject: item.subject, field },
    ])),
    subjects: [item.subject],
    reasons: item.reasons,
    provenance: provenanceReferences(item),
  })), {
    operation: 'relate',
    sourceKind: collection.kind,
    sourceContext: collection.context,
  });
}

export function validateRelationOperation(name, parameters, inputs) {
  if (!RELATION_OPERATIONS.has(name)) {
    throw new ResearchMemoryError(`Unsupported relation operation: ${name}.`);
  }
  plainObject(parameters, `${name} parameters`);
  if (name === 'relate') {
    exactInputs(inputs, ['input'], name);
    noKeys(parameters, name);
    return relationDescriptor();
  }
  exactInputs(inputs, name === 'join' ? ['left', 'right'] : ['input'], name);
  for (const value of Object.values(inputs)) {
    if (value.kind !== 'relation') {
      throw new ResearchMemoryError(`${name} requires research relation inputs.`);
    }
  }
  normalizeRelationParameters(name, parameters);
  return relationDescriptor();
}

export function executeRelationOperation(memory, name, parameters, inputs) {
  validateRelationOperation(
    name,
    parameters,
    Object.fromEntries(Object.entries(inputs).map(([key, value]) => [
      key, isResearchRelation(value) ? relationDescriptor() : { kind: value?.kind },
    ])),
  );
  const normalized = normalizeRelationParameters(name, parameters);
  if (name === 'relate') return relationFrom(memory, inputs.input);
  const input = resolveRelation(memory, cloneRelation(inputs.input ?? inputs.left));
  let output;
  if (name === 'filter') output = applyFilter(input, normalized);
  else if (name === 'project') output = applyProject(input, normalized);
  else if (name === 'distinct') output = applyDistinct(input, normalized);
  else if (name === 'sort') output = applySort(input, normalized);
  else if (name === 'slice') output = applySlice(input, normalized);
  else if (name === 'join') {
    output = applyJoin(input, resolveRelation(memory, cloneRelation(inputs.right)), normalized);
  }
  else if (name === 'aggregate') output = applyAggregate(input, normalized);
  else if (name === 'derive') output = applyDerive(input, normalized);
  else if (name === 'explode') output = applyExplode(input, normalized);
  else if (name === 'scan') output = applyScan(input, normalized);
  else output = applyBalance(input, normalized);
  output.context = {
    operation: 'relation-pipeline',
    input: input.context,
    stage: { operation: name, ...normalized },
    cardinality: {
      inputCount: input.rows.length,
      outputCount: output.rows.length,
      omittedCount: Math.max(0, input.rows.length - output.rows.length),
    },
  };
  return output;
}

function normalizeRelationParameters(name, value) {
  if (name === 'relate') return {};
  if (name === 'filter') {
    onlyKeys(value, ['where', 'limit'], name);
    return { where: normalizePredicate(value.where), limit: limit(value.limit) };
  }
  if (name === 'project') {
    onlyKeys(value, ['fields', 'limit'], name);
    return { fields: fieldMappings(value.fields, 'project'), limit: limit(value.limit) };
  }
  if (name === 'distinct') {
    onlyKeys(value, ['by', 'limit'], name);
    return { by: fields(value.by, 'distinct by'), limit: limit(value.limit) };
  }
  if (name === 'sort') {
    onlyKeys(value, ['by'], name);
    if (!Array.isArray(value.by) || value.by.length === 0) {
      throw new ResearchMemoryError('sort by must be a non-empty array.');
    }
    return {
      by: value.by.map((item) => {
        plainObject(item, 'sort item');
        onlyKeys(item, ['field', 'direction'], 'sort item');
        field(item.field, 'sort field');
        if (item.direction !== undefined && !['ascending', 'descending'].includes(item.direction)) {
          throw new ResearchMemoryError('sort direction must be ascending or descending.');
        }
        return { field: item.field, direction: item.direction ?? 'ascending' };
      }),
    };
  }
  if (name === 'slice') {
    onlyKeys(value, ['offset', 'limit'], name);
    const offset = value.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new ResearchMemoryError('slice offset must be a non-negative integer.');
    }
    return { offset, limit: limit(value.limit) };
  }
  if (name === 'explode') {
    onlyKeys(value, ['field', 'as', 'indexAs', 'limit'], name);
    field(value.field, 'explode field');
    const as = value.as ?? 'value';
    const indexAs = value.indexAs ?? `${as}.index`;
    nameValue(as, 'explode output name');
    nameValue(indexAs, 'explode index output name');
    if (as === indexAs) throw new ResearchMemoryError('explode output names must be unique.');
    return { field: value.field, as, indexAs, limit: limit(value.limit) };
  }
  if (name === 'scan') {
    onlyKeys(value, ['fields', 'terms', 'match', 'matchMode', 'caseSensitive', 'limit'], name);
    const selectedFields = fields(value.fields, 'scan fields');
    if (!Array.isArray(value.terms) || value.terms.length === 0
        || value.terms.length > 50
        || value.terms.some((term) => typeof term !== 'string'
          || term.length === 0 || term.length > 200)) {
      throw new ResearchMemoryError(
        'scan terms must contain 1 to 50 strings of at most 200 characters.',
      );
    }
    if (value.match !== undefined && !['any', 'all'].includes(value.match)) {
      throw new ResearchMemoryError('scan match must be any or all.');
    }
    if (value.caseSensitive !== undefined && typeof value.caseSensitive !== 'boolean') {
      throw new ResearchMemoryError('scan caseSensitive must be a boolean.');
    }
    const matchMode = value.matchMode ?? 'substring';
    if (!['substring', 'word', 'phrase'].includes(matchMode)) {
      throw new ResearchMemoryError('scan matchMode must be substring, word, or phrase.');
    }
    if (matchMode === 'word' && value.terms.some((term) => /\s/u.test(term))) {
      throw new ResearchMemoryError('scan word terms must not contain whitespace.');
    }
    const caseSensitive = value.caseSensitive === true;
    const deduplicatedTerms = [];
    const seenTerms = new Set();
    for (const term of value.terms) {
      const key = caseSensitive ? term : term.toLocaleLowerCase();
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      deduplicatedTerms.push(term);
    }
    return {
      fields: selectedFields,
      terms: deduplicatedTerms,
      match: value.match ?? 'any',
      matchMode,
      caseSensitive,
      limit: limit(value.limit),
    };
  }
  if (name === 'balance') {
    onlyKeys(value, ['by', 'limitPer', 'limit'], name);
    const by = fields(value.by, 'balance by');
    if (!Number.isSafeInteger(value.limitPer) || value.limitPer < 1
        || value.limitPer > MAX_LIMIT) {
      throw new ResearchMemoryError(`balance limitPer must be an integer from 1 to ${MAX_LIMIT}.`);
    }
    return { by, limitPer: value.limitPer, limit: limit(value.limit) };
  }
  if (name === 'join') {
    onlyKeys(value, ['on', 'kind', 'select', 'limit'], name);
    plainObject(value.on, 'join on');
    onlyKeys(value.on, ['left', 'right'], 'join on');
    field(value.on.left, 'join left field');
    field(value.on.right, 'join right field');
    if (value.kind !== undefined && !['inner', 'left'].includes(value.kind)) {
      throw new ResearchMemoryError('join kind must be inner or left.');
    }
    return {
      on: { left: value.on.left, right: value.on.right },
      kind: value.kind ?? 'inner',
      select: fieldMappings(value.select, 'join select'),
      limit: limit(value.limit),
    };
  }
  if (name === 'aggregate') {
    onlyKeys(value, ['by', 'aggregations', 'limit'], name);
    const by = fieldMappings(value.by ?? [], 'aggregate by', true);
    if (!Array.isArray(value.aggregations) || value.aggregations.length === 0) {
      throw new ResearchMemoryError('aggregate aggregations must be a non-empty array.');
    }
    const aggregations = value.aggregations.map((item) => {
      plainObject(item, 'aggregation');
      onlyKeys(item, ['name', 'operation', 'field', 'limit'], 'aggregation');
      nameValue(item.name, 'aggregation name');
      if (!['count', 'countDistinct', 'collect', 'sample', 'min', 'max', 'sum']
        .includes(item.operation)) {
        throw new ResearchMemoryError(`Unsupported aggregation: ${item.operation}.`);
      }
      if (item.operation !== 'count') field(item.field, `${item.operation} field`);
      return {
        name: item.name,
        operation: item.operation,
        ...(item.field === undefined ? {} : { field: item.field }),
        ...(['collect', 'sample'].includes(item.operation)
          ? { limit: limit(item.limit) } : {}),
      };
    });
    uniqueNames([...by, ...aggregations]);
    return { by, aggregations, limit: limit(value.limit) };
  }
  onlyKeys(value, ['fields'], name);
  if (!Array.isArray(value.fields) || value.fields.length === 0) {
    throw new ResearchMemoryError('derive fields must be a non-empty array.');
  }
  const derived = value.fields.map((item) => {
    plainObject(item, 'derived field');
    onlyKeys(item, ['name', 'expression'], 'derived field');
    nameValue(item.name, 'derived field name');
    return { name: item.name, expression: normalizeExpression(item.expression) };
  });
  uniqueNames(derived);
  return { fields: derived };
}

function applyFilter(relation, operation) {
  return researchRelation(
    relation.rows.filter((row) => matches(row.values, operation.where)).slice(0, operation.limit),
    {},
  );
}

function applyProject(relation, operation) {
  return researchRelation(relation.rows.slice(0, operation.limit).map((row) => ({
    ...row,
    values: Object.fromEntries(operation.fields.map(({ field: source, name }) => (
      [name, clone(row.values[source] ?? null)]
    ))),
    references: Object.fromEntries(operation.fields.flatMap(({ field: source, name }) => (
      row.references?.[source] ? [[name, row.references[source]]] : []
    ))),
  })), {});
}

function applyDistinct(relation, operation) {
  const seen = new Set();
  const rows = [];
  for (const row of relation.rows) {
    const key = stable(operation.by.map((name) => row.values[name] ?? null));
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
    if (rows.length === operation.limit) break;
  }
  return researchRelation(rows, {});
}

function applySort(relation, operation) {
  const rows = relation.rows.map((row, index) => ({ row, index }));
  rows.sort((left, right) => {
    for (const { field: name, direction } of operation.by) {
      const order = compare(left.row.values[name], right.row.values[name]);
      if (order) return direction === 'descending' ? -order : order;
    }
    return left.index - right.index;
  });
  return researchRelation(rows.map(({ row }) => row), {});
}

function applySlice(relation, operation) {
  return researchRelation(
    relation.rows.slice(operation.offset, operation.offset + operation.limit),
    { window: operation, totalCount: relation.rows.length },
  );
}

function applyJoin(left, right, operation) {
  const index = new Map();
  for (const row of right.rows) {
    const key = stable(row.values[operation.on.right] ?? null);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  const rows = [];
  for (const leftRow of left.rows) {
    const matches = index.get(stable(leftRow.values[operation.on.left] ?? null)) ?? [];
    if (matches.length === 0 && operation.kind === 'left') {
      rows.push({
        ...leftRow,
        values: {
          ...leftRow.values,
          ...Object.fromEntries(operation.select.map(({ name }) => [name, null])),
        },
        references: clone(leftRow.references ?? {}),
      });
    }
    for (const rightRow of matches) {
      rows.push({
        values: {
          ...leftRow.values,
          ...Object.fromEntries(operation.select.map(({ field: source, name }) => (
            [name, clone(rightRow.values[source] ?? null)]
          ))),
        },
        references: {
          ...(leftRow.references ?? {}),
          ...Object.fromEntries(operation.select.flatMap(({ field: source, name }) => (
            rightRow.references?.[source] ? [[name, rightRow.references[source]]] : []
          ))),
        },
        subjects: uniqueJson([...leftRow.subjects, ...rightRow.subjects]),
        reasons: uniqueJson([...leftRow.reasons, ...rightRow.reasons]),
        provenance: uniqueJson([...leftRow.provenance, ...rightRow.provenance]),
      });
      if (rows.length === operation.limit) return researchRelation(rows, {});
    }
  }
  return researchRelation(rows.slice(0, operation.limit), {});
}

function applyAggregate(relation, operation) {
  const groups = new Map();
  for (const row of relation.rows) {
    const values = Object.fromEntries(operation.by.map(({ field: source, name }) => (
      [name, clone(row.values[source] ?? null)]
    )));
    const key = stable(values);
    if (!groups.has(key)) groups.set(key, { values, rows: [] });
    groups.get(key).rows.push(row);
  }
  const rows = [...groups.values()].slice(0, operation.limit).map((group) => ({
    values: Object.fromEntries([
      ...Object.entries(group.values).flatMap(([name, value]) => (
        boundedAggregateEntries(name, value)
      )),
      ...operation.aggregations.flatMap((aggregation) => {
        const value = aggregate(group.rows, aggregation);
        return ['min', 'max'].includes(aggregation.operation)
          ? boundedAggregateEntries(aggregation.name, value)
          : [[aggregation.name, value]];
      }),
    ]),
    subjects: uniqueJson(group.rows.flatMap((row) => row.subjects)),
    reasons: uniqueJson(group.rows.flatMap((row) => row.reasons)),
    provenance: uniqueJson(group.rows.flatMap((row) => row.provenance)),
  }));
  return researchRelation(rows, {});
}

function applyDerive(relation, operation) {
  return researchRelation(relation.rows.map((row) => ({
    ...row,
    values: {
      ...row.values,
      ...Object.fromEntries(operation.fields.flatMap(({ name, expression }) => {
        const bounded = boundDerived(evaluate(expression, row.values));
        return bounded.truncated ? [
          [name, bounded.value], [`${name}.truncation`, {
            truncated: bounded.truncated,
            ...(bounded.originalLength === undefined
              ? {} : { originalLength: bounded.originalLength }),
          }],
        ] : [[name, bounded.value]];
      })),
    },
  })), {});
}

function applyExplode(relation, operation) {
  const rows = [];
  for (const row of relation.rows) {
    const values = row.values[operation.field];
    if (!Array.isArray(values)) continue;
    for (const [index, value] of values.entries()) {
      const expanded = {
        ...row.values,
        [operation.as]: clone(value),
        [operation.indexAs]: index,
      };
      if (Array.isArray(value)) {
        value.forEach((part, partIndex) => {
          expanded[`${operation.as}.${partIndex}`] = clone(part);
        });
      }
      rows.push({ ...row, values: expanded });
      if (rows.length === operation.limit) return researchRelation(rows, {});
    }
  }
  return researchRelation(rows, {});
}

function applyScan(relation, operation) {
  const rows = [];
  for (const row of relation.rows) {
    const matches = [];
    const matchedTerms = new Set();
    for (const fieldName of operation.fields) {
      const value = row.values[fieldName];
      const text = scanText(value, operation.caseSensitive);
      for (const term of operation.terms) {
        const needle = operation.caseSensitive ? term : term.toLocaleLowerCase();
        const start = scanMatchStart(text, needle, operation.matchMode, operation.caseSensitive);
        if (start < 0) continue;
        matchedTerms.add(term);
        matches.push({
          field: fieldName,
          term,
          ...scanMatch(value, needle, operation.caseSensitive, start),
        });
      }
    }
    if (operation.match === 'all' && matchedTerms.size !== operation.terms.length) continue;
    for (const match of matches) {
      rows.push({
        ...row,
        values: {
          ...row.values,
          'match.field': match.field,
          'match.term': match.term,
          'match.sourceSubject': clone(row.references?.[match.field]?.subject ?? row.subjects[0]),
          'match.excerpt': match.excerpt,
          'match.start': match.start,
          'match.end': match.end,
        },
      });
      if (rows.length === operation.limit) return researchRelation(rows, {});
    }
  }
  return researchRelation(rows, {});
}

function applyBalance(relation, operation) {
  const counts = new Map();
  const rows = [];
  for (const row of relation.rows) {
    const key = stable(operation.by.map((fieldName) => row.values[fieldName] ?? null));
    const count = counts.get(key) ?? 0;
    if (count >= operation.limitPer) continue;
    counts.set(key, count + 1);
    rows.push(row);
    if (rows.length === operation.limit) break;
  }
  return researchRelation(rows, {});
}

function scanText(value, caseSensitive) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return caseSensitive ? text : text.toLocaleLowerCase();
}

function aggregate(rows, operation) {
  if (operation.operation === 'count') return rows.length;
  const values = rows.map((row) => row.values[operation.field]).filter((value) => value != null);
  if (operation.operation === 'countDistinct') return new Set(values.map(stable)).size;
  if (operation.operation === 'collect' || operation.operation === 'sample') {
    const candidates = operation.operation === 'collect' ? uniqueJson(values) : values;
    const bounded = candidates.slice(0, operation.limit).map(boundDerived);
    return {
      values: bounded.map(({ value }) => value),
      truncation: {
        truncated: candidates.length > bounded.length
          || bounded.some((item) => item.truncated === true),
        inputCount: candidates.length,
        retainedCount: bounded.length,
        omittedCount: Math.max(0, candidates.length - bounded.length),
        truncatedValueCount: bounded.filter(({ truncated }) => truncated).length,
      },
    };
  }
  if (operation.operation === 'sum') {
    return values.reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
  }
  if (values.length === 0) return null;
  return values.reduce((best, value) => (
    operation.operation === 'min'
      ? compare(value, best) < 0 ? value : best
      : compare(value, best) > 0 ? value : best
  ));
}

function normalizeExpression(value) {
  plainObject(value, 'derive expression');
  if ('constant' in value) {
    onlyKeys(value, ['constant'], 'constant expression');
    return clone(value);
  }
  if ('field' in value) {
    onlyKeys(value, ['field'], 'field expression');
    field(value.field, 'expression field');
    return clone(value);
  }
  onlyKeys(value, ['operation', 'args'], 'derive expression');
  if (!['add', 'subtract', 'multiply', 'divide', 'coalesce'].includes(value.operation)
      || !Array.isArray(value.args) || value.args.length === 0) {
    throw new ResearchMemoryError('Invalid derive expression.');
  }
  return { operation: value.operation, args: value.args.map(normalizeExpression) };
}

function evaluate(expression, values) {
  if ('constant' in expression) return clone(expression.constant);
  if ('field' in expression) return clone(values[expression.field] ?? null);
  const args = expression.args.map((item) => evaluate(item, values));
  if (expression.operation === 'coalesce') return args.find((item) => item != null) ?? null;
  if (args.some((item) => typeof item !== 'number')) return null;
  if (expression.operation === 'add') return args.reduce((total, value) => total + value, 0);
  if (expression.operation === 'multiply') return args.reduce((total, value) => total * value, 1);
  if (expression.operation === 'subtract') return args.slice(1).reduce(
    (total, value) => total - value, args[0],
  );
  return args.slice(1).reduce((total, value) => value === 0 ? null : total / value, args[0]);
}

function matches(values, predicate) {
  if (predicate.all) return predicate.all.every((part) => matches(values, part));
  if (predicate.any) return predicate.any.some((part) => matches(values, part));
  if (predicate.not) return !matches(values, predicate.not);
  const actual = values[predicate.field];
  if ('equals' in predicate) return stable(actual) === stable(predicate.equals);
  if ('in' in predicate) return predicate.in.some((item) => stable(actual) === stable(item));
  if ('contains' in predicate) {
    return String(actual ?? '').toLocaleLowerCase()
      .includes(predicate.contains.toLocaleLowerCase());
  }
  if ('gte' in predicate) return typeof actual === 'number' && actual >= predicate.gte;
  return typeof actual === 'number' && actual <= predicate.lte;
}

function normalizePredicate(value) {
  plainObject(value, 'relation filter predicate');
  const compositions = ['all', 'any', 'not'].filter((name) => name in value);
  if (compositions.length) {
    if (compositions.length !== 1 || Object.keys(value).length !== 1) {
      throw new ResearchMemoryError('A relation predicate has one composition.');
    }
    const name = compositions[0];
    if (name === 'not') return { not: normalizePredicate(value.not) };
    if (!Array.isArray(value[name]) || value[name].length === 0) {
      throw new ResearchMemoryError(`Relation predicate ${name} must be non-empty.`);
    }
    return { [name]: value[name].map(normalizePredicate) };
  }
  onlyKeys(value, ['field', 'equals', 'in', 'contains', 'gte', 'lte'], 'relation predicate');
  field(value.field, 'relation predicate field');
  const operators = ['equals', 'in', 'contains', 'gte', 'lte'].filter((name) => name in value);
  if (operators.length !== 1) throw new ResearchMemoryError('A relation predicate has one operator.');
  if (operators[0] === 'in' && (!Array.isArray(value.in) || value.in.length === 0)) {
    throw new ResearchMemoryError('Relation predicate in must be a non-empty array.');
  }
  if (operators[0] === 'contains' && typeof value.contains !== 'string') {
    throw new ResearchMemoryError('Relation predicate contains must be a string.');
  }
  if (['gte', 'lte'].includes(operators[0]) && typeof value[operators[0]] !== 'number') {
    throw new ResearchMemoryError(`Relation predicate ${operators[0]} must be a number.`);
  }
  return clone(value);
}

function relationValues(item) {
  return {
    subject: clone(item.subject),
    'subject.type': item.subject.type,
    'subject.id': item.subject.id,
  };
}

function resolveRelation(memory, relation) {
  const unresolved = [];
  const resolutions = new Map();
  for (const [rowIndex, row] of relation.rows.entries()) {
    for (const [name, reference] of Object.entries(row.references ?? {})) {
      const key = stable(reference.subject);
      if (!resolutions.has(key)) resolutions.set(key, memory.inspect(reference.subject));
      const resolution = resolutions.get(key);
      row.values[name] = resolveSourceField(reference, resolution);
      if (!resolution.resolved && name !== 'evidence.resolutionSource') {
        unresolved.push({ row: rowIndex, field: name, subject: reference.subject });
      }
    }
  }
  relation.context = {
    ...(relation.context ?? {}),
    resolution: {
      unresolvedFieldCount: unresolved.length,
      examples: unresolved.slice(0, 20),
      omittedExamples: Math.max(0, unresolved.length - 20),
    },
  };
  return relation;
}

export function resolveRelationForPresentation(memory, relation) {
  return resolveRelation(memory, cloneRelation(relation));
}

function resolveSourceField(reference, resolution) {
  if (reference.field === 'evidence.resolutionSource') return resolution.resolutionSource;
  if (!resolution.resolved) return null;
  if (reference.field === 'observedRelays') {
    return uniqueJson((resolution.provenance ?? []).map(({ relay }) => relay).filter(Boolean));
  }
  const event = resolution.evidence?.event ?? resolution.evidence?.metadataEvent;
  const profile = resolution.evidence?.profile
    ?? (event?.kind === 0 ? parseProfile(event.content) : null);
  const fields = {
    'event.author': event?.pubkey,
    'event.kind': event?.kind,
    'event.text': event?.content,
    'event.createdAt': event?.created_at,
    'event.tags': event?.tags,
    'event.links': event ? linksIn(event.content) : undefined,
    'event.domains': event ? domainsIn(event.content) : undefined,
    'event.hasMedia': event ? hasMedia(event) : undefined,
    'account.name': profile?.name ?? null,
    'account.display_name': profile?.display_name ?? null,
    'account.description': profile?.about ?? null,
    'account.nip05': profile?.nip05 ?? null,
  };
  return clone(fields[reference.field] ?? null);
}

function provenanceReferences(item) {
  if (item.subject.type === 'event' && item.provenance?.length) {
    return [{ type: 'stored-event-observations', eventId: item.subject.id }];
  }
  const metadataEventId = item.record?.metadataEvent?.id;
  if (item.subject.type === 'account' && metadataEventId && item.provenance?.length) {
    return [{ type: 'stored-event-observations', eventId: metadataEventId }];
  }
  return uniqueJson(item.provenance ?? []);
}

function scanMatch(value, needle, caseSensitive, start) {
  const raw = scanText(value, true);
  const excerptStart = Math.max(0, start - 80);
  const excerptEnd = Math.min(raw.length, start + needle.length + 80);
  return {
    excerpt: `${excerptStart > 0 ? '…' : ''}${raw.slice(excerptStart, excerptEnd)}${excerptEnd < raw.length ? '…' : ''}`,
    start,
    end: start + needle.length,
  };
}

function scanMatchStart(text, needle, matchMode, caseSensitive) {
  if (matchMode === 'substring') return text.indexOf(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const expression = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`,
    caseSensitive ? 'u' : 'iu',
  );
  const match = expression.exec(text);
  return match ? match.index + match[1].length : -1;
}

function boundDerived(value) {
  if (typeof value === 'string') {
    return value.length <= MAX_DERIVED_STRING
      ? { value, truncated: false }
      : {
          value: `${value.slice(0, MAX_DERIVED_STRING - 1)}…`,
          truncated: true,
          originalLength: value.length,
        };
  }
  if (Array.isArray(value)) {
    const bounded = value.slice(0, MAX_DERIVED_ARRAY).map(boundDerived);
    return {
      value: bounded.map((item) => item.value),
      truncated: value.length > bounded.length || bounded.some((item) => item.truncated),
    };
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    const bounded = entries.slice(0, MAX_DERIVED_ARRAY)
      .map(([key, item]) => [key, boundDerived(item)]);
    return {
      value: Object.fromEntries(bounded.map(([key, item]) => [key, item.value])),
      truncated: entries.length > bounded.length
        || bounded.some(([, item]) => item.truncated),
    };
  }
  return { value: clone(value), truncated: false };
}

function boundedAggregateEntries(name, value) {
  const bounded = boundDerived(value);
  return [
    [name, bounded.value],
    [`${name}.truncation`, {
      derived: true,
      truncated: bounded.truncated,
      ...(bounded.originalLength === undefined
        ? {} : { originalLength: bounded.originalLength }),
    }],
  ];
}

function linksIn(content) {
  return [...String(content).matchAll(/https?:\/\/[^\s<>"')\]]+/giu)]
    .map(([url]) => url);
}

function domainsIn(content) {
  return uniqueJson(linksIn(content).flatMap((url) => {
    try { return [new URL(url).hostname.toLocaleLowerCase()]; } catch { return []; }
  }));
}

function hasMedia(event) {
  if (event.tags.some((tag) => (
    tag[0] === 'imeta'
    || (tag[0] === 'm' && typeof tag[1] === 'string'
      && /^(?:audio|image|video)\//iu.test(tag[1]))
  ))) return true;
  return linksIn(event.content).some((value) => {
    try {
      const url = new URL(value);
      const path = url.pathname.toLocaleLowerCase();
      if (/\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|opus|png|svg|wav|webm|webp)$/u
        .test(path)) return true;
      return /(?:^|\.)(?:imgur\.com|nostr\.build|void\.cat|youtube\.com|youtu\.be|vimeo\.com|soundcloud\.com)$/u
        .test(url.hostname.toLocaleLowerCase());
    } catch {
      return false;
    }
  });
}

function parseProfile(content) {
  try {
    const profile = JSON.parse(content);
    return profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : null;
  } catch {
    return null;
  }
}

function researchRelation(rows, context) {
  return {
    type: 'research-relation',
    kind: 'relation',
    rows: rows.map((row) => ({
      values: Object.fromEntries(Object.entries(row.values ?? {})
        .filter(([name]) => !(name in (row.references ?? {})))
        .map(([name, value]) => [name, clone(value)])),
      references: clone(row.references ?? {}),
      subjects: uniqueJson(row.subjects ?? []),
      reasons: uniqueJson(row.reasons ?? []),
      provenance: uniqueJson(row.provenance ?? []),
    })),
    context: clone(context),
  };
}

function cloneRelation(value) {
  if (!isResearchRelation(value)) throw new ResearchMemoryError('A research relation is required.');
  return researchRelation(value.rows, value.context ?? {});
}

function relationDescriptor() {
  return { kind: 'relation', itemKind: 'relation', resultKind: 'relation' };
}

function fieldMappings(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new ResearchMemoryError(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`);
  }
  const result = value.map((item) => {
    if (typeof item === 'string') return { field: item, name: item };
    plainObject(item, `${label} field`);
    onlyKeys(item, ['field', 'name'], `${label} field`);
    field(item.field, `${label} field`);
    nameValue(item.name, `${label} name`);
    return { field: item.field, name: item.name };
  });
  uniqueNames(result);
  return result;
}

function fields(value, label) {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value) || value.length === 0) {
    throw new ResearchMemoryError(`${label} must be a field or non-empty field array.`);
  }
  value.forEach((item) => field(item, label));
  return [...new Set(value)];
}

function field(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new ResearchMemoryError(`${label} must be a non-empty trimmed string.`);
  }
}

function nameValue(value, label) {
  field(value, label);
}

function uniqueNames(values) {
  const names = values.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new ResearchMemoryError('Field names must be unique.');
}

function limit(value) {
  if (value === undefined) return 100;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new ResearchMemoryError(`limit must be an integer from 1 to ${MAX_LIMIT}.`);
  }
  return value;
}

function exactInputs(inputs, names, operation) {
  plainObject(inputs, `${operation} inputs`);
  const actual = Object.keys(inputs).sort();
  const expected = [...names].sort();
  if (stable(actual) !== stable(expected)) {
    throw new ResearchMemoryError(`${operation} inputs must be ${expected.join(', ')}.`);
  }
}

function noKeys(value, label) {
  onlyKeys(value, [], label);
}

function onlyKeys(value, allowed, label) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new ResearchMemoryError(`Unknown ${label} field: ${unknown}.`);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ResearchMemoryError(`${label} must be a plain object.`);
  }
}

function compare(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return stable(left).localeCompare(stable(right));
}

function uniqueJson(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = stable(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(clone);
}

function stable(value) {
  return JSON.stringify(sort(clone(value)));
}

function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

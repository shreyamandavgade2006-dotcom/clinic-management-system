'use strict';

/**
 * A tiny, dependency-free in-memory engine that implements the small subset of the
 * Mongoose model API used by this project (`find`, `findOne`, `create`, `findByIdAndUpdate`,
 * `populate`, `sort`, `limit`, ...).
 *
 * Why does it exist?
 *   The full application is written against MongoDB + Mongoose (see `src/models`).
 *   When no MongoDB server is reachable (fresh laptop, CI, online demo) the API boots with
 *   this store instead so every screen stays usable. The business logic, routes and
 *   controllers are 100% identical in both modes.
 */

const crypto = require('crypto');

/* ------------------------------------------------------------------ *
 * value helpers
 * ------------------------------------------------------------------ */

/** 24-char hex id, shaped exactly like a MongoDB ObjectId string. */
const newId = () => crypto.randomBytes(12).toString('hex');

const isObjectIdLike = (value) =>
  !!value && typeof value === 'object' && typeof value.toHexString === 'function';

const idStr = (value) => {
  if (value === null || value === undefined) return '';
  if (isObjectIdLike(value)) return value.toHexString();
  return String(value);
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !isObjectIdLike(value) &&
  !Buffer.isBuffer(value);

const clone = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (isPlainObject(value)) {
    const copy = {};
    for (const [key, val] of Object.entries(value)) copy[key] = clone(val);
    return copy;
  }
  return value;
};

const someValue = (value) => (Array.isArray(value) ? value : [value]);

const looseEqual = (a, b) => {
  if (a instanceof Date || b instanceof Date) {
    const left = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const right = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return left === right;
  }
  if (isObjectIdLike(a) || isObjectIdLike(b)) return idStr(a) === idStr(b);
  if (isPlainObject(a) || isPlainObject(b)) return JSON.stringify(a) === JSON.stringify(b);
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return idStr(a) === idStr(b);
};

const compare = (left, right) => {
  const a = left instanceof Date ? left.getTime() : isObjectIdLike(left) ? idStr(left) : left;
  const b = right instanceof Date ? right.getTime() : isObjectIdLike(right) ? idStr(right) : right;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number' && !Number.isNaN(Number(b))) return a - Number(b);
  return idStr(a).localeCompare(idStr(b));
};

const getPath = (doc, path) => {
  if (!path.includes('.')) return doc ? doc[path] : undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) return acc.map((item) => (item ? item[key] : undefined)).filter((v) => v !== undefined);
    return acc[key];
  }, doc);
};

const setPath = (doc, path, value) => {
  const keys = path.split('.');
  let cursor = doc;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!isPlainObject(cursor[key]) && !Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return doc;
};

const unsetPath = (doc, path) => {
  const keys = path.split('.');
  let cursor = doc;
  for (let i = 0; i < keys.length - 1; i += 1) {
    cursor = cursor?.[keys[i]];
    if (!cursor) return doc;
  }
  delete cursor[keys[keys.length - 1]];
  return doc;
};

/* ------------------------------------------------------------------ *
 * query matching
 * ------------------------------------------------------------------ */

function matchCondition(docValue, condition) {
  if (condition instanceof RegExp) {
    return someValue(docValue).some((v) => condition.test(idStr(v)));
  }

  if (isPlainObject(condition)) {
    const operators = Object.keys(condition).filter((key) => key.startsWith('$'));
    if (operators.length === 0) {
      // exact match against an embedded document
      return looseEqual(docValue, condition);
    }
    return operators.every((op) => {
      const expected = condition[op];
      const values = someValue(docValue);
      switch (op) {
        case '$eq':
          return values.some((v) => looseEqual(v, expected));
        case '$ne':
          return !values.some((v) => looseEqual(v, expected));
        case '$in':
          return values.some((v) => (expected || []).some((e) => looseEqual(v, e)));
        case '$nin':
          return !values.some((v) => (expected || []).some((e) => looseEqual(v, e)));
        case '$gt':
          return values.some((v) => compare(v, expected) > 0);
        case '$gte':
          return values.some((v) => compare(v, expected) >= 0);
        case '$lt':
          return values.some((v) => compare(v, expected) < 0);
        case '$lte':
          return values.some((v) => compare(v, expected) <= 0);
        case '$exists':
          return expected ? docValue !== undefined && docValue !== null : docValue === undefined || docValue === null;
        case '$regex': {
          const flags = condition.$options || '';
          const regex = expected instanceof RegExp ? expected : new RegExp(expected, flags);
          return someValue(docValue).some((v) => regex.test(idStr(v)));
        }
        case '$size':
          return Array.isArray(docValue) && docValue.length === expected;
        case '$all':
          return values.length > 0 && (expected || []).every((e) => values.some((v) => looseEqual(v, e)));
        case '$elemMatch':
          return Array.isArray(docValue) && docValue.some((item) => matches(item, expected));
        case '$not':
          return !matchCondition(docValue, expected);
        default:
          return true;
      }
    });
  }

  return someValue(docValue).some((v) => looseEqual(v, condition));
}

function matches(doc, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return (condition || []).some((sub) => matches(doc, sub));
    if (key === '$and') return (condition || []).every((sub) => matches(doc, sub));
    if (key === '$nor') return !(condition || []).some((sub) => matches(doc, sub));
    if (key === '$where' || key === '$expr') return true;
    return matchCondition(getPath(doc, key), condition);
  });
}

/* ------------------------------------------------------------------ *
 * projections / sorting
 * ------------------------------------------------------------------ */

function project(doc, select) {
  if (!select) return doc;
  if (typeof select === 'string') {
    // "+password" style selectors force-include a field that the schema hides with
    // `select: false`. The in-memory store always keeps the full document, so these
    // are simply ignored — which matches what the caller wanted anyway.
    const parts = select
      .split(/[\s,]+/)
      .filter(Boolean)
      .filter((part) => !part.startsWith('+'));
    if (parts.length === 0) return doc;
    const includes = parts.filter((p) => !p.startsWith('-'));
    const excludes = parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1));
    let result = includes.length ? {} : clone(doc);
    if (includes.length) for (const path of includes) result = setPath(result, path, clone(getPath(doc, path)));
    for (const path of excludes) unsetPath(result, path);
    if (includes.length > 1 || !includes.includes('_id')) {
      // keep _id unless explicitly excluded
      if (!excludes.includes('_id') && includes.length && result._id === undefined) result._id = doc._id;
    }
    return result;
  }
  const entries = Object.entries(select);
  const excludes = entries.filter(([, v]) => v === 0 || v === false).map(([k]) => k);
  const includes = entries.filter(([, v]) => v === 1 || v === true).map(([k]) => k);
  let result = includes.length ? {} : clone(doc);
  if (includes.length) for (const path of includes) result = setPath(result, path, clone(getPath(doc, path)));
  for (const path of excludes) unsetPath(result, path);
  if (!excludes.includes('_id') && !includes.includes('_id')) result._id = doc._id;
  return result;
}

function sortDocs(docs, spec) {
  if (!spec) return docs;
  const rules = Array.isArray(spec)
    ? spec.map((entry) => Object.entries(entry)[0])
    : Object.entries(spec);
  return [...docs].sort((a, b) => {
    for (const [field, direction] of rules) {
      const dir = direction === 'desc' || direction === -1 || direction === '-1' ? -1 : 1;
      const diff = compare(getPath(a, field), getPath(b, field));
      if (diff !== 0) return diff * dir;
    }
    return 0;
  });
}

/* ------------------------------------------------------------------ *
 * updates
 * ------------------------------------------------------------------ */

const isOperatorUpdate = (update) =>
  Object.keys(update || {}).some((key) => key.startsWith('$'));

function applyUpdate(doc, update) {
  if (!update) return doc;
  if (!isOperatorUpdate(update)) {
    for (const [key, value] of Object.entries(update)) {
      if (key === '_id') continue;
      setPath(doc, key, clone(value));
    }
    return doc;
  }

  for (const [op, payload] of Object.entries(update)) {
    switch (op) {
      case '$set':
        for (const [key, value] of Object.entries(payload)) setPath(doc, key, clone(value));
        break;
      case '$unset':
        for (const key of Object.keys(payload)) unsetPath(doc, key);
        break;
      case '$setOnInsert':
        break; // handled by caller for upserts
      case '$inc':
        for (const [key, value] of Object.entries(payload)) setPath(doc, key, (Number(getPath(doc, key)) || 0) + Number(value));
        break;
      case '$push': {
        for (const [key, value] of Object.entries(payload)) {
          if (!Array.isArray(getPath(doc, key))) setPath(doc, key, []);
          const list = getPath(doc, key);
          if (isPlainObject(value) && value.$each) list.push(...clone(value.$each));
          else list.push(clone(value));
        }
        break;
      }
      case '$addToSet': {
        for (const [key, value] of Object.entries(payload)) {
          if (!Array.isArray(getPath(doc, key))) setPath(doc, key, []);
          const list = getPath(doc, key);
          const items = isPlainObject(value) && value.$each ? value.$each : [value];
          for (const item of items) {
            if (!list.some((existing) => looseEqual(existing, item))) list.push(clone(item));
          }
        }
        break;
      }
      case '$pull': {
        for (const [key, value] of Object.entries(payload)) {
          const list = getPath(doc, key);
          if (!Array.isArray(list)) break;
          const kept = list.filter((item) => !(isPlainObject(value) ? matches(item, value) : someValue(value).some((v) => looseEqual(item, v))));
          setPath(doc, key, kept);
        }
        break;
      }
      case '$min':
      case '$max': {
        for (const [key, value] of Object.entries(payload)) {
          const current = getPath(doc, key);
          const shouldSet = op === '$min' ? current === undefined || compare(value, current) < 0 : current === undefined || compare(value, current) > 0;
          if (shouldSet) setPath(doc, key, clone(value));
        }
        break;
      }
      default:
        break;
    }
  }
  return doc;
}

/* ------------------------------------------------------------------ *
 * query object (thenable, mimics the Mongoose chained API we use)
 * ------------------------------------------------------------------ */

class MemoryQuery {
  constructor(executor, options = {}) {
    this._executor = executor;
    this._options = { ...options };
    this._populateSpecs = [];
  }

  sort(spec) {
    this._options.sort = spec;
    return this;
  }

  skip(count) {
    this._options.skip = count;
    return this;
  }

  limit(count) {
    this._options.limit = count;
    return this;
  }

  select(spec) {
    this._options.select = spec;
    return this;
  }

  lean() {
    this._options.lean = true;
    return this;
  }

  populate(pathOrSpec, select) {
    // Mongoose accepts a path, a spec object, or an array of specs
    const specs = Array.isArray(pathOrSpec) ? pathOrSpec : [pathOrSpec];
    specs.forEach((entry) => {
      if (!entry) return;
      this._populateSpecs.push(typeof entry === 'string' ? { path: entry, select } : entry);
    });
    return this;
  }

  async exec() {
    const result = await this._executor();
    const isMany = Array.isArray(result);
    // IMPORTANT: always work on deep copies so that `populate()` and projections can never
    // mutate the documents held in the store (a real driver returns fresh documents too).
    let docs = isMany ? result.map(clone) : result ? clone(result) : result;

    if (isMany) {
      docs = sortDocs(docs, this._options.sort);
      if (this._options.skip) docs = docs.slice(this._options.skip);
      if (this._options.limit) docs = docs.slice(0, this._options.limit);
    }

    if (this._populateSpecs.length) docs = await populateDocs(docs, this._populateSpecs);

    const forced = forcedSelectPaths(this._options.select);
    const finalise = (doc) =>
      decorate(applyHidden(this._options.select ? project(doc, this._options.select) : clone(doc), forced));
    return isMany ? docs.map(finalise) : docs ? finalise(docs) : docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(handler) {
    return this.exec().finally(handler);
  }
}

/* ------------------------------------------------------------------ *
 * populate support
 * ------------------------------------------------------------------ */

async function populateDocs(docs, specs) {
  const target = Array.isArray(docs) ? docs : [docs];
  for (const spec of specs) {
    const paths = Array.isArray(spec.path) ? spec.path : [spec.path];
    for (const path of paths) {
      if (!path) continue;
      const modelName = spec.model || resolveRef(target[0], path);
      const Model = modelName ? getModel(modelName) : null;
      if (!Model) continue;
      const ids = new Set();
      target.forEach((doc) => {
        const value = getPath(doc, path);
        someValue(value).forEach((v) => {
          if (v) ids.add(idStr(v));
        });
      });
      if (ids.size === 0) continue;
      const related = await Model.find({ _id: { $in: [...ids] } }).exec();
      const index = new Map(related.map((doc) => [idStr(doc._id), doc]));
      target.forEach((doc) => {
        const value = getPath(doc, path);
        if (Array.isArray(value)) {
          setPath(
            doc,
            path,
            value.map((v) => index.get(idStr(v)) || v)
          );
        } else if (value !== undefined && value !== null) {
          setPath(doc, path, index.get(idStr(value)) || value);
        }
      });
      // supports `populate: { path: 'user', select: 'name' }` inside a populate spec
      const nestedSpecs = spec.populate ? (Array.isArray(spec.populate) ? spec.populate : [spec.populate]) : [];
      if (nestedSpecs.length) {
        await Promise.all(
          target.map(async (doc) => {
            const value = getPath(doc, path);
            const nestedTargets = (Array.isArray(value) ? value : [value]).filter(
              (v) => isPlainObject(v) && v.__modelName
            );
            if (nestedTargets.length) await populateDocs(nestedTargets, nestedSpecs);
          })
        );
      }

      if (spec.select) {
        target.forEach((doc) => {
          const value = getPath(doc, path);
          if (Array.isArray(value)) {
            setPath(doc, path, value.map((v) => (isPlainObject(v) ? project(v, spec.select) : v)));
          } else if (isPlainObject(value)) {
            setPath(doc, path, project(value, spec.select));
          }
        });
      }
    }
  }
  return docs;
}

const refResolvers = new Map();
const resolveRef = (doc, path) => {
  if (!doc) return null;
  const resolver = refResolvers.get(doc.__modelName);
  if (!resolver) return null;
  return resolver(path.split('.')[0]);
};

/* ------------------------------------------------------------------ *
 * model factory
 * ------------------------------------------------------------------ */

const registry = new Map();

/** name -> { methods, virtuals, hidden: [paths with `select: false`] } */
const modelMeta = new Map();

/** Attaches Mongoose schema methods/virtuals to a plain document. */
function decorate(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const meta = modelMeta.get(doc.__modelName);
  if (!meta) return doc;

  for (const [key, fn] of Object.entries(meta.methods || {})) {
    if (typeof fn !== 'function' || Object.prototype.hasOwnProperty.call(doc, key)) continue;
    Object.defineProperty(doc, key, {
      value: fn.bind(doc),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  for (const [key, virtual] of Object.entries(meta.virtuals || {})) {
    const getter = virtual && typeof virtual.get === 'function' ? virtual.get : null;
    if (!getter || key === 'id') continue;
    Object.defineProperty(doc, key, {
      get: () => getter.call(doc),
      enumerable: false,
      configurable: true,
    });
  }

  return doc;
}

/** Removes `select: false` fields (e.g. password) unless explicitly force-selected. */
function applyHidden(doc, forcedPaths = []) {
  const meta = modelMeta.get(doc && doc.__modelName);
  if (!meta || !meta.hidden.length) return doc;
  meta.hidden.forEach((path) => {
    if (!forcedPaths.includes(path)) delete doc[path];
  });
  return doc;
}

const forcedSelectPaths = (select) => {
  if (typeof select !== 'string') return [];
  return select
    .split(/[\s,]+/)
    .filter((part) => part.startsWith('+'))
    .map((part) => part.slice(1));
};

let externalResolver = null;

/** Allows the model factory to lazily create referenced models during `populate`. */
const setModelResolver = (fn) => {
  externalResolver = fn;
};

const getModel = (name) => {
  const local = registry.get(name);
  if (local) return local;
  if (externalResolver) {
    try {
      return externalResolver(name) || null;
    } catch (error) {
      return null;
    }
  }
  return null;
};

function extractFields(schema) {
  const fields = {};
  const paths = schema.paths || {};
  for (const [path, schemaType] of Object.entries(paths)) {
    if (path === '__v') continue;
    const instance = schemaType.instance;
    const options = schemaType.options || {};
    const entry = {
      instance,
      ref: options.ref || null,
      required: !!options.required,
      default: options.default,
      isArray: instance === 'Array' || instance === 'DocumentArray',
    };
    if (entry.isArray && schemaType.caster) {
      entry.casterInstance = schemaType.caster.instance;
      entry.ref = entry.ref || (schemaType.caster.options && schemaType.caster.options.ref) || null;
    }
    if (entry.isArray && schemaType.caster && schemaType.caster.schema) {
      entry.subFields = extractFields(schemaType.caster.schema);
    }
    fields[path] = entry;
  }
  return fields;
}

function buildDefaults(fields) {
  const doc = {};
  for (const [path, field] of Object.entries(fields)) {
    if (path === '_id') continue;
    if (field.default !== undefined) {
      doc[path] = typeof field.default === 'function' ? field.default() : clone(field.default);
      continue;
    }
    if (field.isArray) doc[path] = [];
  }
  return doc;
}

function createMemoryModel(name, schema) {
  const fields = extractFields(schema);
  const timestamps = !!(schema.options && schema.options.timestamps);
  const store = [];

  modelMeta.set(name, {
    methods: schema.methods || {},
    virtuals: schema.virtuals || {},
    hidden: Object.entries(schema.paths || {})
      .filter(([path, type]) => type.options && type.options.select === false && path !== '__v')
      .map(([path]) => path),
  });

  registry.set(name, null); // placeholder while compiling
  refResolvers.set(name, (path) => (fields[path] ? fields[path].ref : null));

  const applySubDefaults = (doc) => {
    for (const [path, field] of Object.entries(fields)) {
      if (!field.subFields || !Array.isArray(doc[path])) continue;
      doc[path] = doc[path].map((item) => {
        const merged = { ...buildDefaults(field.subFields), ...item };
        // Mongoose gives every sub-document an _id — mimic that so quiz questions,
        // attendance days etc. can be referenced individually.
        if (!merged._id) merged._id = newId();
        return merged;
      });
    }
    return doc;
  };

  const hydrate = (input) => {
    const doc = { ...buildDefaults(fields), ...clone(input) };
    if (!doc._id) doc._id = newId();
    doc._id = idStr(doc._id);
    if (timestamps) {
      const now = new Date();
      if (!doc.createdAt) doc.createdAt = now;
      doc.updatedAt = now;
    }
    doc.__modelName = name;
    return applySubDefaults(doc);
  };

  const validate = (doc) => {
    for (const [path, field] of Object.entries(fields)) {
      if (path === '_id' || !field.required || field.default !== undefined) continue;
      const value = doc[path];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) {
        const error = new Error(`${name} validation failed: ${path} is required`);
        error.name = 'ValidationError';
        throw error;
      }
    }
    return doc;
  };

  const deinternalise = (doc) => {
    if (!doc) return doc;
    const copy = clone(doc);
    copy.__modelName = doc.__modelName;
    const decorated = decorate(applyHidden(copy, []));
    delete decorated.__modelName;
    return decorated;
  };

  const runPopulate = (docs, specs) => {
    const list = Array.isArray(docs) ? docs : [docs];
    return populateDocs(list, specs).then((result) => (Array.isArray(docs) ? result : result[0]));
  };

  const Model = {
    modelName: name,
    schema,
    get collectionLength() {
      return store.length;
    },

    find(filter = {}, projection, options = {}) {
      return new MemoryQuery(() => store.filter((doc) => matches(doc, filter)), {
        select: projection || options.select,
      });
    },

    findOne(filter = {}, projection) {
      return new MemoryQuery(() => {
        const found = store.find((doc) => matches(doc, filter));
        return found || null;
      }, { select: projection });
    },

    findById(id, projection) {
      return new MemoryQuery(() => store.find((doc) => looseEqual(doc._id, id)) || null, {
        select: projection,
      });
    },

    async create(input) {
      if (Array.isArray(input)) return Promise.all(input.map((item) => Model.create(item)));
      const doc = validate(hydrate(input));
      store.push(doc);
      return deinternalise(doc);
    },

    async insertMany(items) {
      return Promise.all(items.map((item) => Model.create(item)));
    },

    async countDocuments(filter = {}) {
      return store.filter((doc) => matches(doc, filter)).length;
    },

    async estimatedDocumentCount() {
      return store.length;
    },

    async distinct(field, filter = {}) {
      const seen = new Map();
      store
        .filter((doc) => matches(doc, filter))
        .forEach((doc) => {
          someValue(getPath(doc, field)).forEach((value) => {
            if (value !== undefined && value !== null) seen.set(idStr(value), value);
          });
        });
      return [...seen.values()];
    },

    async exists(filter = {}) {
      const found = store.find((doc) => matches(doc, filter));
      return found ? { _id: found._id } : null;
    },

    async updateOne(filter = {}, update = {}, options = {}) {
      let doc = store.find((item) => matches(item, filter));
      let upsertedId = null;
      if (!doc && (options.upsert || filter._id)) {
        doc = hydrate({ ...filter, ...(update.$setOnInsert || {}) });
        store.push(doc);
        upsertedId = doc._id;
      }
      if (doc) {
        applyUpdate(doc, update);
        if (timestamps) doc.updatedAt = new Date();
      }
      return { acknowledged: true, matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0, upsertedId };
    },

    async updateMany(filter = {}, update = {}) {
      const targets = store.filter((doc) => matches(doc, filter));
      targets.forEach((doc) => {
        applyUpdate(doc, update);
        if (timestamps) doc.updatedAt = new Date();
      });
      return { acknowledged: true, matchedCount: targets.length, modifiedCount: targets.length };
    },

    /**
     * Like Mongoose, this returns a Query (thenable that also supports `.populate()`,
     * `.select()` and `.lean()`) rather than a bare promise.
     */
    findOneAndUpdate(filter = {}, update = {}, options = {}) {
      return new MemoryQuery(
        async () => {
          let doc = store.find((item) => matches(item, filter));
          if (!doc && options.upsert) {
            doc = hydrate({ ...filter, ...(update.$setOnInsert || {}) });
            store.push(doc);
          }
          if (!doc) return null;
          applyUpdate(doc, update);
          if (timestamps) doc.updatedAt = new Date();
          return doc;
        },
        { select: options.select }
      );
    },

    findByIdAndUpdate(id, update = {}, options = {}) {
      return Model.findOneAndUpdate({ _id: id }, update, options);
    },

    async deleteOne(filter = {}) {
      const index = store.findIndex((doc) => matches(doc, filter));
      if (index === -1) return { acknowledged: true, deletedCount: 0 };
      store.splice(index, 1);
      return { acknowledged: true, deletedCount: 1 };
    },

    async deleteMany(filter = {}) {
      const kept = store.filter((doc) => !matches(doc, filter));
      const removed = store.length - kept.length;
      store.length = 0;
      store.push(...kept);
      return { acknowledged: true, deletedCount: removed };
    },

    async findByIdAndDelete(id) {
      const doc = store.find((item) => looseEqual(item._id, id));
      if (!doc) return null;
      await Model.deleteOne({ _id: doc._id });
      return deinternalise(doc);
    },

    async findOneAndDelete(filter = {}) {
      const doc = store.find((item) => matches(item, filter));
      if (!doc) return null;
      await Model.deleteOne({ _id: doc._id });
      return deinternalise(doc);
    },

    /** naive $lookup-free aggregation used by a couple of analytics helpers */
    async aggregate(pipeline = []) {
      let docs = store.map((doc) => clone(doc));
      for (const stage of pipeline) {
        if (stage.$match) docs = docs.filter((doc) => matches(doc, stage.$match));
        else if (stage.$sort) docs = sortDocs(docs, stage.$sort);
        else if (stage.$limit) docs = docs.slice(0, stage.$limit);
        else if (stage.$skip) docs = docs.slice(stage.$skip);
        else if (stage.$group && stage.$group._id) {
          const grouped = new Map();
          for (const doc of docs) {
            const key = idStr(getPath(doc, stage.$group._id));
            if (!grouped.has(key)) grouped.set(key, { _id: getPath(doc, stage.$group._id), docs: [] });
            grouped.get(key).docs.push(doc);
          }
          docs = [...grouped.values()].map(({ _id, docs: group }) => {
            const out = { _id };
            for (const [field, expression] of Object.entries(stage.$group)) {
              if (field === '_id') continue;
              if (expression && expression.$sum !== undefined) {
                out[field] = group.reduce((sum, doc) => sum + (Number(getPath(doc, expression.$sum)) || 0), 0);
              } else if (expression && expression.$avg !== undefined) {
                const values = group.map((doc) => Number(getPath(doc, expression.$avg)) || 0);
                out[field] = values.reduce((a, b) => a + b, 0) / (values.length || 1);
              } else if (expression && expression.$max !== undefined) {
                out[field] = group.reduce((max, doc) => Math.max(max, Number(getPath(doc, expression.$max)) || 0), -Infinity);
              } else if (expression && expression.$min !== undefined) {
                out[field] = group.reduce((min, doc) => Math.min(min, Number(getPath(doc, expression.$min)) || 0), Infinity);
              } else if (expression && expression.$push !== undefined) {
                out[field] = group.map((doc) => getPath(doc, expression.$push));
              }
            }
            return out;
          });
        }
      }
      return docs;
    },

    /* used only by the seeder / memory-mode admin helpers */
    async __reset() {
      store.length = 0;
    },
  };

  registry.set(name, Model);
  return Model;
}

module.exports = {
  createMemoryModel,
  getModel,
  setModelResolver,
  MemoryQuery,
  __internals: { matches, applyUpdate, project, sortDocs, newId },
};

'use strict';

const mongoose = require('mongoose');
const { createMemoryModel, setModelResolver } = require('./memoryDb');

let memoryMode = false;
const definitions = new Map(); // name -> { schema, mongooseModel?, memoryModel?, extras: {} }
const proxies = new Map();

const resolveModel = (name) => {
  const definition = definitions.get(name);
  if (!definition) return null;

  if (memoryMode) {
    if (!definition.memoryModel) definition.memoryModel = createMemoryModel(name, definition.schema);
    return definition.memoryModel;
  }

  if (!definition.mongooseModel) {
    definition.mongooseModel = mongoose.models[name] || mongoose.model(name, definition.schema);
  }
  return definition.mongooseModel;
};

// lets the in-memory engine lazily resolve referenced models for `populate`
setModelResolver(resolveModel);

const setMemoryMode = (value) => {
  memoryMode = !!value;
};
const isMemoryMode = () => memoryMode;

/**
 * Defines a model exactly like `mongoose.model(name, schema)`, but the returned object is a
 * proxy that resolves to the currently active backend: a real Mongoose model, or the
 * lightweight in-memory engine when MongoDB is unavailable.
 *
 * Because resolution happens on every property access, models can be required before the
 * database connection mode is known — controllers never have to care.
 */
function defineModel(name, schema) {
  if (proxies.has(name)) return proxies.get(name);

  definitions.set(name, { schema });

  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__isModelProxy') return true;
        if (prop === 'modelName') return name;
        if (prop === 'schema') return schema;

        const definition = definitions.get(name);
        if (definition.extras && prop in definition.extras) return definition.extras[prop];

        const model = resolveModel(name);
        if (!model) return undefined;
        const value = model[prop];
        return typeof value === 'function' ? value.bind(model) : value;
      },

      set(_target, prop, value) {
        const definition = definitions.get(name);
        definition.extras = definition.extras || {};
        definition.extras[prop] = value;
        const model = resolveModel(name);
        if (model && !(prop in model)) {
          try {
            model[prop] = value;
          } catch (error) {
            /* read-only property — the extras map already has it */
          }
        }
        return true;
      },

      has(_target, prop) {
        const definition = definitions.get(name);
        if (definition.extras && prop in definition.extras) return true;
        const model = resolveModel(name);
        return Boolean(model && prop in model);
      },
    }
  );

  proxies.set(name, proxy);
  return proxy;
}

const getModel = (name) => proxies.get(name) || resolveModel(name) || null;

module.exports = { defineModel, getModel, setMemoryMode, isMemoryMode, mongoose };

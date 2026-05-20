#!/usr/bin/env node
'use strict';

var path = require('path');
var os = require('os');
var fs = require('fs');
var crypto = require('crypto');
var child_process = require('child_process');
var events = require('events');
var promises = require('fs/promises');
var url = require('url');
var readline = require('readline');
var qrcode = require('qrcode-terminal');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var qrcode__default = /*#__PURE__*/_interopDefault(qrcode);

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/verifier.ts
function ok(verifier, findings, durationMs) {
  return { verifier, status: "ok", findings, durationMs };
}
function skipped(verifier, reason, durationMs) {
  return { verifier, status: "skipped", reason, findings: [], durationMs };
}
function errored(verifier, reason, durationMs) {
  return { verifier, status: "error", reason, findings: [], durationMs };
}

// node_modules/zod/lib/index.mjs
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (typeof state === "function" ? receiver !== state || true : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (typeof state === "function" ? receiver !== state || true : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return state.set(receiver, value), value;
}
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache;
var _ZodNativeEnum_cache;
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this, this._def);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a, _b;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
      local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === void 0 ? void 0 : options.position,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * @deprecated Use z.string().min(1) instead.
   * @see {@link ZodString.min}
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache)) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values));
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache).has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache)) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)));
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache).has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function custom(check, params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      if (!check(data)) {
        const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a = p.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
        const p2 = typeof p === "string" ? { message: p } : p;
        ctx.addIssue({ code: "custom", ...p2, fatal: _fatal });
      }
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// src/types.ts
var SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
var SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
};
var VerifierNameSchema = z.enum([
  "semgrep",
  "gitleaks",
  "dep-audit",
  "live-browser",
  "live-lighthouse"
]);
var FindingStatusSchema = z.enum([
  "open",
  "fixed",
  "wont-fix",
  "false-positive",
  "uncertain"
]);
var TrustBoundarySchema = z.enum([
  "user-input",
  "network",
  "filesystem",
  "secrets",
  "process-exec",
  "database",
  "auth",
  "permissions",
  "concurrency",
  "external-api",
  "serialization"
]);
var FindingSchema = z.object({
  verifier: VerifierNameSchema,
  ruleId: z.string().min(1),
  severity: SeveritySchema,
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  message: z.string().min(1),
  evidence: z.string().optional(),
  fix: z.string().optional(),
  cwe: z.string().optional(),
  owasp: z.string().optional(),
  /**
   * Deterministic hash for cross-run deduplication. Computed from
   * verifier + ruleId + normalized path + line range. Stable across runs
   * as long as the verifier rule and file location are stable.
   *
   * Optional in the schema for back-compat reading v0.6.0 exports that
   * predate it; always emitted on findings from v0.7.0+ (set by
   * orchestrator enrichment).
   */
  signature: z.string().min(1).optional(),
  /**
   * Lifecycle state. Omitted (treated as "open") for fresh findings.
   * Hydrated from `.roast/triage.json` on subsequent runs.
   */
  status: FindingStatusSchema.optional(),
  /**
   * Trust boundaries this finding crosses. Empty/omitted if no mapping
   * applies for the verifier rule.
   */
  trustBoundaries: z.array(TrustBoundarySchema).optional()
}).strict();
var VerifierStatusSchema = z.enum(["ok", "skipped", "error"]);
var VerifierResultSchema = z.object({
  verifier: VerifierNameSchema,
  status: VerifierStatusSchema,
  reason: z.string().optional(),
  findings: z.array(FindingSchema).readonly(),
  durationMs: z.number().int().nonnegative()
}).strict();
var SummarySchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
}).strict();
var RunReportSchema = z.object({
  schemaVersion: z.literal(1),
  runnerVersion: z.string(),
  cwd: z.string(),
  startedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  results: z.array(VerifierResultSchema).readonly(),
  summary: SummarySchema
}).strict();
function emptySummary() {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
}
function summarize(findings) {
  const s = emptySummary();
  for (const f of findings) {
    s[f.severity] += 1;
    s.total += 1;
  }
  return s;
}
function computeSignature(input) {
  const normalizedPath = normalizePath(input.path);
  const lineToken = input.line !== void 0 ? String(input.line) : "";
  const endLineToken = input.endLine !== void 0 ? String(input.endLine) : "";
  const material = `${input.verifier}|${input.ruleId}|${normalizedPath}|${lineToken}|${endLineToken}`;
  return crypto.createHash("sha256").update(material, "utf8").digest("hex").slice(0, 16);
}
function normalizePath(path) {
  let p = path.replace(/\\/g, "/");
  if (p.startsWith("./")) p = p.slice(2);
  while (p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

// src/trust-boundaries.ts
function assignTrustBoundaries(f) {
  switch (f.verifier) {
    case "gitleaks":
      return ["secrets"];
    case "dep-audit":
      return ["external-api"];
    case "semgrep":
      return assignSemgrepBoundaries(f);
    case "live-browser":
      return assignLiveBrowserBoundaries(f);
    case "live-lighthouse":
      return ["network"];
  }
}
function assignSemgrepBoundaries(f) {
  const boundaries = /* @__PURE__ */ new Set();
  if (f.cwe) {
    const cweId = extractCweId(f.cwe);
    for (const b of cweToBoundaries(cweId)) boundaries.add(b);
  }
  for (const b of ruleIdToBoundaries(f.ruleId)) boundaries.add(b);
  return Array.from(boundaries);
}
function extractCweId(cweField) {
  const match = /CWE-(\d+)/i.exec(cweField) ?? /^(\d+)$/.exec(cweField.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}
function cweToBoundaries(cwe) {
  if (cwe === null) return [];
  switch (cwe) {
    case 79:
    case 80:
    case 116:
      return ["user-input"];
    case 89:
    case 564:
      return ["user-input", "database"];
    case 78:
    case 77:
    case 94:
    case 95:
      return ["user-input", "process-exec"];
    case 22:
    case 23:
    case 73:
      return ["user-input", "filesystem"];
    case 352:
      return ["user-input", "auth"];
    case 287:
    case 306:
    case 384:
    case 521:
      return ["auth"];
    case 285:
    case 862:
    case 863:
    case 732:
      return ["permissions"];
    case 798:
    case 259:
    case 321:
      return ["secrets"];
    case 502:
    case 915:
      return ["user-input", "serialization"];
    case 918:
      return ["user-input", "network"];
    case 200:
    case 209:
      return ["network"];
    case 362:
    case 367:
    case 366:
      return ["concurrency"];
    case 311:
    case 327:
    case 326:
      return ["network", "secrets"];
    default:
      return [];
  }
}
function ruleIdToBoundaries(ruleId) {
  const id = ruleId.toLowerCase();
  if (id.includes("eval") || id.includes("exec") || id.includes("spawn")) {
    return ["user-input", "process-exec"];
  }
  if (id.includes("sql-injection") || id.includes("sqli") || id.includes("tainted-sql")) {
    return ["user-input", "database"];
  }
  if (id.includes("xss") || id.includes("cross-site-scripting")) {
    return ["user-input"];
  }
  if (id.includes("jwt") || id.includes("auth-") || id.includes("-auth")) {
    return ["auth"];
  }
  if (id.includes("cors") || id.includes("csrf")) {
    return ["user-input", "auth"];
  }
  if (id.includes("ssrf") || id.includes("server-side-request")) {
    return ["user-input", "network"];
  }
  if (id.includes("path-traversal") || id.includes("directory-traversal")) {
    return ["user-input", "filesystem"];
  }
  if (id.includes("secret") || id.includes("hardcoded-credential") || id.includes("api-key")) {
    return ["secrets"];
  }
  if (id.includes("deserialization") || id.includes("unsafe-deserialize")) {
    return ["user-input", "serialization"];
  }
  if (id.includes("crypto") || id.includes("weak-hash") || id.includes("insecure-hash")) {
    return ["secrets"];
  }
  return [];
}
function assignLiveBrowserBoundaries(f) {
  const id = f.ruleId.toLowerCase();
  if (id.startsWith("axe/")) {
    return ["user-input"];
  }
  if (id.startsWith("security-header/")) {
    return ["network"];
  }
  return [];
}

// src/enrichment.ts
function enrichFinding(f) {
  const needsSignature = f.signature === void 0;
  const needsBoundaries = f.trustBoundaries === void 0;
  if (!needsSignature && !needsBoundaries) return f;
  const next = { ...f };
  if (needsSignature) {
    next.signature = computeSignature({
      verifier: f.verifier,
      ruleId: f.ruleId,
      path: f.path,
      line: f.line,
      endLine: f.endLine
    });
  }
  if (needsBoundaries) {
    next.trustBoundaries = [...assignTrustBoundaries(f)];
  }
  return next;
}

// src/orchestrator.ts
var RUNNER_VERSION = "0.7.0";
var SCHEMA_VERSION = 1;
async function runOrchestrator(opts) {
  const started = performance.now();
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  timer.unref();
  const ctx = {
    cwd: opts.cwd,
    url: opts.url,
    cacheDir: opts.cacheDir,
    timeoutMs: opts.timeoutMs,
    signal: controller.signal
  };
  const selected = opts.enabled ? opts.verifiers.filter((v) => opts.enabled.has(v.name)) : opts.verifiers;
  try {
    const rawResults = await Promise.all(selected.map((v) => runOne(v, ctx)));
    const results = rawResults.map((r) => ({
      ...r,
      findings: r.findings.map(enrichFinding)
    }));
    const allFindings = results.flatMap((r) => r.findings);
    const sortedResults = [...results].sort(byVerifierName);
    return {
      schemaVersion: SCHEMA_VERSION,
      runnerVersion: RUNNER_VERSION,
      cwd: opts.cwd,
      startedAt,
      durationMs: Math.round(performance.now() - started),
      results: sortedResults.map((r) => ({ ...r, findings: sortFindings(r.findings) })),
      summary: summarize(allFindings)
    };
  } finally {
    clearTimeout(timer);
  }
}
async function runOne(verifier, ctx) {
  const availStarted = performance.now();
  try {
    const avail = await verifier.isAvailable(ctx);
    if (!avail.available) {
      return skipped(verifier.name, avail.reason, Math.round(performance.now() - availStarted));
    }
    return await verifier.run(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      verifier: verifier.name,
      status: "error",
      reason: `unhandled exception in verifier: ${msg}`,
      findings: [],
      durationMs: Math.round(performance.now() - availStarted)
    };
  }
}
function byVerifierName(a, b) {
  return a.verifier.localeCompare(b.verifier);
}
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) return rankDiff;
    const pathDiff = a.path.localeCompare(b.path);
    if (pathDiff !== 0) return pathDiff;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}
var STDOUT_LIMIT_BYTES = 16 * 1024 * 1024;
var STDERR_LIMIT_BYTES = 1 * 1024 * 1024;
var CommandNotFoundError = class extends Error {
  constructor(command) {
    super(`command not found: ${command}`);
    this.command = command;
  }
  name = "CommandNotFoundError";
};
async function run(command, args, options) {
  const started = performance.now();
  const stdoutLimit = options.stdoutLimitBytes ?? STDOUT_LIMIT_BYTES;
  const stderrLimit = options.stderrLimitBytes ?? STDERR_LIMIT_BYTES;
  if (options.signal.aborted) {
    return {
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      aborted: true,
      truncated: { stdout: false, stderr: false },
      durationMs: Math.round(performance.now() - started)
    };
  }
  const child = child_process.spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const stdoutChunks = [];
  const stderrChunks = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let timedOut = false;
  let aborted = false;
  child.stdout.on("data", (chunk) => {
    if (stdoutBytes + chunk.length <= stdoutLimit) {
      stdoutChunks.push(chunk);
      stdoutBytes += chunk.length;
      return;
    }
    const remaining = stdoutLimit - stdoutBytes;
    if (remaining > 0) stdoutChunks.push(chunk.subarray(0, remaining));
    stdoutBytes = stdoutLimit;
    stdoutTruncated = true;
    child.kill("SIGTERM");
  });
  child.stderr.on("data", (chunk) => {
    if (stderrBytes + chunk.length <= stderrLimit) {
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
      return;
    }
    const remaining = stderrLimit - stderrBytes;
    if (remaining > 0) stderrChunks.push(chunk.subarray(0, remaining));
    stderrBytes = stderrLimit;
    stderrTruncated = true;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 2e3).unref();
  }, options.timeoutMs);
  timer.unref();
  const onAbort = () => {
    aborted = true;
    child.kill("SIGTERM");
  };
  options.signal.addEventListener("abort", onAbort, { once: true });
  let exitCode = null;
  let exitSignal = null;
  try {
    const spawnErrorPromise = new Promise((_, reject) => {
      child.once("error", (err) => {
        if (err.code === "ENOENT") reject(new CommandNotFoundError(command));
        else reject(err);
      });
    });
    const exitPromise = events.once(child, "exit");
    const [code, sig] = await Promise.race([exitPromise, spawnErrorPromise]);
    exitCode = code;
    exitSignal = sig;
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onAbort);
  }
  return {
    exitCode,
    signal: exitSignal,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
    timedOut,
    aborted,
    truncated: { stdout: stdoutTruncated, stderr: stderrTruncated },
    durationMs: Math.round(performance.now() - started)
  };
}
async function commandExists(command, options) {
  try {
    const result = await run(process.platform === "win32" ? "where" : "which", [command], {
      cwd: process.cwd(),
      signal: options.signal,
      timeoutMs: 2e3
    });
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch (err) {
    if (err instanceof CommandNotFoundError) return false;
    throw err;
  }
}

// src/redact.ts
var HIGH_ENTROPY_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  // AWS access key
  /sk-(?:proj-|ant-api03-)?[A-Za-z0-9_-]{20,}/g,
  // OpenAI / Anthropic
  /ghp_[A-Za-z0-9]{36,}/g,
  // GitHub personal token
  /gho_[A-Za-z0-9]{36,}/g,
  // GitHub OAuth
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  // Slack
  /eyJ[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_.+/=-]{10,}/g,
  // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g
];
var SECRETY_RULE_HINTS = [
  "secret",
  "token",
  "apikey",
  "api-key",
  "api_key",
  "credential",
  "password",
  "private-key",
  "privatekey",
  "access-key",
  "access_key",
  "accesskey"
];
function looksSecrety(ruleId) {
  const lower = ruleId.toLowerCase();
  return SECRETY_RULE_HINTS.some((h) => lower.includes(h));
}
function redact(input) {
  let out = input;
  for (const pattern of HIGH_ENTROPY_PATTERNS) {
    out = out.replace(pattern, (m) => `[REDACTED:len=${m.length}]`);
  }
  return out;
}
function redactSecret(secret) {
  return `[REDACTED:len=${secret.length}]`;
}

// src/verifiers/semgrep.ts
var SemgrepResult = z.object({
  check_id: z.string(),
  path: z.string(),
  start: z.object({ line: z.number().int().nonnegative() }).passthrough(),
  end: z.object({ line: z.number().int().nonnegative() }).passthrough().optional(),
  extra: z.object({
    message: z.string().optional(),
    severity: z.string().optional(),
    lines: z.string().optional(),
    metadata: z.object({
      cwe: z.union([z.string(), z.array(z.string())]).optional(),
      owasp: z.union([z.string(), z.array(z.string())]).optional()
    }).passthrough().optional()
  }).passthrough()
}).passthrough();
var SemgrepOutput = z.object({
  results: z.array(SemgrepResult),
  errors: z.array(z.unknown()).optional()
}).passthrough();
var ARGS = [
  "--config",
  "p/security-audit",
  "--config",
  "p/owasp-top-ten",
  "--config",
  "p/secrets",
  "--severity",
  "ERROR",
  "--severity",
  "WARNING",
  "--json",
  "--quiet",
  "--timeout",
  "30",
  "--exclude",
  "node_modules",
  "--exclude",
  ".next",
  "--exclude",
  "dist",
  "--exclude",
  "build",
  "--exclude",
  ".git",
  "."
];
var semgrepVerifier = {
  name: "semgrep",
  async isAvailable(ctx) {
    const exists = await commandExists("semgrep", { signal: ctx.signal });
    return exists ? { available: true } : { available: false, reason: "semgrep not installed (install: 'brew install semgrep' or 'pip install semgrep')" };
  },
  async run(ctx) {
    const started = performance.now();
    try {
      const result = await run("semgrep", ARGS, {
        cwd: ctx.cwd,
        signal: ctx.signal,
        timeoutMs: ctx.timeoutMs
      });
      if (result.timedOut) {
        return errored("semgrep", `timed out after ${ctx.timeoutMs}ms`, result.durationMs);
      }
      if (result.aborted) {
        return errored("semgrep", "aborted", result.durationMs);
      }
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        const stderrSnippet = result.stderr.trim().slice(0, 500);
        return errored(
          "semgrep",
          `semgrep exited ${result.exitCode}${stderrSnippet ? `: ${stderrSnippet}` : ""}`,
          result.durationMs
        );
      }
      const findings = parseSemgrepJson(result.stdout);
      return ok("semgrep", findings, result.durationMs);
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored("semgrep", msg, elapsed);
    }
  }
};
function parseSemgrepJson(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];
  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const parsed = SemgrepOutput.safeParse(raw);
  if (!parsed.success) return [];
  const findings = [];
  for (const r of parsed.data.results) {
    const severity = mapSemgrepSeverity(r.extra.severity, r.check_id);
    const message = (r.extra.message ?? r.check_id).split("\n")[0].slice(0, 500);
    const evidenceRaw = r.extra.lines;
    const evidence = evidenceRaw ? redact(evidenceRaw).slice(0, 500) : void 0;
    const cweMeta = r.extra.metadata?.cwe;
    const owaspMeta = r.extra.metadata?.owasp;
    const cwe = Array.isArray(cweMeta) ? cweMeta[0] : cweMeta;
    const owasp = Array.isArray(owaspMeta) ? owaspMeta[0] : owaspMeta;
    findings.push({
      verifier: "semgrep",
      ruleId: r.check_id,
      severity,
      path: r.path,
      line: r.start.line > 0 ? r.start.line : void 0,
      endLine: r.end?.line && r.end.line > 0 ? r.end.line : void 0,
      message,
      evidence,
      cwe,
      owasp
    });
  }
  return findings;
}
function mapSemgrepSeverity(raw, ruleId) {
  switch ((raw ?? "").toUpperCase()) {
    case "ERROR":
      return looksSecrety(ruleId) ? "critical" : "high";
    case "WARNING":
      return "medium";
    case "INFO":
      return "low";
    default:
      return "info";
  }
}
var GitleaksFinding = z.object({
  RuleID: z.string(),
  Description: z.string().optional(),
  StartLine: z.number().int().nonnegative().optional(),
  EndLine: z.number().int().nonnegative().optional(),
  File: z.string(),
  Match: z.string().optional(),
  Secret: z.string().optional(),
  Commit: z.string().optional()
}).passthrough();
var GitleaksOutput = z.array(GitleaksFinding);
var gitleaksVerifier = {
  name: "gitleaks",
  async isAvailable(ctx) {
    if (!fs.existsSync(path.join(ctx.cwd, ".git"))) {
      return { available: false, reason: "not a git repository (gitleaks scans git history)" };
    }
    const exists = await commandExists("gitleaks", { signal: ctx.signal });
    return exists ? { available: true } : { available: false, reason: "gitleaks not installed (install: 'brew install gitleaks')" };
  },
  async run(ctx) {
    const started = performance.now();
    let tmpDir;
    try {
      tmpDir = await promises.mkdtemp(path.join(os.tmpdir(), "roast-gitleaks-"));
      const reportPath = path.join(tmpDir, "report.json");
      const result = await run(
        "gitleaks",
        [
          "detect",
          "--source",
          ctx.cwd,
          "--no-banner",
          "--no-color",
          "--report-format",
          "json",
          "--report-path",
          reportPath,
          "--exit-code",
          "0"
        ],
        { cwd: ctx.cwd, signal: ctx.signal, timeoutMs: ctx.timeoutMs }
      );
      if (result.timedOut) {
        return errored("gitleaks", `timed out after ${ctx.timeoutMs}ms`, result.durationMs);
      }
      if (result.aborted) {
        return errored("gitleaks", "aborted", result.durationMs);
      }
      if (result.exitCode !== 0) {
        const stderrSnippet = result.stderr.trim().slice(0, 500);
        return errored(
          "gitleaks",
          `gitleaks exited ${result.exitCode}${stderrSnippet ? `: ${stderrSnippet}` : ""}`,
          result.durationMs
        );
      }
      const reportExists = fs.existsSync(reportPath);
      const reportText = reportExists ? await promises.readFile(reportPath, "utf8") : "";
      const findings = parseGitleaksJson(reportText);
      return ok("gitleaks", findings, result.durationMs);
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored("gitleaks", msg, elapsed);
    } finally {
      if (tmpDir !== void 0) {
        await promises.rm(tmpDir, { recursive: true, force: true }).catch(() => void 0);
      }
    }
  }
};
function parseGitleaksJson(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const parsed = GitleaksOutput.safeParse(raw);
  if (!parsed.success) return [];
  const findings = [];
  for (const r of parsed.data) {
    const secret = r.Secret ?? r.Match ?? "";
    const redactedEvidence = secret.length > 0 ? redactSecret(secret) : void 0;
    const commitSuffix = r.Commit ? ` (commit ${r.Commit.slice(0, 7)})` : "";
    const description = (r.Description ?? r.RuleID).split("\n")[0].slice(0, 400);
    findings.push({
      verifier: "gitleaks",
      ruleId: r.RuleID,
      severity: "critical",
      path: r.File,
      line: r.StartLine && r.StartLine > 0 ? r.StartLine : void 0,
      endLine: r.EndLine && r.EndLine > 0 ? r.EndLine : void 0,
      message: `${description}${commitSuffix}`,
      evidence: redactedEvidence,
      fix: "rotate the credential immediately; remove from history with git-filter-repo or BFG"
    });
  }
  return findings;
}
var KNOWN_VULNERABLE = [
  { pkg: "lodash", fixedIn: [4, 17, 21], severity: "high", cve: "CVE-2021-23337", summary: "command injection via template" },
  { pkg: "jsonwebtoken", fixedIn: [9, 0, 0], severity: "critical", cve: "CVE-2022-23529", summary: "algorithm confusion / weak verification" },
  { pkg: "axios", fixedIn: [1, 6, 0], severity: "high", cve: "CVE-2023-45857", summary: "cross-site request forgery / SSRF" },
  { pkg: "next", fixedIn: [13, 5, 1], severity: "high", cve: "CVE-2023-46298", summary: "cache poisoning + auth bypass in older releases" },
  { pkg: "next", fixedIn: [14, 2, 10], severity: "high", cve: "CVE-2024-46982", summary: "cache poisoning" },
  { pkg: "express", fixedIn: [4, 19, 2], severity: "medium", cve: "CVE-2024-29041", summary: "open redirect via malformed URLs" },
  { pkg: "node-fetch", fixedIn: [2, 6, 7], severity: "medium", cve: "CVE-2022-0235", summary: "host whitelist bypass on redirect" },
  { pkg: "ws", fixedIn: [8, 17, 1], severity: "high", cve: "CVE-2024-37890", summary: "denial of service via crafted headers" },
  { pkg: "tar", fixedIn: [6, 2, 1], severity: "high", cve: "CVE-2024-28863", summary: "path traversal on extraction" },
  { pkg: "follow-redirects", fixedIn: [1, 15, 6], severity: "high", cve: "CVE-2024-28849", summary: "credential leak via cross-origin redirect" },
  { pkg: "semver", fixedIn: [7, 5, 2], severity: "medium", cve: "CVE-2022-25883", summary: "ReDoS on crafted range string" }
];
var BUILD_TOOLS_BELONG_IN_DEV = /* @__PURE__ */ new Set([
  "eslint",
  "jest",
  "typescript",
  "tsx",
  "ts-node",
  "prettier",
  "vitest",
  "mocha",
  "chai",
  "webpack",
  "rollup",
  "vite",
  "parcel",
  "concurrently",
  "nodemon",
  "tsup",
  "esbuild",
  "rimraf",
  "@types/node"
]);
var PackageJson = z.object({
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional()
}).passthrough();
var LockfileV3Package = z.object({ version: z.string().optional() }).passthrough();
var Lockfile = z.object({
  lockfileVersion: z.number().optional(),
  packages: z.record(LockfileV3Package).optional(),
  dependencies: z.record(z.object({ version: z.string().optional() }).passthrough()).optional()
}).passthrough();
var depAuditVerifier = {
  name: "dep-audit",
  async isAvailable(ctx) {
    if (!fs.existsSync(path.join(ctx.cwd, "package.json"))) {
      return { available: false, reason: "no package.json in cwd (Node-only in v0.4.0)" };
    }
    return { available: true };
  },
  async run(ctx) {
    const started = performance.now();
    try {
      const pkgPath = path.join(ctx.cwd, "package.json");
      const pkgText = await promises.readFile(pkgPath, "utf8");
      const pkgRaw = JSON.parse(pkgText);
      const pkg = PackageJson.parse(pkgRaw);
      const lockResolved = await loadLockfileVersions(ctx.cwd);
      const findings = [];
      auditKnownVulns(pkg, lockResolved, findings);
      auditMisplacedBuildTools(pkg, findings);
      auditMissingLockfile(ctx.cwd, pkg, findings);
      return ok("dep-audit", findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ENOENT") || msg.includes("not valid JSON") || msg.includes("JSON")) {
        return skipped("dep-audit", `unable to parse package.json: ${msg}`, elapsed);
      }
      return errored("dep-audit", msg, elapsed);
    }
  }
};
function auditKnownVulns(pkg, lockResolved, out) {
  const all = [
    ...Object.entries(pkg.dependencies ?? {}).map(([k, v]) => [k, v, "dependencies"]),
    ...Object.entries(pkg.devDependencies ?? {}).map(([k, v]) => [k, v, "devDependencies"])
  ];
  for (const [name, spec, section] of all) {
    const matches = KNOWN_VULNERABLE.filter((v) => v.pkg === name);
    if (matches.length === 0) continue;
    const installed = lockResolved.get(name) ?? minVersionFromSpec(spec);
    if (installed === null) continue;
    for (const vuln of matches) {
      if (lt(installed, vuln.fixedIn)) {
        out.push({
          verifier: "dep-audit",
          ruleId: `known-vuln/${vuln.pkg}/${vuln.cve ?? formatSemVer(vuln.fixedIn)}`,
          severity: vuln.severity,
          path: "package.json",
          message: `${name}@${formatSemVer(installed)} (${section}) \u2014 ${vuln.summary}${vuln.cve ? ` [${vuln.cve}]` : ""}; fixed in ${formatSemVer(vuln.fixedIn)}`,
          fix: `upgrade ${name} to >=${formatSemVer(vuln.fixedIn)}`
        });
      }
    }
  }
}
function auditMisplacedBuildTools(pkg, out) {
  const deps = pkg.dependencies ?? {};
  for (const name of Object.keys(deps)) {
    if (BUILD_TOOLS_BELONG_IN_DEV.has(name)) {
      out.push({
        verifier: "dep-audit",
        ruleId: `misplaced-dev-dep/${name}`,
        severity: "low",
        path: "package.json",
        message: `${name} listed in "dependencies" but is a build/dev tool \u2014 ships to production unnecessarily, bloating install size and surface`,
        fix: `move "${name}" from "dependencies" to "devDependencies"`
      });
    }
  }
}
function auditMissingLockfile(cwd, pkg, out) {
  const hasDeps = Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length > 0;
  if (!hasDeps) return;
  const hasLockfile = fs.existsSync(path.join(cwd, "package-lock.json")) || fs.existsSync(path.join(cwd, "pnpm-lock.yaml")) || fs.existsSync(path.join(cwd, "yarn.lock")) || fs.existsSync(path.join(cwd, "bun.lockb"));
  if (!hasLockfile) {
    out.push({
      verifier: "dep-audit",
      ruleId: "missing-lockfile",
      severity: "medium",
      path: "package.json",
      message: "no lockfile committed \u2014 CI builds are not reproducible; dependency drift between envs is silent",
      fix: "commit package-lock.json (or pnpm-lock.yaml / yarn.lock) and add to git"
    });
  }
}
async function loadLockfileVersions(cwd) {
  const lockPath = path.join(cwd, "package-lock.json");
  if (!fs.existsSync(lockPath)) return /* @__PURE__ */ new Map();
  try {
    const text = await promises.readFile(lockPath, "utf8");
    const raw = JSON.parse(text);
    const lock = Lockfile.parse(raw);
    const out = /* @__PURE__ */ new Map();
    if (lock.packages) {
      for (const [key, entry] of Object.entries(lock.packages)) {
        if (key === "") continue;
        const lastIdx = key.lastIndexOf("node_modules/");
        if (lastIdx < 0) continue;
        const name = key.slice(lastIdx + "node_modules/".length);
        if (!name || !entry.version) continue;
        if (!out.has(name)) {
          const parsed = parseSemVer(entry.version);
          if (parsed !== null) out.set(name, parsed);
        }
      }
    }
    if (out.size === 0 && lock.dependencies) {
      for (const [name, entry] of Object.entries(lock.dependencies)) {
        if (!entry.version) continue;
        const parsed = parseSemVer(entry.version);
        if (parsed !== null) out.set(name, parsed);
      }
    }
    return out;
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function parseSemVer(input) {
  const trimmed = input.trim();
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function minVersionFromSpec(spec) {
  const trimmed = spec.trim();
  if (trimmed.startsWith("git") || trimmed.includes(":") || trimmed.startsWith("file") || trimmed.startsWith("http")) {
    return null;
  }
  const stripped = trimmed.replace(/^[\^~]|^>=\s*/, "").trim();
  return parseSemVer(stripped);
}
function lt(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}
function formatSemVer(v) {
  return `${v[0]}.${v[1]}.${v[2]}`;
}
var PLAYWRIGHT_VERSION = "1.47.2";
var NPM_INSTALL_TIMEOUT_MS = 5 * 6e4;
var BROWSER_INSTALL_TIMEOUT_MS = 5 * 6e4;
async function ensurePlaywrightInstalled(opts) {
  const cacheDir = opts.cacheDir;
  const playwrightPkgDir = path.join(cacheDir, "node_modules", "playwright-chromium");
  const browsersDir = path.join(cacheDir, ".browsers");
  const sentinel = path.join(cacheDir, ".install-complete.v1");
  if (fs.existsSync(sentinel) && fs.existsSync(path.join(playwrightPkgDir, "package.json")) && fs.existsSync(browsersDir)) {
    return { ready: true, playwrightPkgDir, browsersDir };
  }
  if (opts.signal.aborted) {
    return { ready: false, playwrightPkgDir, browsersDir, reason: "aborted before install" };
  }
  if (!await commandExists("npm", { signal: opts.signal })) {
    return {
      ready: false,
      playwrightPkgDir,
      browsersDir,
      reason: "npm not installed \u2014 required for first-time --url install of playwright-chromium"
    };
  }
  opts.onProgress?.(
    `[first --url run on this machine: installing playwright-chromium@${PLAYWRIGHT_VERSION} + Chromium to ${cacheDir} (~200MB, one-time)]`
  );
  try {
    await promises.mkdir(cacheDir, { recursive: true });
    await writeMinimalPackageJson(cacheDir);
    opts.onProgress?.("  step 1/2: npm install playwright-chromium...");
    const npmResult = await run(
      "npm",
      ["install", `playwright-chromium@${PLAYWRIGHT_VERSION}`, "--no-save", "--no-audit", "--no-fund", "--loglevel=error"],
      { cwd: cacheDir, signal: opts.signal, timeoutMs: NPM_INSTALL_TIMEOUT_MS }
    );
    if (npmResult.exitCode !== 0) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `npm install failed (exit ${npmResult.exitCode}): ${npmResult.stderr.trim().slice(-500) || npmResult.stdout.trim().slice(-500)}`
      };
    }
    const cliJs = path.join(playwrightPkgDir, "cli.js");
    if (!fs.existsSync(cliJs)) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `playwright-chromium cli.js not found after install at ${cliJs}`
      };
    }
    opts.onProgress?.("  step 2/2: downloading Chromium browser binary...");
    const browserResult = await run("node", [cliJs, "install", "chromium"], {
      cwd: cacheDir,
      signal: opts.signal,
      timeoutMs: BROWSER_INSTALL_TIMEOUT_MS,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersDir }
    });
    if (browserResult.exitCode !== 0) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `chromium binary download failed (exit ${browserResult.exitCode}): ${browserResult.stderr.trim().slice(-500)}`
      };
    }
    await promises.writeFile(sentinel, (/* @__PURE__ */ new Date()).toISOString(), "utf8");
    opts.onProgress?.("  \u2713 install complete");
    return { ready: true, playwrightPkgDir, browsersDir };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ready: false, playwrightPkgDir, browsersDir, reason: msg };
  }
}
async function writeMinimalPackageJson(dir) {
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const existing = JSON.parse(await promises.readFile(pkgPath, "utf8"));
      if (existing && typeof existing === "object") return;
    } catch {
    }
  }
  await promises.writeFile(
    pkgPath,
    JSON.stringify({ name: "roast-runner-live-cache", version: "0.0.0", private: true }, null, 2) + "\n",
    "utf8"
  );
}

// src/verifiers/live-browser.ts
var PAGE_LOAD_TIMEOUT_MS = 45e3;
var VIEWPORT = { width: 1280, height: 800 };
var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 roast-runner/0.5";
var MAX_AXE_VIOLATIONS_REPORTED = 15;
var MAX_CONSOLE_ERRORS_REPORTED = 10;
var MAX_FAILED_REQUESTS_REPORTED = 10;
var AxeNode = z.object({ target: z.array(z.string()).optional(), html: z.string().optional() }).passthrough();
var AxeViolation = z.object({
  id: z.string(),
  impact: z.enum(["critical", "serious", "moderate", "minor"]).nullable().optional(),
  help: z.string().optional(),
  description: z.string().optional(),
  helpUrl: z.string().optional(),
  nodes: z.array(AxeNode).optional(),
  tags: z.array(z.string()).optional()
}).passthrough();
var AxeResult = z.object({ violations: z.array(AxeViolation) }).passthrough();
var liveBrowserVerifier = {
  name: "live-browser",
  async isAvailable(ctx) {
    if (ctx.url === void 0) {
      return { available: false, reason: "--url not provided" };
    }
    return { available: true };
  },
  async run(ctx) {
    const started = performance.now();
    if (ctx.url === void 0) {
      return skipped("live-browser", "--url not provided", 0);
    }
    const install = await ensurePlaywrightInstalled({
      cacheDir: ctx.cacheDir,
      signal: ctx.signal,
      onProgress: (msg) => process.stderr.write(`${msg}
`)
    });
    if (!install.ready) {
      return skipped("live-browser", install.reason ?? "playwright install incomplete", Math.round(performance.now() - started));
    }
    let browser;
    try {
      process.env["PLAYWRIGHT_BROWSERS_PATH"] = install.browsersDir;
      const pwIndex = path.join(install.playwrightPkgDir, "index.js");
      if (!fs.existsSync(pwIndex)) {
        return errored("live-browser", `playwright-chromium entrypoint missing at ${pwIndex}`, Math.round(performance.now() - started));
      }
      const mod = await import(url.pathToFileURL(pwIndex).href);
      const pw = mod.default ?? mod;
      browser = await pw.chromium.launch({ headless: true, timeout: 3e4 });
      const browserCtx = await browser.newContext({ viewport: VIEWPORT, userAgent: USER_AGENT });
      const page = await browserCtx.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      let mainResponse = null;
      page.on("console", (msg) => {
        const t = msg.type();
        if (t === "error" || t === "warning") {
          const loc = msg.location();
          consoleErrors.push({ type: t, text: msg.text().slice(0, 500), url: loc.url, line: loc.lineNumber });
        }
      });
      page.on("pageerror", (err) => {
        pageErrors.push({ name: err.name, message: err.message.slice(0, 500) });
      });
      page.on("requestfailed", (req) => {
        const fail = req.failure();
        if (!fail) return;
        if (req.resourceType() === "image" && req.url().includes("favicon")) return;
        failedRequests.push({
          url: req.url().slice(0, 400),
          method: req.method(),
          reason: fail.errorText.slice(0, 200),
          resourceType: req.resourceType()
        });
      });
      page.on("response", (res) => {
        if (mainResponse === null) mainResponse = res;
      });
      const response = await page.goto(ctx.url, { waitUntil: "networkidle", timeout: PAGE_LOAD_TIMEOUT_MS }).catch(
        (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`page.goto failed: ${msg}`);
        }
      );
      const finalResponse = response ?? mainResponse;
      const axeViolations = await runAxe(page).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[live-browser] axe injection/run failed: ${msg}
`);
        return [];
      });
      const screenshotDir = await captureScreenshots(page, ctx.url).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[live-browser] screenshot failed: ${msg}
`);
        return void 0;
      });
      const findings = [];
      const pagePath = pathFromUrl(ctx.url);
      pushNavigationFinding(findings, pagePath, finalResponse, ctx.url);
      pushSecurityHeaderFindings(findings, pagePath, finalResponse);
      pushPageErrorFindings(findings, pagePath, pageErrors);
      pushConsoleErrorFindings(findings, pagePath, consoleErrors);
      pushFailedRequestFindings(findings, pagePath, failedRequests);
      pushAxeFindings(findings, pagePath, axeViolations);
      if (screenshotDir !== void 0) {
        process.stderr.write(`[live-browser] screenshots saved: ${screenshotDir}
`);
      }
      return ok("live-browser", findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored("live-browser", msg, elapsed);
    } finally {
      await browser?.close().catch(() => void 0);
    }
  }
};
async function runAxe(page) {
  const axePath = path.join(__dirname, "axe.min.js");
  const axeSource = await promises.readFile(axePath, "utf8");
  await page.addScriptTag({ content: axeSource });
  const raw = await page.evaluate(`(async () => {
    if (typeof window.axe === 'undefined') return { violations: [] };
    const r = await window.axe.run({ resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
    return { violations: r.violations };
  })()`);
  const parsed = AxeResult.safeParse(raw);
  return parsed.success ? parsed.data.violations : [];
}
async function captureScreenshots(page, url) {
  const slug = url.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  const dir = path.join(os.tmpdir(), `roast-${Date.now()}-${slug}`);
  await promises.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, "viewport.png"), fullPage: false, type: "png" });
  await page.screenshot({ path: path.join(dir, "fullpage.png"), fullPage: true, type: "png" });
  return dir;
}
function pathFromUrl(u) {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return u;
  }
}
function pushNavigationFinding(out, path, response, url) {
  if (response === null) {
    out.push({
      verifier: "live-browser",
      ruleId: "navigation/no-response",
      severity: "critical",
      path,
      message: `no HTTP response received for ${url}`
    });
    return;
  }
  const status = response.status();
  if (status >= 500) {
    out.push({
      verifier: "live-browser",
      ruleId: `navigation/http-${status}`,
      severity: "critical",
      path,
      message: `server error on main document: HTTP ${status}`
    });
  } else if (status >= 400) {
    out.push({
      verifier: "live-browser",
      ruleId: `navigation/http-${status}`,
      severity: "high",
      path,
      message: `main document returned HTTP ${status}`
    });
  }
}
var SECURITY_HEADER_CHECKS = [
  { header: "content-security-policy", severity: "high", fix: "set a CSP header (start with `Content-Security-Policy: default-src 'self'`) to mitigate XSS and data exfiltration" },
  { header: "strict-transport-security", severity: "medium", fix: "add HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`" },
  { header: "x-content-type-options", severity: "low", fix: "add `X-Content-Type-Options: nosniff` to block MIME-type sniffing" },
  { header: "referrer-policy", severity: "low", fix: "set `Referrer-Policy: strict-origin-when-cross-origin` to limit referer leakage" },
  { header: "x-frame-options", severity: "medium", fix: "add `X-Frame-Options: DENY` or CSP `frame-ancestors` to prevent clickjacking" }
];
function pushSecurityHeaderFindings(out, path, response) {
  if (response === null) return;
  const headers = response.headers();
  const lowered = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = v;
  for (const check of SECURITY_HEADER_CHECKS) {
    if (!(check.header in lowered)) {
      out.push({
        verifier: "live-browser",
        ruleId: `security-header/missing/${check.header}`,
        severity: check.severity,
        path,
        message: `missing security header \`${check.header}\` on main document`,
        fix: check.fix
      });
    }
  }
}
function pushPageErrorFindings(out, path, errors) {
  for (const e of errors.slice(0, MAX_CONSOLE_ERRORS_REPORTED)) {
    out.push({
      verifier: "live-browser",
      ruleId: "js/uncaught-exception",
      severity: "high",
      path,
      message: `uncaught ${e.name}: ${e.message}`
    });
  }
}
function pushConsoleErrorFindings(out, path, errors) {
  const onlyErrors = errors.filter((e) => e.type === "error");
  for (const e of onlyErrors.slice(0, MAX_CONSOLE_ERRORS_REPORTED)) {
    out.push({
      verifier: "live-browser",
      ruleId: "console/error",
      severity: "medium",
      path: e.url || path,
      line: e.line > 0 ? e.line : void 0,
      message: `console error: ${e.text}`
    });
  }
}
function pushFailedRequestFindings(out, path, failed) {
  for (const f of failed.slice(0, MAX_FAILED_REQUESTS_REPORTED)) {
    out.push({
      verifier: "live-browser",
      ruleId: `network/failed/${f.resourceType}`,
      severity: f.resourceType === "script" || f.resourceType === "stylesheet" ? "high" : "medium",
      path,
      message: `${f.method} ${f.url} failed: ${f.reason} (${f.resourceType})`
    });
  }
}
function pushAxeFindings(out, path, violations) {
  const sorted = [...violations].sort((a, b) => axeImpactRank(b.impact) - axeImpactRank(a.impact));
  for (const v of sorted.slice(0, MAX_AXE_VIOLATIONS_REPORTED)) {
    const impactSev = axeImpactToSeverity(v.impact);
    const nodes = v.nodes ?? [];
    const target = nodes[0]?.target?.[0];
    const evidence = nodes[0]?.html?.slice(0, 200);
    out.push({
      verifier: "live-browser",
      ruleId: `axe/${v.id}`,
      severity: impactSev,
      path: target ? `${path} ${target}` : path,
      message: `a11y: ${v.help ?? v.id}${nodes.length > 1 ? ` (${nodes.length} occurrences)` : ""}`,
      evidence,
      fix: v.helpUrl
    });
  }
}
function axeImpactRank(impact) {
  switch (impact) {
    case "critical":
      return 4;
    case "serious":
      return 3;
    case "moderate":
      return 2;
    case "minor":
      return 1;
    default:
      return 0;
  }
}
function axeImpactToSeverity(impact) {
  switch (impact) {
    case "critical":
      return "high";
    case "serious":
      return "high";
    case "moderate":
      return "medium";
    case "minor":
      return "low";
    default:
      return "low";
  }
}

// src/verifiers/live-lighthouse.ts
var PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
var Audit = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  score: z.number().nullable().optional(),
  displayValue: z.string().optional(),
  numericValue: z.number().optional(),
  numericUnit: z.string().optional()
}).passthrough();
var Category = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  score: z.number().nullable().optional()
}).passthrough();
var PsiResponse = z.object({
  lighthouseResult: z.object({
    finalDisplayedUrl: z.string().optional(),
    categories: z.object({
      performance: Category.optional(),
      accessibility: Category.optional(),
      "best-practices": Category.optional(),
      seo: Category.optional()
    }).passthrough(),
    audits: z.record(Audit)
  }).passthrough()
}).passthrough();
var liveLighthouseVerifier = {
  name: "live-lighthouse",
  async isAvailable(ctx) {
    if (ctx.url === void 0) {
      return { available: false, reason: "--url not provided" };
    }
    return { available: true };
  },
  async run(ctx) {
    const started = performance.now();
    if (ctx.url === void 0) {
      return skipped("live-lighthouse", "--url not provided", 0);
    }
    try {
      const psiUrl = buildPsiUrl(ctx.url, process.env["ROAST_PSI_API_KEY"]);
      const response = await fetch(psiUrl, {
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(ctx.timeoutMs)]),
        headers: { "User-Agent": "roast-runner/0.5.0" }
      });
      if (!response.ok) {
        const bodySnippet = (await response.text().catch(() => "")).slice(0, 500);
        return errored(
          "live-lighthouse",
          `PSI returned HTTP ${response.status}${bodySnippet ? `: ${bodySnippet}` : ""}`,
          Math.round(performance.now() - started)
        );
      }
      const raw = await response.json();
      const findings = parsePsiResponse(raw, ctx.url);
      return ok("live-lighthouse", findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
        return errored("live-lighthouse", `aborted or timed out after ${ctx.timeoutMs}ms`, elapsed);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errored("live-lighthouse", msg, elapsed);
    }
  }
};
function buildPsiUrl(targetUrl, apiKey) {
  const u = new URL(PSI_ENDPOINT);
  u.searchParams.set("url", targetUrl);
  u.searchParams.set("strategy", "mobile");
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) {
    u.searchParams.append("category", c);
  }
  if (apiKey && apiKey.length > 0) u.searchParams.set("key", apiKey);
  return u.toString();
}
function parsePsiResponse(raw, targetUrl) {
  const parsed = PsiResponse.safeParse(raw);
  if (!parsed.success) return [];
  const lr = parsed.data.lighthouseResult;
  const path = pathFromUrl2(targetUrl);
  const findings = [];
  pushCategoryFinding(findings, path, "performance", lr.categories.performance?.score);
  pushCategoryFinding(findings, path, "accessibility", lr.categories.accessibility?.score);
  pushCategoryFinding(findings, path, "best-practices", lr.categories["best-practices"]?.score);
  pushCategoryFinding(findings, path, "seo", lr.categories.seo?.score);
  pushWebVital(findings, path, "largest-contentful-paint", lr.audits["largest-contentful-paint"], 2500, 4e3);
  pushWebVital(findings, path, "cumulative-layout-shift", lr.audits["cumulative-layout-shift"], 0.1, 0.25);
  pushWebVital(findings, path, "total-blocking-time", lr.audits["total-blocking-time"], 200, 600);
  pushWebVital(findings, path, "first-contentful-paint", lr.audits["first-contentful-paint"], 1800, 3e3);
  return findings;
}
function pathFromUrl2(u) {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return u;
  }
}
function pushCategoryFinding(out, path, category, score, _tags) {
  if (score === null || score === void 0) return;
  const pct = Math.round(score * 100);
  const severity = scoreSeverity(pct);
  if (severity === null) return;
  out.push({
    verifier: "live-lighthouse",
    ruleId: `lighthouse/category/${category}`,
    severity,
    path,
    message: `Lighthouse ${category} score: ${pct}/100 (${severityLabel(severity)})`,
    fix: `target \u226590 ${category} score; see roastrebuild.com/review for prioritized fixes`
  });
}
function pushWebVital(out, path, auditId, audit, goodMax, poorMin) {
  if (!audit || audit.numericValue === void 0) return;
  const value = audit.numericValue;
  let severity;
  let label;
  if (value <= goodMax) {
    return;
  } else if (value >= poorMin) {
    severity = "high";
    label = "poor";
  } else {
    severity = "medium";
    label = "needs improvement";
  }
  const displayValue = audit.displayValue ?? formatNumeric(value, audit.numericUnit);
  const goodLabel = formatNumeric(goodMax, audit.numericUnit);
  out.push({
    verifier: "live-lighthouse",
    ruleId: `lighthouse/${auditId}`,
    severity,
    path,
    message: `${audit.title ?? auditId}: ${displayValue} (${label} \u2014 Web Vitals threshold for "good" is ${goodLabel})`
  });
}
function scoreSeverity(pct) {
  if (pct >= 90) return null;
  if (pct >= 75) return "low";
  if (pct >= 50) return "medium";
  return "high";
}
function severityLabel(s) {
  return s === "high" ? "poor" : s === "medium" ? "needs improvement" : "below target";
}
function formatNumeric(value, unit) {
  if (unit === "millisecond") {
    return value >= 1e3 ? `${(value / 1e3).toFixed(2)} s` : `${Math.round(value)} ms`;
  }
  if (unit === "unitless") return value.toFixed(3);
  return `${value}${unit ? ` ${unit}` : ""}`;
}

// src/registry.ts
var ALL_VERIFIERS = [
  semgrepVerifier,
  gitleaksVerifier,
  depAuditVerifier,
  liveBrowserVerifier,
  liveLighthouseVerifier
];
var GIT_CMD_TIMEOUT_MS = 3e3;
async function detectGitInfo(cwd, signal) {
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    return { isRepo: false, head: null, dirty: false, branch: null };
  }
  const [head, dirty, branch] = await Promise.all([
    getHead(cwd, signal),
    getDirty(cwd, signal),
    getBranch(cwd, signal)
  ]);
  return { isRepo: true, head, dirty, branch };
}
async function getHead(cwd, signal) {
  try {
    const r = await run("git", ["rev-parse", "--short", "HEAD"], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) {
      const head = r.stdout.trim();
      return head.length > 0 ? head : null;
    }
    return null;
  } catch {
    return null;
  }
}
async function getDirty(cwd, signal) {
  try {
    const r = await run("git", ["status", "--porcelain"], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) return r.stdout.trim().length > 0;
    return false;
  } catch {
    return false;
  }
}
async function getBranch(cwd, signal) {
  try {
    const r = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) {
      const branch = r.stdout.trim();
      return branch.length > 0 && branch !== "HEAD" ? branch : null;
    }
    return null;
  } catch {
    return null;
  }
}
var CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var CLAIM_PREFIX = "RST-";
var CLAIM_BODY_LEN = 8;
function generateClaimCode() {
  const bytes = crypto.randomBytes(CLAIM_BODY_LEN);
  let out = CLAIM_PREFIX;
  for (let i = 0; i < CLAIM_BODY_LEN; i += 1) {
    out += CROCKFORD[bytes[i] & 31];
  }
  return out;
}
function computeContentHash(input) {
  const parts = [
    path.basename(input.cwd),
    input.gitHead ?? "no-git",
    input.gitDirty ? "dirty" : "clean",
    input.url ?? "local-only",
    input.skillVersion
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

// src/export.ts
var RESUME_BASE_URL = "https://www.roastrebuild.com";
var PrivacyBlockSchema = z.object({
  what_we_send: z.array(z.string()).readonly(),
  what_we_dont_send: z.array(z.string()).readonly(),
  finding_count: z.number().int().nonnegative(),
  file_paths_referenced: z.number().int().nonnegative(),
  redacted_evidence_count: z.number().int().nonnegative(),
  snippet_count: z.number().int().nonnegative(),
  max_snippet_chars: z.number().int().nonnegative()
}).strict();
var ClaimMetadataSchema = z.object({
  claim_code: z.string().regex(/^RST-[0-9A-HJ-NP-TV-Z]{8}$/),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
  cwd_basename: z.string().min(1),
  git_head: z.string().nullable(),
  git_dirty: z.boolean(),
  git_branch: z.string().nullable(),
  audit_url: z.string().nullable(),
  skill_version: z.string(),
  exported_at: z.string().datetime(),
  resume_url: z.string().url()
}).strict();
z.object({
  schemaVersion: z.literal(1),
  _privacy: PrivacyBlockSchema,
  claim_metadata: ClaimMetadataSchema,
  summary: SummarySchema,
  findings: z.array(FindingSchema).readonly(),
  audit_duration_ms: z.number().int().nonnegative()
}).strict();
function buildExportPayload(input) {
  const findings = collectFindings(input.report);
  const claimCode = generateClaimCode();
  const contentHash = computeContentHash({
    cwd: input.cwd,
    gitHead: input.git.head,
    gitDirty: input.git.dirty,
    url: input.url,
    skillVersion: RUNNER_VERSION
  });
  const cwdBasename = path.basename(input.cwd) || "unknown";
  const privacy = buildPrivacyBlock(findings, input.url !== void 0);
  return {
    schemaVersion: 1,
    _privacy: privacy,
    claim_metadata: {
      claim_code: claimCode,
      content_hash: contentHash,
      cwd_basename: cwdBasename,
      git_head: input.git.head,
      git_dirty: input.git.dirty,
      git_branch: input.git.branch,
      audit_url: input.url ?? null,
      skill_version: RUNNER_VERSION,
      exported_at: (/* @__PURE__ */ new Date()).toISOString(),
      resume_url: `${RESUME_BASE_URL}/resume?c=${claimCode}`
    },
    summary: input.report.summary,
    findings,
    audit_duration_ms: input.report.durationMs
  };
}
function collectFindings(report) {
  return report.results.flatMap((r) => r.findings);
}
function buildPrivacyBlock(findings, hasUrl) {
  const pathSet = /* @__PURE__ */ new Set();
  let redactedEvidence = 0;
  let snippetCount = 0;
  let maxSnippetChars = 0;
  for (const f of findings) {
    pathSet.add(f.path);
    if (f.evidence) {
      snippetCount += 1;
      maxSnippetChars = Math.max(maxSnippetChars, f.evidence.length);
      if (f.evidence.includes("[REDACTED:")) redactedEvidence += 1;
    }
  }
  const whatWeSend = [
    "finding rule IDs, severities, and one-line messages",
    "file paths referenced (basenames + relative paths) and line numbers",
    "redacted evidence snippets (max 500 chars; secrets replaced with [REDACTED:len=N])",
    "project basename + git short-SHA + branch (NOT full paths)"
  ];
  if (hasUrl) whatWeSend.push("the URL you passed to --url (host + pathname)");
  const whatWeDont = [
    "no full filesystem paths (only basename of cwd)",
    "no raw source code beyond <=500-char evidence snippets",
    "no environment variables, secrets, or credentials",
    "no screenshots (kept local in /tmp/, never uploaded)",
    "no authentication, no API keys, no telemetry"
  ];
  return {
    what_we_send: whatWeSend,
    what_we_dont_send: whatWeDont,
    finding_count: findings.length,
    file_paths_referenced: pathSet.size,
    redacted_evidence_count: redactedEvidence,
    snippet_count: snippetCount,
    max_snippet_chars: maxSnippetChars
  };
}
async function writeExportPayload(payload, outPath) {
  const absolutePath = path.resolve(outPath);
  const serialized = JSON.stringify(payload, null, 2);
  await promises.writeFile(absolutePath, serialized, "utf8");
  return { bytesWritten: Buffer.byteLength(serialized, "utf8"), absolutePath };
}
var SEPARATOR = "\u2500".repeat(60);
async function runPreview(payload, opts) {
  printPreview(payload, opts.outPath);
  if (opts.assumeYes) {
    process.stderr.write("  \u2192 --export-yes flag passed; skipping interactive confirmation\n\n");
    return { proceed: true };
  }
  if (!process.stdin.isTTY) {
    return {
      proceed: false,
      reason: "stdin is not a TTY and --export-yes was not passed; refusing to write silently. Re-run with --export-yes to bypass the prompt."
    };
  }
  const answer = await askYesNo("Continue? [y/N]: ");
  process.stderr.write("\n");
  return answer ? { proceed: true } : { proceed: false, reason: "user declined export" };
}
function printPreview(payload, outPath) {
  const p = payload._privacy;
  const lines = [
    "",
    SEPARATOR,
    `  Ready to export roast.json \u2192 ${outPath}`,
    SEPARATOR,
    "",
    "  What we'd send to roastrebuild.com:",
    `    ${pad(p.finding_count)} findings`,
    `    ${pad(p.file_paths_referenced)} file paths (basenames + line numbers only)`,
    `    ${pad(p.redacted_evidence_count)} redacted secret evidence snippets`,
    `    ${pad(p.snippet_count)} code evidence snippets (max ${p.max_snippet_chars} chars each)`,
    "",
    "  What we'd NOT send:"
  ];
  for (const item of p.what_we_dont_send) {
    lines.push(`    \u2717 ${item}`);
  }
  lines.push("");
  lines.push(`  Claim code (pre-generated): ${payload.claim_metadata.claim_code}`);
  lines.push(`  Audit URL: ${payload.claim_metadata.audit_url ?? "local-only (no --url)"}`);
  if (payload.claim_metadata.git_head !== null) {
    lines.push(`  Git: ${payload.claim_metadata.git_head}${payload.claim_metadata.git_dirty ? " (dirty)" : ""}${payload.claim_metadata.git_branch ? ` on ${payload.claim_metadata.git_branch}` : ""}`);
  }
  lines.push("");
  lines.push(SEPARATOR);
  lines.push("");
  process.stderr.write(lines.join("\n"));
}
function pad(n) {
  return n.toString().padStart(4, " ");
}
async function askYesNo(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise((res) => rl.question(prompt, res));
    const lower = answer.trim().toLowerCase();
    return lower === "y" || lower === "yes";
  } finally {
    rl.close();
  }
}
var SEPARATOR2 = "\u2500".repeat(60);
var FROM_SKILL_ENDPOINT = "https://www.roastrebuild.com/api/audit/from-skill";
function printExportCta(input) {
  const sizeKb = (input.bytesWritten / 1024).toFixed(1);
  const code = input.payload.claim_metadata.claim_code;
  const resumeUrl = input.payload.claim_metadata.resume_url;
  const header = [
    "",
    SEPARATOR2,
    `  \u2713 Exported to ${input.absolutePath} (${sizeKb} KB)`,
    "",
    `  Your claim code: ${code}`,
    "  Expires in 30 days.",
    SEPARATOR2,
    "",
    "  Pay $19 to unlock the full audit + 90-day roadmap:",
    "",
    "  \u2500\u2500 Option 1: curl (instant) \u2500\u2500",
    `    curl -X POST ${FROM_SKILL_ENDPOINT} \\`,
    "      -H 'Content-Type: application/json' \\",
    `      -d @${input.absolutePath}`,
    "",
    "  \u2500\u2500 Option 2: scan QR with your phone \u2500\u2500"
  ];
  process.stderr.write(header.join("\n") + "\n");
  qrcode__default.default.generate(resumeUrl, { small: true }, (qr) => {
    process.stderr.write(indent(qr, "    ") + "\n");
  });
  const footer = [
    `    \u2192 ${resumeUrl}`,
    "",
    "  \u2500\u2500 Option 3: visit /resume and paste \u2500\u2500",
    "    https://www.roastrebuild.com/resume",
    `    Code: ${code}`,
    "",
    SEPARATOR2,
    ""
  ];
  process.stderr.write(footer.join("\n"));
}
function indent(text, prefix) {
  return text.split("\n").map((line) => line.length > 0 ? prefix + line : line).join("\n");
}
var ROAST_DIR_NAME = ".roast";
var LAST_AUDIT_FILE = "last-audit.json";
var TRIAGE_FILE = "triage.json";
var TriageEntrySchema = z.object({
  status: FindingStatusSchema,
  note: z.string().optional(),
  updatedAt: z.string().datetime()
}).strict();
var TriageFileSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.record(z.string().min(1), TriageEntrySchema)
}).strict();
var EMPTY_TRIAGE = /* @__PURE__ */ new Map();
function getRoastDir(cwd) {
  return path.join(cwd, ROAST_DIR_NAME);
}
async function ensureRoastDir(cwd) {
  const dir = getRoastDir(cwd);
  await promises.mkdir(dir, { recursive: true });
  return dir;
}
async function loadPreviousRun(cwd) {
  const path$1 = path.join(getRoastDir(cwd), LAST_AUDIT_FILE);
  let raw;
  try {
    raw = await promises.readFile(path$1, "utf8");
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const validated = RunReportSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}
async function savePreviousRun(cwd, report) {
  await ensureRoastDir(cwd);
  const path$1 = path.join(getRoastDir(cwd), LAST_AUDIT_FILE);
  await promises.writeFile(path$1, JSON.stringify(report, null, 2), "utf8");
}
async function loadTriage(cwd) {
  const path$1 = path.join(getRoastDir(cwd), TRIAGE_FILE);
  let raw;
  try {
    raw = await promises.readFile(path$1, "utf8");
  } catch (err) {
    if (isNotFound(err)) return EMPTY_TRIAGE;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_TRIAGE;
  }
  const validated = TriageFileSchema.safeParse(parsed);
  if (!validated.success) return EMPTY_TRIAGE;
  const map = /* @__PURE__ */ new Map();
  for (const [sig, entry] of Object.entries(validated.data.entries)) {
    map.set(sig, entry.status);
  }
  return map;
}
async function setTriageEntry(cwd, signature, status, note) {
  await ensureRoastDir(cwd);
  const path$1 = path.join(getRoastDir(cwd), TRIAGE_FILE);
  let existing = { schemaVersion: 1, entries: {} };
  try {
    const raw = await promises.readFile(path$1, "utf8");
    const parsed = TriageFileSchema.safeParse(JSON.parse(raw));
    if (parsed.success) existing = parsed.data;
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
  const entries = { ...existing.entries };
  if (status === null) {
    delete entries[signature];
  } else {
    entries[signature] = {
      status,
      ...{},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const next = { schemaVersion: 1, entries };
  await promises.writeFile(path$1, JSON.stringify(next, null, 2), "utf8");
}
function applyTriage(findings, triage) {
  if (triage.size === 0) return findings;
  return findings.map((f) => {
    if (f.signature === void 0) return f;
    const status = triage.get(f.signature);
    if (status === void 0) return f;
    return { ...f, status };
  });
}
function isNotFound(err) {
  return err !== null && typeof err === "object" && "code" in err && err.code === "ENOENT";
}

// src/delta.ts
function computeDelta(current, previous) {
  const previousBySig = /* @__PURE__ */ new Map();
  for (const f of previous) {
    if (f.signature !== void 0) previousBySig.set(f.signature, f);
  }
  const newOnes = [];
  const persisted = [];
  const regressed = [];
  const improved = [];
  const seenSigs = /* @__PURE__ */ new Set();
  for (const f of current) {
    if (f.signature === void 0) {
      newOnes.push({ finding: f });
      continue;
    }
    seenSigs.add(f.signature);
    const prev = previousBySig.get(f.signature);
    if (prev === void 0) {
      newOnes.push({ finding: f });
      continue;
    }
    const prevRank = SEVERITY_RANK[prev.severity];
    const currRank = SEVERITY_RANK[f.severity];
    if (currRank > prevRank) {
      regressed.push({ finding: f, previousSeverity: prev.severity });
    } else if (currRank < prevRank) {
      improved.push({ finding: f, previousSeverity: prev.severity });
    } else {
      persisted.push({ finding: f, previousSeverity: prev.severity });
    }
  }
  const fixed = [];
  for (const [sig, f] of previousBySig) {
    if (!seenSigs.has(sig)) {
      fixed.push({ finding: f });
    }
  }
  return { new: newOnes, persisted, regressed, improved, fixed };
}
function summarizeDelta(delta) {
  return {
    new: delta.new.length,
    persisted: delta.persisted.length,
    regressed: delta.regressed.length,
    improved: delta.improved.length,
    fixed: delta.fixed.length
  };
}
function formatDeltaLine(delta) {
  const s = summarizeDelta(delta);
  const parts = [];
  if (s.new > 0) parts.push(`${s.new} new`);
  if (s.persisted > 0) parts.push(`${s.persisted} persisted`);
  if (s.regressed > 0) parts.push(`${s.regressed} regressed`);
  if (s.improved > 0) parts.push(`${s.improved} improved`);
  if (s.fixed > 0) parts.push(`${s.fixed} fixed`);
  if (parts.length === 0) return "\u0394 vs previous run: no changes";
  return `\u0394 vs previous run: ${parts.join(" \xB7 ")}`;
}

// src/cli.ts
var DEFAULT_TIMEOUT_MS = 18e4;
var DEFAULT_CACHE_DIR = path.join(os.homedir(), ".claude", "skills", "roast", "runner", ".live-cache");
function parseAndValidateUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`--url is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`--url must use http or https (got ${parsed.protocol})`);
  }
  return parsed.toString();
}
function parseTriageDirective(raw) {
  const eqIdx = raw.indexOf("=");
  if (eqIdx === -1) {
    throw new Error(`--triage requires <signature>=<status> (got "${raw}")`);
  }
  const signature = raw.slice(0, eqIdx).trim();
  const statusRaw = raw.slice(eqIdx + 1).trim();
  if (signature.length === 0) {
    throw new Error("--triage signature cannot be empty");
  }
  if (statusRaw === "clear") {
    return { signature, status: null };
  }
  const parsed = FindingStatusSchema.safeParse(statusRaw);
  if (!parsed.success) {
    throw new Error(
      `--triage status must be one of: ${FindingStatusSchema.options.join(", ")}, clear (got "${statusRaw}")`
    );
  }
  return { signature, status: parsed.data };
}
function parseArgs(argv) {
  let cwd = process.cwd();
  let url;
  let cacheDir = DEFAULT_CACHE_DIR;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let enabled;
  let exportJson = false;
  let exportPath = "./roast.json";
  let exportYes = false;
  let delta = false;
  let triage;
  let help = false;
  let version = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        help = true;
        break;
      case "-v":
      case "--version":
        version = true;
        break;
      case "--cwd": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--cwd requires a value");
        cwd = path.resolve(next);
        i += 1;
        break;
      }
      case "--url": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--url requires a value");
        url = parseAndValidateUrl(next);
        i += 1;
        break;
      }
      case "--cache-dir": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--cache-dir requires a value");
        cacheDir = path.resolve(next);
        i += 1;
        break;
      }
      case "--timeout-ms": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--timeout-ms requires a value");
        const parsed = Number.parseInt(next, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(`--timeout-ms must be a positive integer (got ${next})`);
        }
        timeoutMs = parsed;
        i += 1;
        break;
      }
      case "--export-json": {
        exportJson = true;
        break;
      }
      case "--export-path": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--export-path requires a value");
        exportPath = next;
        exportJson = true;
        i += 1;
        break;
      }
      case "--export-yes": {
        exportYes = true;
        break;
      }
      case "--verifiers": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--verifiers requires a comma-separated list");
        const names = next.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        const validated = /* @__PURE__ */ new Set();
        for (const n of names) {
          const parsed = VerifierNameSchema.safeParse(n);
          if (!parsed.success) {
            throw new Error(`unknown verifier "${n}" \u2014 valid: ${VerifierNameSchema.options.join(", ")}`);
          }
          validated.add(parsed.data);
        }
        enabled = validated;
        i += 1;
        break;
      }
      case "--delta": {
        delta = true;
        break;
      }
      case "--triage": {
        const next = argv[i + 1];
        if (next === void 0) throw new Error("--triage requires <signature>=<status>");
        triage = parseTriageDirective(next);
        i += 1;
        break;
      }
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return {
    cwd,
    url,
    cacheDir,
    timeoutMs,
    enabled,
    exportJson,
    exportPath,
    exportYes,
    delta,
    triage,
    help,
    version
  };
}
function printHelp() {
  process.stdout.write(`roast-runner ${RUNNER_VERSION}

Usage: roast-runner [options]

Runs deterministic verifiers against the current repository (and optionally
a live URL) and emits a normalized JSON RunReport to stdout. Intended to
be called by the /roast Claude Code skill.

Options:
  --cwd <path>             Working directory to audit (default: process.cwd())
  --url <url>              Live URL to audit (enables live-browser + live-lighthouse
                           verifiers). Passing --url IS the explicit network
                           opt-in: the runner will make outbound HTTPS calls.
  --cache-dir <path>       Where to install playwright-chromium on first --url use
                           (default: ~/.claude/skills/roast/runner/.live-cache)
  --timeout-ms <n>         Global timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --verifiers <list>       Comma-separated subset (default: all)
                           Valid: ${VerifierNameSchema.options.join(", ")}
  --export-json            Write a sanitized roast.json to the cwd for upload to
                           roastrebuild.com (pre-fills the paid $19 audit).
                           Interactive preview + Continue? prompt before write.
  --export-path <path>     Custom path for the export (implies --export-json;
                           default: ./roast.json)
  --export-yes             Skip the interactive Continue prompt (e.g. for CI).
                           Required when stdin is not a TTY.
  --delta                  Compare this run against .roast/last-audit.json and
                           print a one-line summary (new / persisted / regressed /
                           improved / fixed) to stderr.
  --triage <sig>=<status>  Mark a finding by signature. Status: ${FindingStatusSchema.options.join(", ")}, clear.
                           Persists to .roast/triage.json. Runs without the
                           audit; emits {"triage":"<status>","signature":"..."}.
                           Example: --triage a3f7c9d2e4b18560=wont-fix
  -h, --help               Print this help
  -v, --version            Print version

State directory:
  Every successful run writes .roast/last-audit.json (the baseline for --delta)
  and respects .roast/triage.json (finding signatures \u2192 lifecycle status).
  Add .roast/ to .gitignore.

Output: JSON RunReport on stdout (schemaVersion 1). Export file on disk if
--export-json was passed. CTA + preview on stderr.
Exit codes: 0 = ran (regardless of findings); 2 = bad args; 3 = runtime error.
`);
}
async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}
`);
    return 2;
  }
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${RUNNER_VERSION}
`);
    return 0;
  }
  if (!fs.existsSync(args.cwd) || !fs.statSync(args.cwd).isDirectory()) {
    process.stderr.write(`cwd does not exist or is not a directory: ${args.cwd}
`);
    return 2;
  }
  if (args.triage !== void 0) {
    return await runTriageSubcommand(args.cwd, args.triage);
  }
  try {
    fs.mkdirSync(args.cacheDir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to create cache dir ${args.cacheDir}: ${msg}
`);
    return 2;
  }
  try {
    const rawReport = await runOrchestrator({
      cwd: args.cwd,
      cacheDir: args.cacheDir,
      timeoutMs: args.timeoutMs,
      verifiers: ALL_VERIFIERS,
      ...args.url !== void 0 ? { url: args.url } : {},
      ...args.enabled !== void 0 ? { enabled: args.enabled } : {}
    });
    const triage = await loadTriageOrWarn(args.cwd);
    const report = applyTriageToReport(rawReport, triage);
    if (args.delta) {
      await emitDeltaLine(args.cwd, report);
    }
    await savePreviousRunOrWarn(args.cwd, report);
    if (args.exportJson) {
      await handleExport(args, report);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}
`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`runtime error: ${msg}
`);
    return 3;
  }
}
function applyTriageToReport(report, triage) {
  if (triage.size === 0) return report;
  const nextResults = report.results.map((r) => ({
    ...r,
    findings: applyTriage(r.findings, triage)
  }));
  return { ...report, results: nextResults };
}
async function loadTriageOrWarn(cwd) {
  try {
    return await loadTriage(cwd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[state] warning: failed to load .roast/triage.json: ${msg}
`);
    return /* @__PURE__ */ new Map();
  }
}
async function savePreviousRunOrWarn(cwd, report) {
  try {
    await savePreviousRun(cwd, report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[state] warning: failed to save .roast/last-audit.json: ${msg}
`);
  }
}
async function emitDeltaLine(cwd, current) {
  let previous;
  try {
    previous = await loadPreviousRun(cwd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[delta] warning: failed to load .roast/last-audit.json: ${msg}
`);
    return;
  }
  if (previous === null) {
    process.stderr.write("[delta] no previous run found at .roast/last-audit.json (first run)\n");
    return;
  }
  const currentFindings = current.results.flatMap((r) => r.findings);
  const previousFindings = previous.results.flatMap((r) => r.findings);
  const delta = computeDelta(currentFindings, previousFindings);
  process.stderr.write(`${formatDeltaLine(delta)}
`);
}
async function runTriageSubcommand(cwd, directive) {
  try {
    await setTriageEntry(cwd, directive.signature, directive.status);
    const receipt = {
      triage: directive.status ?? "cleared",
      signature: directive.signature,
      path: `.roast/triage.json`
    };
    process.stdout.write(`${JSON.stringify(receipt)}
`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[triage] failed to update .roast/triage.json: ${msg}
`);
    return 3;
  }
}
async function handleExport(args, report) {
  const signal = new AbortController().signal;
  const git = await detectGitInfo(args.cwd, signal);
  const payload = buildExportPayload({
    report,
    git,
    url: args.url,
    cwd: args.cwd
  });
  const outPath = path.resolve(args.exportPath);
  const preview = await runPreview(payload, { assumeYes: args.exportYes, outPath });
  if (!preview.proceed) {
    process.stderr.write(`[export] cancelled \u2014 ${preview.reason}
`);
    return;
  }
  const { bytesWritten, absolutePath } = await writeExportPayload(payload, outPath);
  printExportCta({ payload, absolutePath, bytesWritten });
}
if (__require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}
`);
      process.exit(3);
    }
  );
}

exports.main = main;

// The config family: check book.config.json against book.schema.json, the same
// schema an editor reads through the file's `$schema` key, so the two can never
// drift apart.
//
// The check is advisory. The engine treats every key as optional and falls back
// to a default, so a config that names an unknown key, or a value the engine
// would silently ignore, still builds; every finding here is a warning, and none
// fails a build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BookConfig } from "../lib/book-config.js";
import type { Reporter } from "./errors.js";

/** The subset of JSON Schema the config file uses. */
interface Schema {
  type?: string;
  enum?: (string | number)[];
  pattern?: string;
  minimum?: number;
  exclusiveMinimum?: number;
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
}

/** book.schema.json, beside the package root the linter runs from. */
const SCHEMA_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "book.schema.json",
);

export function checkConfig(cfg: BookConfig, reporter: Reporter): void {
  const file = cfg.configFile;
  if (!fs.existsSync(file)) {
    return; // No config at all is valid: the defaults are the book.
  }

  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    reporter.warn(file, null, `does not parse as JSON: ${(error as Error).message}`);
    return;
  }

  let schema: Schema;
  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8")) as Schema;
  } catch {
    return; // Without the schema there is nothing to check against.
  }

  validate(reporter, file, schema, value, "");
}

function validate(reporter: Reporter, file: string, schema: Schema, value: unknown, at: string): void {
  const warn = (issue: string): void => {
    reporter.warn(file, null, at ? `${at}: ${issue}` : issue);
  };

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    warn(`expected ${schema.type}`);
    return;
  }
  if (schema.enum !== undefined && !schema.enum.includes(value as string | number)) {
    warn(`must be one of ${schema.enum.map(String).join(", ")}`);
    return;
  }
  if (schema.pattern !== undefined && typeof value === "string" && !new RegExp(schema.pattern).test(value)) {
    warn(`must match ${schema.pattern}`);
    return;
  }
  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) {
    warn(`must be at least ${schema.minimum}`);
    return;
  }
  if (schema.exclusiveMinimum !== undefined && typeof value === "number" && value <= schema.exclusiveMinimum) {
    warn(`must be greater than ${schema.exclusiveMinimum}`);
    return;
  }

  const properties = schema.properties;
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childAt = at ? `${at}.${key}` : key;
      const childSchema = properties?.[key];
      if (childSchema !== undefined) {
        validate(reporter, file, childSchema, child, childAt);
      } else if (schema.additionalProperties === false) {
        reporter.warn(file, null, `${childAt}: unknown key`);
      } else if (isObject(schema.additionalProperties)) {
        // A map with no fixed keys (`placeholders`): every value is checked.
        validate(reporter, file, schema.additionalProperties, child, childAt);
      }
    }
  }

  const items = schema.items;
  if (items !== undefined && Array.isArray(value)) {
    value.forEach((item, index) => validate(reporter, file, items, item, `${at}[${index}]`));
  }
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "object":
      return isObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

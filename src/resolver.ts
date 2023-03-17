import $RefParser = require('@bcherny/json-schema-ref-parser')
import {JSONSchema} from './types/JSONSchema'
import {log} from './utils'

export type DereferencedPaths = WeakMap<$RefParser.JSONSchemaObject, string>

export async function dereference(
  schema: JSONSchema,
  {cwd, resolve, $refOptions}: {cwd: string; resolve: boolean; $refOptions: $RefParser.Options}
): Promise<{dereferencedPaths: DereferencedPaths; dereferencedSchema: JSONSchema}> {
  log('green', 'dereferencer', 'Dereferencing input schema:', cwd, schema, resolve)
  const dereferencedPaths: DereferencedPaths = new WeakMap()
  if (!resolve){
    const dereferencedSchema = schema
    return {dereferencedPaths, dereferencedSchema}
  }
  const parser = new $RefParser()
  const dereferencedSchema = (await parser.dereference(cwd, schema as any, {
    ...$refOptions,
    dereference: {
      ...$refOptions.dereference,
      onDereference($ref, schema) {
        dereferencedPaths.set(schema, $ref)
      }
    }
  })) as any // TODO: fix types
  return {dereferencedPaths, dereferencedSchema}
}

import { memoize, omit } from 'lodash'
import { DEFAULT_OPTIONS, Options } from './index'
import {
  AST,
  ASTWithStandaloneName,
  hasComment,
  hasRefComment,
  hasStandaloneName,
  T_ANY,
  TArray,
  TEnum,
  TInterface,
  TIntersection,
  TNamedInterface,
  TUnion,
  T_UNKNOWN
} from './types/AST'
import { log, toSafeString } from './utils'

type Standalones = Set<string>

function generated(ast: ASTWithStandaloneName, standalones: Standalones) {
  const key = `${ast.type}:${ast.standaloneName}`
  if (standalones.has(key)) {
    return true
  }
  standalones.add(key)
  return false
}

export function generate(ast: AST, options = DEFAULT_OPTIONS): string {
  const standalones = new Set<string>()
  return (
    [
      options.bannerComment,
      declareNamedTypes(ast, standalones, options, ast.standaloneName!),
      declareNamedInterfaces(ast, standalones, options, ast.standaloneName!),
      declareEnums(ast, standalones, options)
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  ) // trailing newline
}

function declareEnums(ast: AST, standalones: Standalones, options: Options, processed = new Set<AST>()): string {
  if (processed.has(ast)) {
    return ''
  }

  processed.add(ast)
  let type = ''

  switch (ast.type) {
    case 'ENUM':
      return generateStandaloneEnum(ast, standalones, options) + '\n'
    case 'ARRAY':
      return declareEnums(ast.params, standalones, options, processed)
    case 'UNION':
    case 'INTERSECTION':
      return ast.params.reduce((prev, ast) => prev + declareEnums(ast, standalones, options, processed), '')
    case 'TUPLE':
      type = ast.params.reduce((prev, ast) => prev + declareEnums(ast, standalones, options, processed), '')
      if (ast.spreadParam) {
        type += declareEnums(ast.spreadParam, standalones, options, processed)
      }
      return type
    case 'INTERFACE':
      return getSuperTypesAndParams(ast).reduce((prev, ast) => prev + declareEnums(ast, standalones, options, processed), '')
    default:
      return ''
  }
}

function declareNamedInterfaces(ast: AST, standalones: Standalones, options: Options, rootASTName: string, processed = new Set<AST>()): string {
  if (processed.has(ast)) {
    return ''
  }

  processed.add(ast)
  let type = ''

  switch (ast.type) {
    case 'ARRAY':
      type = declareNamedInterfaces((ast as TArray).params, standalones, options, rootASTName, processed)
      break
    case 'INTERFACE':
      type = [
        hasStandaloneName(ast) &&
        (ast.standaloneName === rootASTName || options.declareExternallyReferenced) &&
        generateStandaloneInterface(ast, standalones, options),
        getSuperTypesAndParams(ast)
          .map(ast => declareNamedInterfaces(ast, standalones, options, rootASTName, processed))
          .filter(Boolean)
          .join('\n')
      ]
        .filter(Boolean)
        .join('\n')
      break
    case 'INTERSECTION':
    case 'TUPLE':
    case 'UNION':
      type = ast.params
        .map(_ => declareNamedInterfaces(_, standalones, options, rootASTName, processed))
        .filter(Boolean)
        .join('\n')
      if (ast.type === 'TUPLE' && ast.spreadParam) {
        type += declareNamedInterfaces(ast.spreadParam, standalones, options, rootASTName, processed)
      }
      break
    default:
      type = ''
  }

  return type
}

function declareNamedTypes(ast: AST, standalones: Standalones, options: Options, rootASTName: string, processed = new Set<AST>()): string {
  if (processed.has(ast)) {
    return ''
  }

  processed.add(ast)

  switch (ast.type) {
    case 'ARRAY':
      return [
        declareNamedTypes(ast.params, standalones, options, rootASTName, processed),
        hasStandaloneName(ast) ? generateStandaloneType(ast, standalones, options) : undefined
      ]
        .filter(Boolean)
        .join('\n')
    case 'ENUM':
      return ''
    case 'INTERFACE':
      return getSuperTypesAndParams(ast)
        .map(
          ast =>
            (ast.standaloneName === rootASTName || options.declareExternallyReferenced) &&
            declareNamedTypes(ast, standalones, options, rootASTName, processed)
        )
        .filter(Boolean)
        .join('\n')
    case 'INTERSECTION':
    case 'TUPLE':
    case 'UNION':
      return [
        hasStandaloneName(ast) ? generateStandaloneType(ast, standalones, options) : undefined,
        ast.params
          .map(ast => declareNamedTypes(ast, standalones, options, rootASTName, processed))
          .filter(Boolean)
          .join('\n'),
        'spreadParam' in ast && ast.spreadParam
          ? declareNamedTypes(ast.spreadParam, standalones, options, rootASTName, processed)
          : undefined
      ]
        .filter(Boolean)
        .join('\n')
    default:
      if (hasStandaloneName(ast)) {
        return generateStandaloneType(ast, standalones, options)
      }
      return ''
  }
}

function generateTypeUnmemoized(ast: AST, options: Options): string {
  const type = generateRawType(ast, options)

  if (options.strictIndexSignatures && ast.keyName === '[k: string]') {
    return `${type} | undefined`
  }

  return type
}
export const generateType = memoize(generateTypeUnmemoized)

function generateRawType(ast: AST, options: Options): string {
  log('magenta', 'generator', ast)

  if (hasStandaloneName(ast)) {
    return toSafeString(ast.standaloneName)
  }

  switch (ast.type) {
    case 'ANY':
      return 'any'
    case 'ARRAY':
      return (() => {
        const type = generateType(ast.params, options)
        return type.endsWith('"') ? '(' + type + ')[]' : type + '[]'
      })()
    case 'BOOLEAN':
      return 'boolean'
    case 'INTERFACE':
      return generateInterface(ast, options)
    case 'INTERSECTION':
      return generateSetOperation(ast, options)
    case 'LITERAL':
      return JSON.stringify(ast.params)
    case 'NUMBER':
      return 'number'
    case 'NULL':
      return 'null'
    case 'OBJECT':
      return 'object'
    case 'REFERENCE':
      return ast.params
    case 'STRING':
      return 'string'
    case 'TUPLE':
      return (() => {
        const minItems = ast.minItems
        const maxItems = ast.maxItems || -1

        let spreadParam = ast.spreadParam
        const astParams = [...ast.params]
        if (minItems > 0 && minItems > astParams.length && ast.spreadParam === undefined) {
          // this is a valid state, and JSONSchema doesn't care about the item type
          if (maxItems < 0) {
            // no max items and no spread param, so just spread any
            spreadParam = options.unknownAny ? T_UNKNOWN : T_ANY
          }
        }
        if (maxItems > astParams.length && ast.spreadParam === undefined) {
          // this is a valid state, and JSONSchema doesn't care about the item type
          // fill the tuple with any elements
          for (let i = astParams.length; i < maxItems; i += 1) {
            astParams.push(options.unknownAny ? T_UNKNOWN : T_ANY)
          }
        }

        function addSpreadParam(params: string[]): string[] {
          if (spreadParam) {
            const spread = '...(' + generateType(spreadParam, options) + ')[]'
            params.push(spread)
          }
          return params
        }

        function paramsToString(params: string[]): string {
          return '[' + params.join(', ') + ']'
        }

        const paramsList = astParams.map(param => generateType(param, options))

        if (paramsList.length > minItems) {
          /*
        if there are more items than the min, we return a union of tuples instead of
        using the optional element operator. This is done because it is more typesafe.

        // optional element operator
        type A = [string, string?, string?]
        const a: A = ['a', undefined, 'c'] // no error

        // union of tuples
        type B = [string] | [string, string] | [string, string, string]
        const b: B = ['a', undefined, 'c'] // TS error
        */

          const cumulativeParamsList: string[] = paramsList.slice(0, minItems)
          const typesToUnion: string[] = []

          if (cumulativeParamsList.length > 0) {
            // actually has minItems, so add the initial state
            typesToUnion.push(paramsToString(cumulativeParamsList))
          } else {
            // no minItems means it's acceptable to have an empty tuple type
            typesToUnion.push(paramsToString([]))
          }

          for (let i = minItems; i < paramsList.length; i += 1) {
            cumulativeParamsList.push(paramsList[i])

            if (i === paramsList.length - 1) {
              // only the last item in the union should have the spread parameter
              addSpreadParam(cumulativeParamsList)
            }

            typesToUnion.push(paramsToString(cumulativeParamsList))
          }

          return typesToUnion.join('|')
        }

        // no max items so only need to return one type
        return paramsToString(addSpreadParam(paramsList))
      })()
    case 'UNION':
      return generateSetOperation(ast, options)
    case 'UNKNOWN':
      return 'unknown'
    case 'CUSTOM_TYPE':
      return ast.params
  }
}

/**
 * Generate a Union or Intersection
 */
function generateSetOperation(ast: TIntersection | TUnion, options: Options): string {
  // generate array of types, no duplicates
  const members = (ast as TUnion).params
    .map(_ => generateType(_, options))
    .filter((value, index, self) => self.indexOf(value) === index) // unique
  const separator = ast.type === 'UNION' ? '|' : '&'
  return members.length === 1 ? members[0] : '(' + members.join(' ' + separator + ' ') + ')'
}

function generateInterface(ast: TInterface, options: Options): string {
  // If present, generate a single index signature from all patternProperties.
  let patternProperty = ''
  if (ast.params.some(_ => _.isPatternProperty)) {
    const pp = ast.params
      .filter(_ => _.isPatternProperty)
      .map(({ ast }) => [ast, generateType(ast, options)] as [AST, string])
      
    // Join all of the comments as a single comment.
    const comment = pp.filter(
      ([ast]) => hasComment(ast)
    ).map(
      ([ast]) => ast.comment
    ).join('\n')

    // Add the string key and union the types.
    patternProperty =
      (comment ? generateComment(comment) : '') +
      '\n' +
      '[k: string]:' + 
      pp.map(([ast, type]) =>  (hasStandaloneName(ast) ? toSafeString(type) : type))
        .join('|') + '\n'
  }

  const properties = ast.params
    .filter(_ => !_.isPatternProperty && !_.isUnreachableDefinition)
    .map(
      ({ isRequired, keyName, ast }) =>
        [isRequired, keyName, ast, generateType(ast, options)] as
        [boolean, string, AST, string])
    .map(
      ([isRequired, keyName, ast, type]) =>
      (hasRefComment(ast)
        ? generateComment(ast.refComment) + '\n'
        : hasComment(ast) && !ast.standaloneName
        ? generateComment(ast.comment) + '\n'
        : '') +
        escapeKeyName(keyName) +
        (isRequired ? '' : '?') +
        ': ' +
        (hasStandaloneName(ast) ? toSafeString(type) : type)
    )
    .join('\n')

  const result =  '{' + '\n' + patternProperty + properties + '}'
  return result
}

function generateComment(comment: string): string {
  return ['/**', ...comment.split('\n').map(_ => ' * ' + _), ' */'].join('\n')
}

function generateStandaloneEnum(ast: TEnum, standalones: Standalones, options: Options): string {
  if (generated(ast, standalones)) {
    return ''
  }

  return (
    (hasComment(ast) ? generateComment(ast.comment) + '\n' : '') +
    'export ' +
    (options.enableConstEnums ? 'const ' : '') +
    `enum ${toSafeString(ast.standaloneName)} {` +
    '\n' +
    ast.params.map(({ ast, keyName }) => keyName + ' = ' + generateType(ast, options)).join(',\n') +
    '\n' +
    '}'
  )
}

function generateStandaloneInterface(ast: TNamedInterface, standalones: Standalones, options: Options): string {
  if (generated(ast, standalones)) {
    return ''
  }

  return (
    (hasComment(ast) ? generateComment(ast.comment) + '\n' : '') +
    `export interface ${toSafeString(ast.standaloneName)} ` +
    (ast.superTypes.length > 0
      ? `extends ${ast.superTypes.map(superType => toSafeString(superType.standaloneName)).join(', ')} `
      : '') +
    generateInterface(ast, options)
  )
}

function generateStandaloneType(ast: ASTWithStandaloneName, standalones: Standalones, options: Options): string {
  if (generated(ast, standalones)) {
    return ''
  }

  return (
    (hasComment(ast) ? generateComment(ast.comment) + '\n' : '') +
    `export type ${toSafeString(ast.standaloneName)} = ${generateType(
      omit<AST>(ast, 'standaloneName') as AST /* TODO */,
      options
    )}`
  )
}

function escapeKeyName(keyName: string): string {
  if (keyName.length && /[A-Za-z_$]/.test(keyName.charAt(0)) && /^[\w$]+$/.test(keyName)) {
    return keyName
  }
  if (keyName === '[k: string]') {
    return keyName
  }
  return JSON.stringify(keyName)
}

function getSuperTypesAndParams(ast: TInterface): AST[] {
  return ast.params.map(param => param.ast).concat(ast.superTypes)
}
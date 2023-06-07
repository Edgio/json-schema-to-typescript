//export let exclude = true

export let only = true

export const options = {
  resolve: false
}

// export const input = {
//   additionalProperties: true,
//   properties: {
//     foo: {
//       $ref: '#/definitions/bar'
//     }
//   },
//   definitions: {
//     bar: {
//       $ref: '#/definitions/bar'
//     }
//   },
//   required: ['foo'],
//   title: 'Cycle (3)'
// }

export const input = {
  additionalProperties: true,
  properties: {
    foo: {
      $ref: '#/definitions/matches'
    },
    bar: {
      $ref: '#/definitions/headers'
    }
  },
  definitions: {
    matches: {
      type: "object",
      additionalProperties: false,
      properties: {
        matches: {
          $ref: "#/definitions/matches"
        }
      }
    },
    headers: {
      type: "object",
      properties: {
        "set_response_headers": {
          $ref: "#/definitions/http_response_header",
          description: "Set, overwrite, append, or delete one or more header(s) from the response.\n\nhttps://docs.edg.io/guides/v7/performance/rules/features#set-response-headers\n\n\nExample:\n```\nnew Router()\n  .get('/', {\n    headers: {\n      \"set_response_headers\": {\n\t\t\"sports\": \"basketball\",\n\t\t\"+broadcast\": \" ott\"\n      },\n    }\n  })\n```"
        },
        "add_response_headers": {
          $ref: "#/definitions/http_response_header",
          description: "Adds one or more header(s) to the response. \n\nhttps://docs.edg.io/guides/v7/performance/rules/features#add-response-headers"
        },
      },
      description: "Header features add, modify, or delete headers from the request or response.\n\nhttps://docs.edg.io/guides/v7/performance/rules/features#headers"
    },
    single_line_string: {
      type: "string",
      pattern: "^[a-zA-Z0-9_ :;.,\\\\'/\"?!()[\\]{}@<>=+#$&`|~^%*-]*$"
    },
    rules_variables: {
      type: "string",
      pattern: "^[a-zA-Z0-9_ :;.,\\\\'/\"?!()[\\]{}@<>=+#$&`|~^%*-]*$"
    },
    http_response_header: {
      type: "object",
      additionalProperties: false,
      patternProperties: {
        "^[+]?[-_a-zA-Z0-9 .]+$": {
          anyOf: [
            {
              "$ref": "#/definitions/single_line_string",
            },
            {
              "$ref": "#/definitions/rules_variables",
            }
          ]
        },
        "^(Accept-Ranges|Age|Connection|Content-Encoding|Content-Length|Content-Range|Date|Server|Trailer|Transfer-Encoding|Upgrade|Vary|Via|Warning|X-EC.*)$": {
          type: "null"
        }
      }
    },
  },
}
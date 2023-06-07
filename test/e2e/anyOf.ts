import * as fs from 'fs';

//export let only = true
export let exclude = true

export const options = {
  resolve: false
}

let schema = JSON.parse(fs.readFileSync("/Users/spaz/gitlab-edgecast/edgecontrol-sdk/withDocs.json", 'utf8'));

function removeKey(data: any, searchKey: string) {
  if (typeof data != "object") return;
  if (!data) return; // null object


  for (const key in data) {
      if (key == searchKey) {
          delete data[key];
      } else {
          removeKey(data[key], searchKey);
      }
  }

  return
}

removeKey(schema, "$comment")

export const input = schema 

// export const input = {
//   title: 'AnyOf',
//   type: 'object',
//   properties: {
//     rules: {
//       type: "array",
//       items: {
//         $ref: "#/definitions/rules"
//       }
//     },
//   },
//   definitions: {
//     rules: {
//       anyOf: [
//         {
//           $ref: "#/definitions/matches"
//         },
//         {
//           $ref: "#/definitions/features"
//         },
//         {
//           type: "array",
//           items: {
//             anyOf: [
//               {
//                 $ref: "#/definitions/features"
//               }
//             ]
//           }
//         }
//       ]
//     },
//     matches: {
//       type: "object",
//       additionalProperties: false,
//       properties: {
//         if: {
//           type: "array",
//           items: {
//             anyOf: [
//               {
//                 $ref: "#/definitions/matches"
//               },
//               {
//                 $ref: "#/definitions/features"
//               },
//               {
//                 type: "array",
//                 items: {
//                   anyOf: [
//                     {
//                       $ref: "#/definitions/features"
//                     },
//                     {
//                       $ref: "#/definitions/matches"
//                     }
//                   ]
//                 }
//               }
//             ]
//           },
//           minItems: 2,
//         }
//       }
//     },
//     features: {
//       type: "object",
//       additionalProperties: false,
//       properties: {
//         comment: {
//           $ref: "#/definitions/comment"
//         },
//         edge_function: {
//           $ref: "#/definitions/edge_function"
//         },
//       }
//     },
//     comment: {
//       type: "string",
//     },
//     edge_function: {
//       type: "string"
//   },
//   }
// }
// This is a Controller mixin to add methods for generating Swagger data.

// __Dependencies__
var mongoose = require.cache[require.resolve('rested')].require('mongoose');

// __Private Members__

// Convert a Mongoose type into a Swagger type
function swaggerTypeFor(type) {
  if (!type) return null;
  if (type === String) return 'string';
  if (type === Number) return 'double';
  if (type === Date) return 'date';
  if (type === Boolean) return 'boolean';
  if (type === mongoose.Schema.Types.ObjectId) return 'string';
  if (type === mongoose.Schema.Types.Oid) return 'string';
  if (type === mongoose.Schema.Types.Array) return 'Array';
  if (Array.isArray(type) || type.name === "Array") return 'Array';
  if (type === Object) return 'object';
  if (type === Buffer) return 'byte';
  if (type === mongoose.Schema.Types.Mixed || type === "Mixed") return 'object';
  if (type === mongoose.Schema.Types.Buffer) return 'byte';
  //if (type instanceof Object && Object.keys(type).length > 1) return type;
  //console.log(type);
  if (type instanceof Object) return 'object';
  throw new Error('Unrecognized type: ' + type);
}

// A method for capitalizing the first letter of a string
function capitalize(s) {
  if (!s) return s;
  if (s == '$type') return 'Type';
  if (s.length === 1) return s.toUpperCase();
  //return s[0].toUpperCase() + s.substring(1);
  return s.replace(/\.|,|-|_|(^\w+)?\:|\@|\#|\d+$/g, ' ').replace(/[^\s]{2,}/g, function (m) {
    return m.charAt(0).toUpperCase() + m.substr(1);
  }).replace(/\s/g, '');
}

// __Module Definition__
var decorator = module.exports = function () {
  var controller = this;
  var modelName = capitalize(controller.model().singular());
  var refs = {};
  var defs = {};

  // __Private Instance Members__

  // A method used to generated a Swagger property for a model
  function generatePropertyDefinition(name, path, subSchemaName) {
    var key = null;
    var property = {};
    var select = controller.select();
    var schema = controller.model().schema;
    var type = path.options.type ? swaggerTypeFor(path.options.type) : 'string'; // virtuals don't have type
    var mode = (select && select.match(/(?:^|\s)[-]/g)) ? 'exclusive' : 'inclusive';
    var exclusiveNamePattern = new RegExp('\\B-' + name + '\\b', 'gi');
    var inclusiveNamePattern = new RegExp('(?:\\B[+]|\\b)' + name + '\\b', 'gi');

    // Keep deselected paths private
    if (path.selected === false || path.options.selected === false) return {};

    // exclude _id when explicitly excluded
    if (name === '_id' && path.options.type === false) return {};


    // If it's excluded, skip this one.
    if (select && mode === 'exclusive' && select.match(exclusiveNamePattern)) return {};
    // If the mode is inclusive but the name is not present, skip this one.
    if (select && mode === 'inclusive' && name !== '_id' && !select.match(inclusiveNamePattern)) return {};

    // Configure the property
    property.type = type;
    if (path.options.required || name === '_id') {
      property.required = true;
    }
    if (path.options.default) {
      property.defaultValue = path.options.default;
    }
    ['description', 'format', 'pattern'].forEach(function (opt) {
      if (path.options[opt]) {
        property[opt] = path.options[opt]
      }
    });
    if (type === 'Array') {
      if (path.options.type[0].$ref === '$self' && name.lastIndexOf('.') > 0) {
        name = name.substr(0, name.lastIndexOf('.'));
      }
      // Is it an array of strings?
      var subSchema = null;
      if (path.caster && path.caster.instance && !path.caster.options.ref) { // an array of some basic type
        property.items = { type: path.caster.instance.toLowerCase() };
        //property.items = {type: swaggerTypeFor(path.options.type[0])};
        generateMetadata(property, path.caster.options);
        //} else if (path.caster && !path.caster.instance && path.options.type[0] && path.options.type[0].constructor.name !== 'Object') {
        //  property.items = {type: swaggerTypeFor(path.options.type[0])};
      } else { // an array of complex type
        subSchema = {};
        if (!path.caster.options || !path.caster.options.ref) {
          property.items = { $ref: (subSchemaName || modelName) + capitalize(name) };
          subSchema[(subSchemaName || modelName) + capitalize(name)] = path.schema;
        } else {
          key = capitalize(mongoose.model(path.caster.options.ref).singular());
          if (key == (subSchemaName || modelName) && path.caster.options.ref !== controller.model().modelName) {
            key = (subSchemaName || modelName) + capitalize(name)
            subSchema[key] = mongoose.model(path.caster.options.ref).schema;
          }
          property.items = { $ref: key };
        }
      }
    } else {
      // Set type when it references another model
      if (path.options.ref == controller.model().modelName) {
        key = capitalize(controller.model().singular());
        property.type = key;
        property.$ref = key;
      } else if (path.options.ref) {
        subSchema = {};
        key = capitalize(mongoose.model(path.options.ref).singular());
        if (key == (subSchemaName || modelName) && path.options.ref !== controller.model().modelName) {
          key = (subSchemaName || modelName) + capitalize(name)
          subSchema[key] = mongoose.model(path.options.ref).schema;
        }
        property.type = key;
        property.$ref = key;
      }
      // Set default type as string
      if (!property.type) {
        property.type = 'string';
      }
      generateMetadata(property, path.options);
    }
    var retVal = { property: property };
    if (subSchema) {
      retVal['schema'] = subSchema;
    }
    return retVal;
  }

  function generateMetadata(property, options) {
    // Set enum values if applicable
    if (options.enum && options.enum.length > 0) {
      property.allowableValues = { valueType: 'LIST', values: options.enum };
    }
    // Set allowable values range if min or max is present
    if (!isNaN(options.min) || !isNaN(options.max)) {
      property.allowableValues = { valueType: 'RANGE' };
    }
    // Set min value if applicable
    if (!isNaN(options.min)) {
      property.allowableValues.min = options.min;
    }
    // Set max value if applicable
    if (!isNaN(options.max)) {
      property.allowableValues.max = options.max;
    }
  }

  function generateModelRefs() {
    var definition = {};

    var created = false;
    var schema = controller.model().schema;
    var subSchemas = [];
    Object.keys(schema.paths).forEach(function (name) {
      alias = null
      if (schema.paths[name].options.alias) {
        alias = schema.paths[name].options.alias;
      }
      var names = (alias || name).split('.');
      if (names.length > 1) {
        var id = modelName;
        for (var i = 0, l = names.length - 1; i < l; i++) {
          id += capitalize(names[i]);
          if (!definition[id]) {
            definition[id] = { id: id, properties: {} };
          }
          var path = schema.paths[name];
          if (path.selected === false || path.options.selected === false) return;
          var prop = generatePropertyDefinition(name, path);
          var property = prop.property;
          if (prop.schema) {
            subSchemas.push(prop.schema);
          }
          names[i + 1] = names[i + 1].replace('$type', 'type');
          if (i < (l - 1)) {
            definition[id].properties[names[i + 1]] = {
              $ref: id + capitalize(names[i + 1]),
              type: id + capitalize(names[i + 1])
            };
          } else if (property) {
            definition[id].properties[names[i + 1]] = property;
          }
        }
      }
    });
    Object.keys(subSchemas).forEach(function (subSchema) {
      Object.keys(subSchemas[subSchema]).forEach(function (subSchemaName) {
        if (refs[subSchemaName]) return; // Skip when generateModelDefinition() has already dealt with this subschema
        Object.keys((subSchemas[subSchema][subSchemaName] || {}).paths || {}).forEach(function (name) {
          if (!definition[subSchemaName]) {
            definition[subSchemaName] = { id: capitalize(subSchemaName), properties: {} };
          }
          var path = subSchemas[subSchema][subSchemaName].paths[name];
          if (path.selected === false || path.options.selected === false) return;
          var prop = generatePropertyDefinition(name, path, subSchemaName);
          var property = prop.property;
          if (property) {
            definition[subSchemaName].properties[name] = property;
          }
        });
      });
    });
    return definition;
  }

  // A method used to generate a Swagger model definition for a controller
  function generateModelDefinition() {
    var definition = {};
    var schema = controller.model().schema;

    definition.id = capitalize(controller.model().singular());
    definition.properties = {};

    var subSchemas = [];
    Object.keys(schema.paths).forEach(function (name) {
      var path = schema.paths[name];
      if (path.selected === false || path.options.selected === false) return;
      var prop = generatePropertyDefinition(name, path);
      var property = prop.property;
      if (prop.schema) {
        subSchemas.push(prop.schema);
      }
      if (schema.paths[name].options.alias) {
        name = schema.paths[name].options.alias;
      }
      var names = name.split('.');
      if (names.length < 2) {
        if (property) {
          definition.properties[name] = property;
        }
      } else {
        definition.properties[names[0]] = {
          $ref: modelName + capitalize(names[0]),
          type: modelName + capitalize(names[0])
        };
      }
    });

    Object.keys(schema.virtuals).forEach(function (name) {
      var path = schema.virtuals[name];
      if (!path.options.ref || path.options.selected === false) return;
      var prop = generatePropertyDefinition(name, path);
      var property = prop.property;
      if (path.options.justOne !== true) {
        property = { type: "Array", items: property };
      }
      definition.properties[name] = property;
    });

    retVal = { definition: definition };
    if (subSchemas.length) {
      var refs = {};
      for (var subSchema = 0; subSchema < subSchemas.length; subSchema++) {
        Object.keys(subSchemas[subSchema]).forEach(function (subSchemaName) {
          Object.keys((subSchemas[subSchema][subSchemaName] || {}).paths || {}).forEach(function (name) {
            if (!refs[subSchemaName]) {
              refs[subSchemaName] = {
                id: capitalize(subSchemaName),
                properties: {}
              };
            }
            var path = subSchemas[subSchema][subSchemaName].paths[name];
            if (path.selected === false || path.options.selected === false) return;
            var prop = generatePropertyDefinition(name, path, subSchemaName);
            var property = prop.property;
            if (prop.schema) {
              found = false
              subSchemas.forEach(function (sub) {
                found = found || Object.keys(sub)[0] == Object.keys(prop.schema)[0];
              });
              if (!found) {
                subSchemas.push(prop.schema);
              }
            }
            var path = subSchemas[subSchema][subSchemaName].paths[name];
            if (path.selected === false || path.options.selected === false) return;
            if (path.options.alias) {
              name = path.options.alias;
            }
            name = name.replace('$type', 'type');
            var names = name.split('.');
            if (names.length > 1) {
              for (var i = 0, l = names.length - 1; i < l; i++) {
                id = subSchemaName + capitalize(names[i]);
                if (!refs[id]) {
                  refs[id] = { id: id, properties: {} };
                }
                if (i < (l - 1)) {
                  refs[id].properties[names[i + 1]] = {
                    $ref: subSchemaName + capitalize(names[i + 1]),
                    type: subSchemaName + capitalize(names[i + 1])
                  };
                } else if (property) {
                  refs[id].properties[names[i + 1]] = property;
                }
              }
              refs[subSchemaName].properties[names[0]] = {
                $ref: subSchemaName + capitalize(names[0]),
                type: subSchemaName + capitalize(names[0])
              };
            } else if (property) {
              refs[subSchemaName].properties[name] = property;
            }
          });
        });
      };
      retVal.refs = refs;
    }
    definition.description = (definition.properties['_xsi:schemaLocation'] || {}).defaultValue
    return retVal;
  };

  // Generate parameter list for operations
  function generateParameters(verb, plural) {
    var parameters = [];

    // Parameters available for singular routes
    if (!plural) {
      parameters.push({
        paramType: 'path',
        name: 'id',
        description: 'The ID of a ' + controller.model().singular(),
        dataType: 'string',
        required: true,
        allowMultiple: false
      });
      /*
      parameters.push({
        paramType: 'header',
        name: 'X-Baucis-Update-Operator',
        description: '**BYPASSES VALIDATION** May be used with PUT to update the document using $push, $pull, or $set.',
        dataType: 'string',
        required: false,
        allowMultiple: false
      });
      */
    }

    parameters.push({
      paramType: 'query',
      name: 'conditions',
      description: 'Set the conditions to find or remove document(s).',
      dataType: 'string',
      required: false,
      allowMultiple: false
    });

    // Parameters available for singular and plural routes
    if ((controller.model().defaults || {}).selectable !== false)
      parameters.push({
        paramType: 'query',
        name: 'select',
        description: 'Select which paths will be returned or <a href="//docs.mongodb.com/manual/reference/operator/aggregation/project/">$project</a> {}.',
        dataType: 'string',
        required: false,
        allowMultiple: false
      });

    // Parameters available for plural routes
    if (plural) {
      parameters.push({
        paramType: 'query',
        name: 'skip',
        description: 'How many documents to skip.',
        dataType: 'int',
        required: false,
        allowMultiple: false
      });

      parameters.push({
        paramType: 'query',
        name: 'limit',
        description: 'The maximum number of documents to send.',
        dataType: 'int',
        required: false,
        allowMultiple: false
      });

      parameters.push({
        paramType: 'query',
        name: 'count',
        description: 'Set to true to return count instead of documents.',
        dataType: 'boolean',
        required: false,
        allowMultiple: false
      });

      if ((controller.model().defaults || {}).sortable !== false)
        parameters.push({
          paramType: 'query',
          name: 'sort',
          description: 'Set the fields by which to sort.',
          dataType: 'string',
          required: false,
          allowMultiple: false
        });

      if ((controller.model().defaults || {}).unwindable !== false)
        parameters.push({
          paramType: 'query',
          name: 'unwind',
          description: 'Select which array paths to unwind.',
          dataType: 'string',
          required: false,
          allowMultiple: false
        });

      if ((controller.model().defaults || {}).groupable !== false)
        parameters.push({
          paramType: 'query',
          name: 'group',
          description: 'Set the fields by which to group by or <a href="//docs.mongodb.com/manual/reference/operator/aggregation/group/">$group</a> {}.',
          dataType: 'string',
          required: false,
          allowMultiple: false
        });

      if ((controller.model().defaults || {}).selectable !== false)
        parameters.push({
          paramType: 'query',
          name: 'distinct',
          description: 'Select which path to return the distinct values of.',
          dataType: 'string',
          required: false,
          allowMultiple: false
        });
    }

    if (controller.model().schema.xrefs() && !(controller.model().defaults || {}).populate)
      parameters.push({
        paramType: 'query',
        name: 'populate',
        description: 'Specify which paths to populate.',
        dataType: 'string',
        required: false,
        allowMultiple: true,
        enum: controller.model().schema.xrefs().toString().split(',')
      });

    if (verb === 'get') {
      parameters.push({
        paramType: 'query',
        name: 'explain',
        description: 'Set to true to explore the query execution plan.',
        dataType: 'boolean',
        required: false,
        allowMultiple: false
      });
    }

    if (verb === 'post') {
      // TODO post body can be single or array
      parameters.push({
        paramType: 'body',
        name: 'document',
        description: 'Create a document by sending the paths to be updated in the request body.',
        dataType: capitalize(controller.model().singular()),
        required: true,
        allowMultiple: false
      });
    }

    if (verb === 'put') {
      parameters.push({
        paramType: 'body',
        name: 'document',
        description: 'Update a document by sending the paths to be updated in the request body.',
        dataType: capitalize(controller.model().singular()),
        required: true,
        allowMultiple: false
      });
    }

    return parameters;
  };

  function generateErrorResponses(plural) {
    var errorResponses = [];

    // TODO other errors (400, 403, etc. )

    // Error rosponses for singular operations
    if (!plural) {
      errorResponses.push({ code: 204, reason: 'No ' + controller.model().singular() + ' was found with that ID.' });
    }

    // Error rosponses for plural operations
    if (plural) {
      errorResponses.push({ code: 204, reason: 'No ' + controller.model().plural() + ' matched that query.' });
    }

    // Error rosponses for both singular and plural operations
    // None.

    return errorResponses;
  };

  // Generate a list of a controller's operations
  function generateOperations(plural) {
    var operations = [];

    controller.methods().forEach(function (verb) {
      var operation = {};
      var titlePlural = capitalize(controller.model().plural());
      var titleSingular = capitalize(controller.model().singular());

      // Don't do head, post/put for single/plural
      if (verb === 'head') return;
      if (verb === 'post' && !plural) return;
      if (verb === 'put' && plural) return;

      // Use the full word
      if (verb === 'del') verb = 'delete';

      operation.httpMethod = verb.toUpperCase();

      if (plural) {
        if (verb === "get") {
          //operation.type = "array"
          operation.responseClass = "Array[" + titleSingular + "]";
          //operation.items = { $ref: titleSingular }
        } else if (verb === "delete") {
          operation.type = "void"
        }
        operation.nickname = verb + titlePlural;
        operation.summary = capitalize(verb) + ' some ' + controller.model().plural();
      } else {
        if (verb === "get") {
          //operation.type = titleSingular
          operation.responseClass = titleSingular;
        } else if (verb === "delete") {
          operation.type = "void"
        }
        operation.nickname = verb + titleSingular + 'ById';
        operation.summary = capitalize(verb) + ' a ' + controller.model().singular() + ' by its unique ID';
      }
      operation.parameters = generateParameters(verb, plural);
      operation.errorResponses = generateErrorResponses(plural);

      operations.push(operation);
    });

    return operations;
  };

  // optimise model refs by reusing types that has exact same properties
  function simplifyModelRefs() {
    var map = {}
    var replace = {}
    Object.keys(controller.swagger.models).sort(function (a, b) { return a.length == b.length ? a.localeCompare(b) : a.length - b.length }).forEach(function (name) {
      key = Object.keys(controller.swagger.models[name].properties).sort().join(',')
      if (map[key] && key != map[key]) {
        replace[name] = map[key];
        delete controller.swagger.models[name];
      } else {
        map[key] = name;
      }
    });
    Object.keys(controller.swagger.models).forEach(function (model) {
      properties = controller.swagger.models[model].properties;
      Object.keys(properties).forEach(function (prop) {
        prop = properties[prop];
        if (prop.type == 'Array' && replace[prop.items.$ref]) {
          prop.items.$ref = replace[prop.items.$ref];
        } else if (prop.$ref && replace[prop.$ref]) {
          prop.type = prop.$ref = replace[prop.type];
        }
      });
    });
  };

  // __Build the Definition__
  controller.generateSwagger = function () {
    if (controller.swagger) return controller;

    controller.swagger = { apis: [], models: {} };

    // Model
    var refs = null;
    var defs = generateModelDefinition();
    controller.swagger.models[modelName] = defs.definition;
    if (defs.refs) {
      refs = defs.refs;
      Object.keys(refs).forEach(function (name) {
        controller.swagger.models[name] = refs[name];
      });
    }
    refs = generateModelRefs();
    Object.keys(refs).forEach(function (name) {
      controller.swagger.models[name] = refs[name];
    });

    if (Object.keys(controller.swagger.models).length > 999) {
      simplifyModelRefs();
    }

    // Collection route
    controller.swagger.apis.push({
      path: '/' + controller.model().plural(),
      description: 'Operations about ' + controller.model().plural(),
      operations: generateOperations(true)
    });

    // Instance route
    if (controller.model().schema.options._id !== false || controller.findBy() !== '_id')
      controller.swagger.apis.push({
        path: '/' + controller.model().plural() + '/{id}',
        description: 'Operations about a given ' + controller.model().singular(),
        operations: generateOperations(false)
      });

    return controller;
  };

  return controller;
};

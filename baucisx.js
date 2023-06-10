
const async = require('async');
const _ = require('underscore');
const rested = require('rested');
const es = require('event-stream');
const mongoose = require('mongoose');

const alias = function (path, root = '') {
	let p, pp, ref, ref1, ref2, ref3, s;
	// skip mongo query operators
	if ((ref1 = path[0]) === '$' || ref1 === '~')
		return path;
	// skip aggregation specific keys
	if (['input', 'as', 'in', 'cond', 'format', 'timezone', 'vars', 'initialValue', 'if', 'else', 'then', 'case', 'default', 'branches', 'defaults', 'inputs'].includes(path)) //,'date'
		return path;
	// skip if called with schema unknown
	if (!(this instanceof mongoose.Schema))
		return path;
	// skip include/exclude operators
	if ((path != null) && path[0] === '-')
		return path[0] + alias.call(this, path.substr(1), root);
	// if path already starts with root then skip root
	if (!!root && (path != null ? path.indexOf(root) : void 0) === 0)
		return alias.call(this, path.substr(root.length), root);
	// find exact matching path
	p = this.path(path);
	// skip root when alias is set to false
	if ((p != null ? (ref2 = p.options) != null ? ref2.alias : void 0 : void 0) === false || !!(p != null ? (ref3 = p.options) != null ? ref3.alias : void 0 : void 0) || path === '_id' || root.indexOf(`${path}.`) === 0)
		root = '';
	// return the exact schema path if found
	if ((p != null ? p.path.split('.').length : void 0) >= path.split('.').length)
		return root + p.path;
	// find path with exact alias match
	p = _.find(this.paths, p => p.options.alias === path);
	// skip root when alias is set to false
	if ((p != null ? p.options.alias : void 0) === false || !!(p != null ? p.options.alias : void 0))
		root = '';
	// return the exact alias if found
	if (p != null)
		return root + p.path;
	// fall back to the same path if not found and it is not a complex path
	if (path.indexOf('.') < 0)
		return root + path;
	// take out the last part of a complex path
	s = path.substr(path.lastIndexOf('.') + 1);
	// try to find the first part of the path excluding the last part
	p = alias.call(this, path.substr(0, path.lastIndexOf('.')), '');
	// fall back to the same path if still not found
	if (p == null)
		return root + path;
	// find the schema of the complex path
	while (!(pp = this.path(p)) && p.indexOf('.') > 0) {
		s = p.substr(p.lastIndexOf('.') + 1) + '.' + s;
		p = p.substr(0, p.lastIndexOf('.'));
	}
	if (pp == null)
		return root + path;
	// find the alias of the last part of a complex path with a internal or external schema
	s = (pp.schema ? alias.call(pp.schema, s, '') : void 0) || s;
	// find the alias of the last part of a complex path with a external schema
	s = (!!(ref = xref(pp)) ? alias.call(xmodel(ref).schema, s, '') : void 0) || s;
	// return the combined aliases for complex path
	return root + p + '.' + s;
};

const rearrange = function (conditions, populate, cast) {
	var elemMatch, i, j, l, n, populated, q, ref1, ref2, ref3, schema;
	schema = this;
	elemMatch = [];
	//return root + pp.path + p.substr(pp.path.length) + '.' + s # why using pp.path instead of p?
	if (conditions == null) {
		return {};
	}
	if (conditions.constructor.name !== 'String') {
		// stringify conditions if not passed as a string already
		conditions = JSON.stringify(conditions);
	}
	// this step is important to eliminate all undefined properties
	conditions = JSON.parse(conditions);
	if (cast !== false && conditions.constructor.name !== 'String') {
		// ensure data type casting takes place before rearraning conditions
		mongoose.Query.prototype.cast({
			schema: schema
		}, conditions);
	}
	// stringify again after taking out undefined properties and type casting
	conditions = JSON.stringify(conditions);
	if ((conditions != null ? conditions.indexOf('$elemMatch') : void 0) > 0) {
		for (i = j = 0; j <= 3; i = ++j) {
			// take out the $elemMatch(s) before mapping of aliased field
			conditions = conditions.replace(/\{"\$elemMatch":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}}/gm, function (txt) {
				return `"@elemMatch${elemMatch.push(txt)}"`;
			});
		}
	}
	if ((conditions != null ? conditions.indexOf('$map') : void 0) > 0) {
		for (i = l = 0; l <= 3; i = ++l) {
			// take out the $map.in(s) before mapping of aliased field
			conditions = conditions.replace(/"in":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}/gm, function (txt) {
				return `"@elemMatch${elemMatch.push(txt)}"`;
			});
		}
	}
	if (conditions) {
		// map aliased fields to their underlying paths
		conditions = conditions.replace(/"[^"{},\$]+(?=":)/gm, function (txt) {
			return '"' + schema.alias(txt.substr(1));
		});
	}
	if (conditions) {
		// map aliased fields to their underlying paths when prefixed with $ as in $group, $project and $unwind
		conditions = conditions.replace(/"\$[^"{},\$]+(?="[\],}])/gm, function (txt) {
			return '"$' + schema.alias(txt.substr(2));
		});
	}
	for (i = n = 0, ref1 = elemMatch.length; (0 <= ref1 ? n <= ref1 : n >= ref1); i = 0 <= ref1 ? ++n : --n) {
		// handle aliasing within the $elemMatch object
		if ((ref2 = conditions.match(/(?!=")([^"{},]+)":({"\$\w+":)?"\@elemMatch(\d+)(?=")/gm)) != null) {
			ref2.map(function (m) {
				return [m.split('"')[0], parseInt(m.split('@elemMatch')[1])];
			}).forEach(function (m) {
				return elemMatch[m[1] - 1] = elemMatch[m[1] - 1].replace(/(?!=")[^"{},]+(?=":)/gm, function (txt) {
					return schema.alias(m[0] + '.' + txt).replace(new RegExp(`^.*?${m[0]}\\.`), '');
				});
			});
		}
	}
	for (i = q = 0, ref3 = elemMatch.length; (0 <= ref3 ? q <= ref3 : q >= ref3); i = 0 <= ref3 ? ++q : --q) {
		// put back $elemMatch(s) as mapping aliased fields
		conditions = conditions.replace(/"\@elemMatch\d+"/gm, function (txt) {
			return elemMatch[parseInt(txt.substr(11)) - 1];
		});
	}
	// handle short handed regex matches to appropriate mongo regex query
	conditions = conditions.replace(/:"\/([^"]+)\/([igm]+)"/g, ':{"$regex":"$1","$options":"$2"}');
	// undo the aliasing for conditions targeted to populated models, this will be handled later on
	populated = (populate != null ? typeof populate.map === "function" ? populate.map(function (p) {
		return p.path;
	}).join(' ') : void 0 : void 0) || populate;
	if (!!populated) {
		conditions = conditions.replace(new RegExp('"(\\$or|\\$and)":\\[{"(' + populated.trim().split(' ').join('|') + ')\.', 'gm'), '"$2.$1":[{"$2.');
	}
	// ensure dates always have time parts when before sending to mongo
	conditions = conditions.replace(new RegExp('"(' + RegExp.ISODate + ')"', "g"), '"$1T00:00:00Z"');
	// parse conditions back into object
	conditions = JSON.parse(conditions);
	if (cast !== false) {
		// ensure data type casting takes place post rearraning conditions
		mongoose.Query.prototype.cast({
			schema: schema
		}, conditions);
	}
	// delete conditions targeted to populated objects when not populated
	Object.keys(conditions).filter(function (k) {
		return k.match(/\.\$and$/);
	}).map(function (k) {
		return k.split('.$and')[0];
	}).filter(function (k) {
		return populated.split(' ').indexOf(k) < 0;
	}).forEach(function (k) {
		return Object.keys(conditions).filter(function (k2) {
			return k2.indexOf(k) === 0;
		}).forEach(function (k2) {
			return delete conditions[k2];
		});
	});
	return conditions;
};

const refs = function () {
	return _.uniq(_.filter(_.union(_.map(this.virtuals, function (v) {
		return v.options.ref;
	}), _.map(this.paths, function (p) {
		var ref1, ref2;
		return p.options.ref || ((ref1 = p.options.type) != null ? (ref2 = ref1[0]) != null ? ref2.ref : void 0 : void 0) || (p.schema != null ? refs.call(p.schema) : void 0);
	}), function (r) {
		return !!r;
	}))).toString();
};

const xrefs = function () {
	return _.uniq(_.filter(_.union(_.map(this.virtuals, function (v) {
		if (v.options.ref) {
			return v.path;
		}
	}), _.flatten(_.map(this.paths, function (p) {
		var ref1, ref2, ref3, ref4, ref5;
		return (p.options.ref || (p != null ? (ref1 = p.caster) != null ? (ref2 = ref1.options) != null ? ref2.ref : void 0 : void 0 : void 0) || ((ref3 = p.options.type) != null ? (ref4 = ref3[0]) != null ? ref4.ref : void 0 : void 0) ? p.options.alias || p.path : void 0) || ((ref5 = (p.schema != null ? xrefs.call(p.schema) : void 0)) != null ? ref5.split(',').map(function (pp) {
			if (!!pp) {
				return `${p.path}.${pp}`;
			}
		}) : void 0);
	})), function (r) {
		return !!r;
	}))).toString();
};

const xmodel = function (modelName) {
	var ref1;
	return mongoose.models[modelName] || ((ref1 = _.find(mongoose.connections, function (c) {
		return c.models[modelName];
	})) != null ? ref1.models[modelName] : void 0);
};

const xref = function (path) {
	var ref1, ref2, ref3, ref4, ref5, ref6;
	return (path != null ? (ref1 = path.options) != null ? ref1.ref : void 0 : void 0) || (path != null ? (ref2 = path.caster) != null ? (ref3 = ref2.options) != null ? ref3.ref : void 0 : void 0 : void 0) || (path != null ? (ref4 = path.options) != null ? (ref5 = ref4.type) != null ? (ref6 = ref5[0]) != null ? ref6.ref : void 0 : void 0 : void 0 : void 0);
};

const xpath = function (path) {
	var p;
	p = this.paths[_.find(Object.keys(this.paths), function (p) {
		return path.indexOf(p) === 0;
	})];
	if (p == null) {
		p = this.virtuals[_.find(Object.keys(this.virtuals), function (p) {
			return path.indexOf(p) === 0;
		})];
	}
	if (((p != null ? p.schema : void 0) == null) || p.path === path) {
		return p;
	}
	return xpath.call(p.schema, path.substr(p.path.length + 1));
};

const aggregator = function (conditions) {
	var aggregate, ref1, ref2, ref3;
	// determine the aggregation pipeline steps either by calling a function or append to the conditions
	// must clone the aggregation pipeline to avoid any modifications to the original defaults.aggregate
	conditions = JSON.parse(JSON.stringify(conditions));
	aggregate = _.filter(JSON.parse(JSON.stringify(((ref1 = this.defaults) != null ? (ref2 = ref1.aggregate) != null ? typeof ref2.call === "function" ? ref2.call(conditions) : void 0 : void 0 : void 0) || [
		{
			$match: conditions
		}
	].concat(((ref3 = this.defaults) != null ? ref3.aggregate : void 0) || [])).replace(/\{"\$[a-z]+":{}}/g, 'null')));
	// the call to cursor() is required to ensure that a readable stream of aggregation results is created
	aggregate = this.aggregate(aggregate).allowDiskUse(true);
	// any selected fields should come last in the aggregation pipeline
	aggregate.select = function (fields) {
		fields = (!!fields && fields.constructor.name === 'String' ? JSON.parse(`{${fields.replace(/[\s|\+]?(-)?([\w|\.|\:|\#|\@]+)/g, ',"$2":$11').substr(1)}}`) : void 0) || fields || {};
		// fix for "The top-level _id field is the only field currently supported for exclusion"
		if (_.find(_.values(fields), function (v) {
			return !(v === 0 || v === (-1));
		}) != null) {
			Object.keys(fields).forEach(function (k) {
				if (fields[k] < 1 && k !== '_id') {
					return delete fields[k];
				}
			});
		} else {
			Object.keys(fields).forEach(function (k) {
				if (fields[k] < 1) {
					return fields[k] = 0;
				}
			});
		}
		if (Object.keys(fields).length === 1) {
			// if only _id is deselected while no other explicit selection specificed
			delete fields._id;
		}
		if (Object.keys(fields).length > 0) {
			// only project if there is a meaningful selection criteria
			this.append({
				$project: fields
			});
		}
		return this;
	};
	// capture the fields needs population to be used later within the streamed results
	aggregate.populate = function (path) {
		var base;
		if (path.constructor.name === 'String') {
			this.options.populate = path;
		} else {
			if ((base = this.options).populate == null) {
				base.populate = [];
			}
			this.options.populate.push(path);
		}
		return this;
	};
	// support lean function to skip instantiating a model instance for each doc
	aggregate.lean = function () {
		this.options.lean = true;
		return this;
	};
	// support hint function to allow using specific index by the query optimiser
	aggregate.hint = function (hint) {
		this.options.hint = hint;
		return this;
	};
	// support comment function to allow capturing extra query stats
	aggregate.comment = function (str) {
		this.options.comment = str;
		return this;
	};
	// support hint function to allow using specific index by the query optimiser
	aggregate.batchSize = function (size) {
		this.options.cursor = {
			batchSize: size
		};
		return this;
	};
	// support set extra options when provided
	aggregate.setOptions = function (opt) {
		_.extend(this.options, opt);
		return this;
	};
	// mimic the Query.stream() method by returning a the readable stream that yields the results.
	// the underlying MongoDB driver aggregate() menthod is used as this presents a readable stream using the cursor option
	aggregate.cursor = function () {
		var _model, _pipeline, _populate, base, cursor, ref4, relocate, safe, sort, stream;
		_model = this._model;
		_populate = this.options.populate;
		if (!!_populate && !Array.isArray(_populate) && _populate.constructor.name !== 'String') {
			// turn populate into an array of population object instead of a plain key/value pair
			_populate = Object.values(_populate || {});
		}
		// mute populate option from db
		delete this.options.populate;
		// disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete this.options.hint;
		delete this.options.comment;
		// default cursor batchSize if not set
		if ((base = this.options).cursor == null) {
			base.cursor = {
				batchSize: 2000
			};
		}
		// ignore $natural sort as it can't work with aggregation
		this._pipeline.filter(function (o) {
			return o.$sort != null;
		}).forEach(function (obj) {
			if (delete obj.$sort.$natural && Object.keys(obj.$sort).length === 0) {
				return delete obj.$sort;
			}
		});
		// remove empty objects in the pipeline
		this._pipeline = _.reject(this._pipeline, function (obj) {
			return Object.keys(obj).length === 0;
		});
		// find the safe point to optimise the pipeline
		safe = _.max(this._pipeline.map(function (op, i) {
			var ref4;
			return ((op != null) && ((op.$group != null) || op.$match || ((ref4 = op.$lookup) != null ? ref4.pipeline : void 0) || (op.$unwind && op.$unwind.preserveNullAndEmptyArrays !== true) || op.$replaceRoot || op.$addFields) ? i : void 0) || 0;
		}));
		// optimise sort, skip and limit position in the pipeline
		relocate = _.uniq(this._pipeline.filter(function (op) {
			return (op.$sort != null) || (op.$skip != null) || (op.$limit != null);
		}), function (op) {
			return JSON.stringify(op);
		});
		sort = Object.keys(((ref4 = _.find(relocate, function (op) {
			return op.$sort;
		})) != null ? ref4.$sort : void 0) || {});
		if (sort.length > 0) {
			safe = Math.max(safe, _.max(this._pipeline.map(function (op, i) {
				return (i > safe && !_.isEmpty(_.pick(op != null ? op.$project : void 0, function (v, k) {
					return isNaN(v) && sort.indexOf(k) >= 0;
				})) ? i : void 0) || 0;
			})));
		}
		_pipeline = _.reject(this._pipeline, function (op, ix) {
			return (ix > safe && (op.$sort != null)) || (op.$skip != null) || (op.$limit != null);
		});
		relocate.forEach(function (op) {
			return _pipeline.splice(++safe, 0, op);
		});
		// create the cursor using aggregation on the underying model collection
		stream = cursor = _model.collection.aggregate(_pipeline, this.options);
		if (!!_populate) {
			// populate each document for the requested paths
			stream = stream != null ? stream.pipe(es.map(function (doc, nxt) {
				return _model.populate.call(_model, doc, _populate, nxt);
			})) : void 0;
		}
		if (this.options.lean !== true) {
			// create mongoose model for each of the document returned by the cursor
			stream = stream != null ? stream.pipe(es.map(function (doc, nxt) {
				return nxt(null, new _model(doc));
			})) : void 0;
		}
		if (cursor === stream) {
			return cursor;
		}
		// wire up the stream close to the underlying aggregation cursor close
		stream.on('close', function () {
			return cursor.destroy.call(cursor);
		});
		stream.pause = function () {
			return cursor.pause.call(cursor, stream.paused = true);
		};
		stream.resume = function () {
			return cursor.resume.call(cursor, stream.paused = false);
		};
		// return the piped stream or the underlying cursor
		return stream;
	};
	// implement the query.count interface
	aggregate.count = function (callback) {
		var project, ref4, ref5, ref6, ref7, ref8, safe, sum, unwind;
		sum = 1;
		// no need for a cursor
		delete this.options.cursor;
		// populate is useless
		delete this.options.populate;
		// disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete this.options.hint;
		delete this.options.comment;
		// find the safe point to optimise the pipeline
		safe = _.max(this._pipeline.map(function (op, i) {
			return ((op != null ? op.$group : void 0) != null ? i : void 0) || 0;
		}));
		// for lookups only keep the ones that are followed by $unwind without preserveNullAndEmptyArrays as it won't affect the count calculation
		this._pipeline.forEach(function (op, ix, pipeline) {
			var following, ref4, unwind;
			if (ix < safe) {
				return;
			}
			if ((op != null ? op.$lookup : void 0) == null) {
				return;
			}
			unwind = (ref4 = pipeline[ix + 1]) != null ? ref4.$unwind : void 0;
			following = JSON.stringify(pipeline[ix + 1]);
			if (((unwind != null ? unwind.path : void 0) || unwind) === '$' + op.$lookup.as) {
				following = JSON.stringify(pipeline[ix + 2]);
			}
			if (!(following != null ? following.match('"\\$?' + op.$lookup.as + '["|\\.]') : void 0) && (op.$lookup.pipeline == null)) { // delete if not used in the following pipeline step
				pipeline[ix] = void 0;
			}
			if ((unwind != null ? unwind.preserveNullAndEmptyArrays : void 0) === true && unwind.path.indexOf(op.$lookup.as) === 1 && !following.match(/\$replaceRoot/)) { // mute $unwind
				return pipeline[ix + 1] = void 0;
			}
		});
		// remove the unnecessary steps in the pipeline that won't affect the count calculation
		this._pipeline = _.reject(this._pipeline, function (op) {
			return op === void 0 || (op.$sort != null) || (op.$skip != null) || (op.$limit != null);
		});
		// find the safe point to optimise the pipeline
		safe = _.max(this._pipeline.map(function (op, i) {
			var ref4;
			return ((op != null) && ((op.$group != null) || op.$match || (((ref4 = op.$lookup) != null ? ref4.pipeline : void 0) != null) || (op.$unwind && op.$unwind.preserveNullAndEmptyArrays !== true)) ? i : void 0) || 0;
		}));
		// remove anything after the last $group, $match or $unwind as these can reshape the data and affects the count
		this._pipeline = this._pipeline.slice(0, 1 + safe);
		// if pipeline ends with $unwind of type string
		if (((ref4 = _.last(this._pipeline)) != null ? (ref5 = ref4.$unwind) != null ? ref5.constructor.name : void 0 : void 0) === 'String') {
			unwind = this._pipeline.pop().$unwind.substr(1);
			// replace the $unwind and combine with count summing $size instead
			sum = {
				$size: {
					$ifNull: ['$' + unwind, []]
				}
			};
			while (((project = (ref6 = _.last(this._pipeline).$project) != null ? ref6[unwind] : void 0) != null) && !project.substr && (project === 1 || project[Object.keys(project)[0]] === 1)) {
				// remove any pass through preceeding projection
				this._pipeline.pop();
			}
			// only project the unwinded field
			project = ((ref7 = _.last(this._pipeline)) != null ? ref7.$project : void 0) || ((ref8 = _.last(this._pipeline)) != null ? ref8.$group : void 0) || {};
			Object.keys(project).forEach(function (k) {
				if (!(k === '_id' || k === unwind)) {
					return delete project[k];
				}
			});
		}
		// for grouping only keep _id, $push and $addToSet, anything else should be deleted as it won't affect the count calculation
		this._pipeline.forEach(function (op, ix, pipeline) {
			var following, lookup, ref10, ref9;
			if ((op != null ? op.$group : void 0) == null) {
				return;
			}
			unwind = (ref9 = pipeline[ix + 1]) != null ? ref9.$unwind : void 0;
			lookup = (ref10 = pipeline[ix + 1]) != null ? ref10.$lookup : void 0;
			following = JSON.stringify(pipeline[ix + 1]);
			return Object.keys(op.$group).forEach(function (gkey) {
				var ref11;
				if (gkey === '_id') {
					return;
				}
				if (!unwind && !following && !lookup) {
					delete op.$group[gkey];
				}
				if ((following != null ? following.indexOf('"' + gkey + '.') : void 0) < 0 && (following != null ? following.indexOf('"' + gkey + '"') : void 0) < 0) { // delete if not used in the following pipeline step
					delete op.$group[gkey];
				}
				if ((unwind != null ? typeof unwind.indexOf === "function" ? unwind.indexOf(gkey) : void 0 : void 0) === 1) { // if not used in the following unwind
					delete op.$group[gkey];
				}
				if ((unwind != null ? unwind.preserveNullAndEmptyArrays : void 0) === true && unwind.path.indexOf(gkey) === 1) { // if not used in the following unwind
					delete op.$group[gkey];
				}
				if (((lookup != null ? lookup.localField : void 0) != null) && ((lookup != null ? lookup.localField : void 0) != null) === gkey && !(lookup != null ? (ref11 = lookup.localField) != null ? ref11.startsWith(gkey + '.') : void 0 : void 0)) { // delete if not used in the following lookup
					return delete op.$group[gkey];
				}
			});
		});
		// add the count calculation to the pipleline
		this._pipeline.push({
			$group: {
				_id: null,
				count: {
					$sum: sum
				}
			}
		});
		// ensure only the options needed are the onest to be sent
		this.options = JSON.parse(JSON.stringify(_.mapObject(this.options, function (val) {
			if ((val != null) && !_.isObject(val)) {
				return val;
			}
		})));
		// execute the aggregation and callback with the count
		return this.exec(function (err, results) {
			var ref9;
			return callback(err, (results != null ? (ref9 = results[0]) != null ? ref9.hasOwnProperty('count') : void 0 : void 0) ? results[0].count : (results != null ? results[0] : void 0) || 0);
		});
	};
	// implement the query.distinct interface
	aggregate.distinct = function (path) {
		delete this.options.cursor;
		this.append({ $group: { _id: null, distinct: { $addToSet: `$${path}` } } });
		return {
			exec: function (callback) {
				return aggregate.exec(function (err, results) {
					var ref4;
					return callback(err, results != null ? (ref4 = results[0]) != null ? ref4.distinct : void 0 : void 0);
				});
			}
		};
	};
	return aggregate;
};

// register default rest controllers handlers
rested.Controller.decorators(function () {
	var controller, ref1, ref2;
	controller = this;
	controller.model().schema.refs = refs;
	controller.model().schema.xrefs = xrefs;
	controller.model().schema.rearrange = rearrange;
	if (!!((ref1 = controller.model().defaults) != null ? ref1.aggregate : void 0)) {
		controller.model().find = aggregator;
		controller.model().findOne = aggregator;
	}
	if (!!((ref2 = controller.model().defaults) != null ? ref2.aggregate : void 0)) {
		controller.model().distinct = (function (path, cond) {
			return this.find(cond).distinct(path);
		});
	}
	controller.model().schema.alias = function (path) {
		var ref3;
		return alias.call(controller.model().schema, path, ((ref3 = controller.model().defaults) != null ? ref3.path : void 0) || '');
	};
	//controller.findBy(controller.model().defaults.findBy) if !!controller.model().defaults?.findBy
	// override the populate to support populating of virtual fields where values provided by virtual getters
	if (_.find(controller.model().schema.virtuals, function (v) {
		return !!v.options.ref && v.path === v.options.localField;
	})) {
		controller.model().$_populate = controller.model().populate;
		controller.model().populate = function (doc, options, callback) {
			options.filter(function (p) {
				var ref3, ref4;
				return !!((ref3 = controller.model().schema.virtuals[(ref4 = controller.model().schema.paths[p.path]) != null ? ref4.options.alias : void 0]) != null ? ref3.options.localField : void 0);
			}).forEach(function (p) {
				var ref3;
				return p.path = (ref3 = controller.model().schema.paths[p.path]) != null ? ref3.options.alias : void 0;
			});
			options.map(function (p) {
				var v;
				if (((v = controller.model().schema.virtuals[p.path]) != null) && v.getters.length > 1) {
					return v;
				}
			}).forEach(function (v) {
				if (v != null) {
					return doc[v.path] = v.getters[v.getters.length - 1].call(doc);
				}
			});
			return controller.model().$_populate(doc, options, callback);
		};
	}
	// handle all the custom syntactic sugar addon's and options
	controller.request('get', function (req, res, nxt) {
		var _conditions, _distinct, _matches, _nxt, _select, _sort, base, base1, base2, ref10, ref11, ref3, ref4, ref5, ref6, ref7, ref8, ref9;
		_matches = {};
		_distinct = {};
		_conditions = {};
		if (req.query.count === 'true') {
			// ignore skip and limit when counting
			delete req.query.skip;
		}
		if (req.query.count === 'true') {
			delete req.query.limit;
		}
		if (!!req.query.skip) {
			// ensure the skip and limit values are numbers if presented
			req.query.skip = parseInt(req.query.skip);
		}
		if (!!req.query.limit) {
			req.query.limit = parseInt(req.query.limit);
		}
		if (req.query.count !== 'true' && !!!req.query.limit) {
			req.query.limit = 10;
		}
		if (req.query.limit < 0) { // intention to get all
			delete req.query.limit;
		}
		if (req.query.skip === 0) { // pointless to have
			delete req.query.skip;
		}
		if (!!req.query.select && req.query.select[0] === '{' && req.query.select.indexOf('"$') > 0) {
			// turn into aggregation if query.select contains aggregation specific operators that starts with '$' like $filter
			if ((base = req.query).aggregate == null) {
				base.aggregate = 'true';
			}
		}
		if (!!req.query.group || !!req.query.unwind) {
			// turn into aggregation if query.group or query.unwind is present and not empty
			if ((base1 = req.query).aggregate == null) {
				base1.aggregate = 'true';
			}
		}
		// handle the case where there are multiple conditions specificed in the query string by merging them
		if (Array.isArray(req.baucis.conditions)) {
			req.baucis.conditions = _.flatten(req.baucis.conditions.map(function (o) {
				return JSON.parse(`[${o}]`);
			})).reduce(function (out, obj) {
				var j, key, len, ref3;
				if ((obj != null ? obj.constructor.name : void 0) === 'String') {
					throw rested.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', obj);
				}
				ref3 = Object.keys(obj);
				for (j = 0, len = ref3.length; j < len; j++) {
					key = ref3[j];
					out[key] = obj[key];
				}
				return out;
			}, {});
		}
		if ((req.query.skip != null) && isNaN(req.query.skip)) {
			// query parameters validation
			return nxt(rested.Error.BadRequest('Skip must be a positive integer if set'));
		}
		if ((req.query.limit != null) && isNaN(req.query.limit)) {
			return nxt(rested.Error.BadRequest('Limit must be a positive integer if set'));
		}
		if (((ref3 = req.baucis.conditions) != null ? ref3.constructor.name : void 0) === 'String') {
			return nxt(rested.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', req.baucis.conditions));
		}
		// if no conditions specificed then check if any of the query params matches any of the model attributes to construct conditions
		_.each(Object.keys(req.query || {}), function (key) {
			var kalias;
			if (key === 'conditions' || key === 'sort' || key === 'limit' || key === 'skip' || key === 'count' || key === 'select' || key === 'populate' || key === 'distinct' || key === 'explain' || key === 'aggregate' || key === 'group' || key === 'unwind') {
				return;
			}
			if (!(((kalias = controller.model().schema.alias(key)) != null) && (controller.model().schema.path(kalias) != null))) {
				return;
			}
			if (req.query[key][0] === '{') {
				req.query[key] = JSON.parse(req.query[key]);
			} else if (req.query[key].indexOf(',') > 0) {
				req.query[key] = {
					$in: req.query[key].split(',')
				};
			}
			req.baucis.conditions[kalias] = req.query[key];
			return delete req.query[key];
		});
		// set model defaults for the conditions, sort and population
		if (controller.model().defaults != null) {
			if ((base2 = req.query).sort == null) {
				base2.sort = controller.model().defaults.sort;
			}
			if (!req.query.select || (((ref4 = req.query.select) != null ? ref4[0] : void 0) === '-' && ((ref5 = controller.model().defaults.select) != null ? ref5[0] : void 0) === '-') || ((((ref6 = req.query.select) != null ? ref6.trim : void 0) != null) && ((ref7 = req.query.select) != null ? ref7[0] : void 0) !== '-' && ((ref8 = controller.model().defaults.select) != null ? ref8[0] : void 0) !== '-')) {
				req.query.select = ((req.query.select || '').trim() + ' ' + (controller.model().defaults.select || '').trim()).trim();
			}
			req.query.populate = ((req.query.populate || '').trim() + ' ' + (controller.model().defaults.populate || '').trim()).trim();
			if ((!req.headers.accept || req.headers.accept === "*/*") && req.query.aggregate !== 'true') {
				req.headers.accept = controller.model().defaults.accept || "*/*";
			}
			_.extend(req.baucis.conditions, ((ref9 = controller.model().defaults.conditions) != null ? typeof ref9.call === "function" ? ref9.call(req.baucis.conditions) : void 0 : void 0) || controller.model().defaults.conditions);
		}
		if (req.query.distinct) {
			// map any aliases used in the query parameters
			req.query.distinct = controller.model().schema.alias(req.query.distinct);
		}
		if (req.query.sort) {
			req.query.sort = _.map(req.query.sort.trim().split(' '), controller.model().schema.alias).join(' ');
		}
		if ((((ref10 = req.query.select) != null ? ref10.trim : void 0) != null) && req.query.select[0] !== '{') {
			req.query.select = _.map(req.query.select.trim().split(' '), controller.model().schema.alias).join(' ');
		}
		if (req.query.populate) {
			req.query.populate = _.map(req.query.populate.trim().split(/\s|,/), controller.model().schema.alias).join(' ');
		}
		req.baucis.conditions = controller.model().schema.rearrange(req.baucis.conditions, req.query.populate);
		if (!!req.query.populate && (!!req.query.select || req.baucis.conditions)) {
			// take out conditions targeted for sub docuemnts
			Object.keys(req.baucis.conditions).forEach(function (k) {
				return req.query.populate.trim().split(' ').forEach(function (p) {
					var _replace, ref11, ref12;
					if (((ref11 = req.query.distinct) != null ? ref11.indexOf(p + '.') : void 0) === 0) {
						if (_conditions[p] == null) {
							_conditions[p] = {};
						}
						_distinct[p] = req.query.distinct.substr(p.length + 1);
					}
					if (k.indexOf(p + '.') !== 0) {
						return;
					}
					if (k.substr(p.length + 1) === '_id') {
						req.baucis.conditions[p] = req.baucis.conditions[k];
					} else if (req.baucis.conditions[k] != null) {
						_replace = (((controller.model().schema.path(k) != null) || (controller.model().schema.path(p) != null)) && controller.model().schema.path(p).instance !== 'Array' ? _conditions : void 0) || _matches;
						if (_replace[p] == null) {
							_replace[p] = {};
						}
						_replace[p][k.substr(p.length + 1)] = JSON.parse(JSON.stringify(req.baucis.conditions[k]).replace(new RegExp(`"${p}.`, 'gm'), '"'));
						// supress the effect of the join condition if it is included in $or query on the master collection
						if ((ref12 = _.find(req.baucis.conditions.$or, function (k) {
							return k[p] != null;
						})) != null) {
							ref12[p] = {
								$exists: true
							};
						}
					}
					// take out the join condition from the query directed to the master collection
					return delete req.baucis.conditions[k];
				});
			});
			if (req.query.sort) {
				// esnure that sort id directed to the right collection if it is intended to be on the child
				_sort = req.query.sort.match(new RegExp('(\\s|^)-?(' + req.query.populate.split(' ').join('|') + ')\\.[^\\s]+', 'gm'));
			}
			if (_sort) {
				req.query.sort = req.query.sort.replace(new RegExp('(\\s|^)-?(' + req.query.populate.trim().split(' ').join('|') + ')\\.[^\\s]+', 'gm'), '');
			}
			if (req.query.select && req.query.select[0] !== '{') {
				// override the populate if there are any selection targeted on sub documents
				_select = req.query.select.match(new RegExp('(\\s|^)-?(' + req.query.populate.split(' ').join('|') + ')\\.[^\\s]+', 'gm'));
			}
			if (!!_select) {
				if (_select) {
					req.query.select = req.query.select.replace(new RegExp('(\\s|^)-?(' + req.query.populate.trim().split(' ').join('|') + ')\\.[^\\s]+', 'gm'), '');
				}
				if (!!req.query.select && req.query.select[0] !== '-') {
					req.query.select += ' ' + req.query.populate.replace(new RegExp('(\\s|^)(' + req.query.select.trim().split(' ').join('|') + ')(\\s|$)', 'gm'), '$3');
				}
			}
			if (!!req.query.populate) {
				req.baucis.allowPopulateSelect = true;
			}
			req.query.populate = req.query.populate.split(' ').map(function (pop) {
				var _match, _model, _options, _path, _pop, model, ref, ref11, ref12, ref13, ref14;
				model = controller.model();
				_path = xpath.call(model.schema, pop);
				if (!!(ref = xref(_path))) {
					_model = xmodel(ref);
				}
				_options = _.clone((_path != null ? (ref11 = _path.caster) != null ? ref11.options : void 0 : void 0) || (_path != null ? _path.options.options : void 0) || (_path != null ? _path.options : void 0) || {});
				if (!!req.query.select && !!(_path != null ? _path.options.localField : void 0) && req.query.select[0] !== '{' && req.query.select[0] !== '-' && !req.query.select.match(_path != null ? _path.options.localField : void 0)) {
					req.query.select += ' ' + _path.options.localField;
				}
				if (_options.lean == null) {
					_options.lean = ((ref12 = (_model || model).schema.options.toJSON) != null ? ref12.virtuals : void 0) !== true;
				}
				Object.keys(_options).forEach(function (key) {
					if (!(key === 'lean' || key === 'sort' || key === 'limit')) {
						return delete _options[key];
					}
				});
				if (_options.lean !== false) {
					_options.lean = true;
				}
				if (_select) {
					_pop = _.filter(_select, function (p) {
						return p.match(new RegExp('(\\s|^)-?(' + pop + ')\\.'));
					}).join(' ').replace(new RegExp('(\\s|^)(-)?(' + pop + ')\\.', 'gm'), '$2');
				}
				if (!!_pop && (_model != null)) {
					_pop = _pop.split(' ').map(function (p) {
						var ref13;
						return alias.call(_model.schema, p, (ref13 = _model.defaults) != null ? ref13.path : void 0);
					}).join(' ');
				}
				if (!!!_pop && (_model != null)) {
					_pop = (ref13 = _model.defaults) != null ? ref13.select : void 0;
				}
				_match = _matches[pop];
				if (_pop != null ? _pop.match(/\.\$(\s|$)/) : void 0) {
					// if select contains array positional filter then ensure conditions passed through populate
					if (_match == null) {
						_match = JSON.parse(JSON.stringify(_conditions[pop]));
					}
				}
				if (_match && Object.keys(_match).length === 1 && ((ref14 = _match.$and) != null ? ref14.length : void 0) === 1) {
					// simplify the populate match when it only contains a single $and
					_match = _match.$and[0];
				}
				return {
					path: pop,
					select: _pop,
					match: _match,
					options: _options,
					model: _model
				};
			});
		}
		if (!!req.query.select && req.query.select[0] === '{') {
			req.query.select = controller.model().schema.rearrange(req.query.select, req.query.populate, false);
			if (req.query.select.constructor.name === 'String') {
				// throw error if select represents an object whilst it can't be parsed as an object
				return nxt(rested.Error.BadRequest('The select query string value was not valid JSON: "%s"', req.query.select));
			}
		} else if (!!!req.query.select && !!((ref11 = controller.model().defaults) != null ? ref11.select : void 0)) {
			req.query.select = ((req.query.select || '').trim() + ' ' + (controller.model().defaults.select || '').trim()).trim();
		}
		// replace the conditions targeted to sub documents with the specific targeted set using the _id
		_nxt = function (index) {
			var _model, _path, cur, key, ref, superset;
			if ((key = Object.keys(_conditions)[index]) == null) {
				return nxt();
			}
			_path = xpath.call(controller.model().schema, key);
			if (!!(ref = xref(_path))) {
				_model = xmodel(ref);
			}
			if ((_model == null) && delete _conditions[key]) {
				// ignore the sub condition if can't find its model
				return _nxt(index);
			}
			superset = [];
			cur = controller.model().find(req.baucis.conditions).select({
				[`${key}`]: 1,
				'_id': Number(key === '_id')
			}).lean().cursor();
			res.on('close', function () {
				return cur.close(nxt = cur.removeAllListeners() && null);
			});
			cur.on('data', function (doc) {
				return superset.push(doc);
			});
			cur.on('error', function (err) {
				return nxt(err);
			});
			return cur.on('end', function () {
				var cutoff, ref12, ref13, safe, sort, supersets;
				superset = Array.from(new Set(superset.map(function (s) {
					return s[key];
				}).filter(function (s) {
					return s != null;
				})));
				if (!!req.query.distinct && !!_distinct[key]) {
					// if a distinct is requested on a joined model, then just return the results
					return _model.distinct(_distinct[key], _.extend(_conditions[key], {
						_id: {
							$in: superset
						}
					}), function (err, results) {
						if ((req.baucis.documents = results) && (delete req.query.distinct)) {
							return nxt(err);
						}
					});
				}
				sort = _.filter(_sort, function (p) {
					return p.match(new RegExp('(\\s|^)-?(' + key + ')\\.'));
				}).join(' ').replace(new RegExp('(\\s|^)(-)?(' + key + ')\\.', 'gm'), '$2');
				// assume all _id's fits into a single find of 16mb size
				supersets = [superset];
				// due to 16mb document size limit, we should calculate how many _id's can fit in 12mb max to workaround this limitation
				cutoff = Math.floor(12 * 1024 * 1024 / ((ref12 = superset[0]) != null ? ref12.toString().length : void 0));
				if (superset.length > cutoff) {
					// split the _id's into chunks each with max of cutoff limit
					supersets = _.values(_.groupBy(superset, function (obj, ix) {
						return Math.floor(ix / cutoff);
					}));
				}
				// if there is more than a single _id's chunk or the model implements transform function then let the sort, skip and limit pass through as the final stage
				safe = Object.keys(_conditions).length === 1 && ((ref13 = controller.model().schema.options.toJSON) != null ? ref13.virtuals : void 0) !== true && supersets.length === 1;
				return async.map(supersets, function (superset, cb) {
					var _query;
					// get distinct list of document id and replace the populated key in the original condition
					_query = _model.find(_.extend(_conditions[key], {
						_id: {
							$in: superset
						}
					})).select(_distinct[key] || '_id');
					if (safe && req.query.limit < superset.length) {
						_query = _query.limit(req.query.limit);
					}
					if ((_path != null ? _path.options.limit : void 0) > 0) {
						_query = _query.limit(_path != null ? _path.options.limit : void 0);
					}
					if (!!(_path != null ? _path.options.sort : void 0)) {
						_query = _query.sort(_path != null ? _path.options.sort : void 0);
					}
					if (safe && (req.query.skip != null)) {
						_query = _query.skip(req.query.skip);
					}
					if (safe && (sort != null)) {
						_query = _query.sort(sort);
					}
					return _query.lean().exec(cb);
				}, function (err, subset) {
					var cond, ref14, ref15;
					if (err != null) {
						return nxt(err);
					}
					subset = _.flatten(subset);
					if (safe) {
						delete req.query.skip;
					}
					if (safe) {
						delete req.query.limit;
					}
					subset = Array.from(new Set(subset.map(function (s) {
						return s[_distinct[key] || '_id'];
					}).filter(function (s) {
						return s != null;
					})));
					if (((ref14 = superset[0]) != null ? ref14.constructor.name : void 0) === 'String' && ((ref15 = subset[0]) != null ? ref15.constructor.name : void 0) !== 'String') {
						subset = subset.map(function (obj) {
							return obj != null ? obj.toString() : void 0;
						});
					}
					cond = _.find(req.baucis.conditions.$or, function (k) {
						return k[key] != null;
					});
					if (cond == null) {
						cond = req.baucis.conditions;
					}
					cond[key] = {
						$in: subset
					};
					delete _conditions[key];
					return _nxt(++index);
				});
			});
		};
		// start replacing the sub docuemnts conditions async and only call next handler when conditions are replaced
		return _nxt(0);
	});
	// handle all query extra options, select = {}, lean, hint, explain, comment and batch size
	controller.query('get', function (req, res, nxt) {
		var base, ref3, ref4, ref5, ref6;
		// add a comment with the real ip of the host making the query
		req.baucis.query.comment(((req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace('::ffff:', '').replace('::1', '127.0.0.1') + ' ' + (((ref3 = req.headers['remote-user']) != null ? ref3.split('@')[0] : void 0) || '')).trim());
		if (((ref4 = controller.model().defaults) != null ? ref4.hint : void 0) != null) {
			// if model default hint is provided then use it, if it is a function then call it, otherwise use it as is
			req.baucis.query.hint(((ref5 = controller.model().defaults) != null ? typeof (base = ref5.hint).call === "function" ? base.call(req.baucis.query._conditions) : void 0 : void 0) || controller.model().defaults.hint);
		}
		if (req.query.explain === 'true') { //and delete req.baucis.count #and delete req.query.count
			// when query explain requested ensure lean and no count conficts, explain should take precedence over count
			req.baucis.query.lean(req.baucis.query.options.explain = true);
		}
		if (((ref6 = controller.model().schema.options.toJSON) != null ? ref6.virtuals : void 0) !== true) {
			// if the model.toJSON is not overriden then opt for lean query as it is much faster
			req.baucis.query.lean();
		}
		if (!!req.query.callback && req.headers.accept === 'application/javascript') {
			// bypass the callback function name to be used by the formatter when writing into the response
			req.baucis.jsonp = req.query.callback;
		}
		// set batch size to speed up streaming of the cursor data
		req.baucis.query.batchSize(2000);
		return nxt();
	});
	// handle the count differenctly to the default baucis behaviour that uses collection.count
	controller.query('get', function (req, res, nxt) {
		var _conditions;
		if (req.query.count === 'true') {
			_conditions = req.baucis.query._conditions || req.baucis.conditions || JSON.parse(req.query.conditions);
			// handle count on pre-populated documents as in the case of distinct
			if (req.baucis.documents instanceof Array) {
				req.baucis.query.count = function (cb) {
					return cb(null, req.baucis.documents.length);
				};
				// if count is overriden in the model then pass through a callback and write back the count in the response
			} else if (controller.model()._count != null) {
				return controller.model().count(_conditions, function (err, count) {
					if (err) {
						return nxt(rested.Error.BadRequest());
					}
					return res.json(count);
				});
			} else if (!!req.baucis.query.op) {
				req.baucis.query = req.baucis.query._collection.findCursor(_conditions, req.baucis.query._optionsForExec());
				if (req.query.explain === 'true') {
					req.baucis.query.count = req.baucis.query.next;
				}
			}
		}
		return nxt();
	});
	// implementation of mongodb aggregation $group using http query parameters
	return controller.query('collection', 'get', function (req, res, nxt) {
		var $match, $project, $unwind, aggregate, decode, encode, gmatch, group, j, key, len, pmatch, ref3, ref4, ref5, umatch;
		if (req.query.aggregate !== 'true') {
			return nxt();
		}
		// helper methods to decode/encode group keys with dots
		decode = function (k) {
			return (k.indexOf('~') < 0 ? k : void 0) || (k.substr(1).replace(/~/g, '.'));
		};
		encode = function (k) {
			return (k.indexOf('.') < 0 ? k : void 0) || ('~' + k.replace(/\./g, '~'));
		};
		// initialize the final projection
		$project = req.baucis.query._fields;
		if (!Array.isArray(req.baucis.query._pipeline)) {
			delete req.baucis.query.options.sort;
			delete req.baucis.query.options.skip;
			delete req.baucis.query.options.limit;
			aggregate = aggregator.call(controller.model(), req.baucis.query._conditions || req.baucis.conditions || JSON.parse(req.query.conditions));
			req.baucis.query = aggregate.setOptions(req.baucis.query._mongooseOptions).setOptions(req.baucis.query.options);
		}
		// find the query first $match that maps to query conditions
		$match = ((ref3 = _.find(req.baucis.query._pipeline, function (op) {
			return op.$match;
		})) != null ? ref3.$match : void 0) || {};
		// find existing pipeline final projection if not passed in
		if ($project == null) {
			$project = ((ref4 = _.last(_.filter(req.baucis.query._pipeline, function (op) {
				return op.$project != null;
			}))) != null ? ref4.$project : void 0) || {};
		}
		// ensure $project doesn't have duplicate paths
		Object.keys($project).sort().filter(function (key, ix, array) {
			var ref5;
			return ((ref5 = array[ix + 1]) != null ? ref5.indexOf(key + '.') : void 0) === 0;
		}).forEach(function (key) {
			return delete $project[key];
		});
		// delay specific steps from the pipeline if there is unwind or group specificed as they take precedence
		if (Array.isArray(req.baucis.query._pipeline) && !!(req.query.unwind || req.query.group)) {
			req.baucis.query._pipeline = _.reject(req.baucis.query._pipeline, function (op) {
				return (op.$skip != null) || (op.$limit != null) || op.$project === $project;
			});
		}
		if (!!req.query.unwind) {
			// split and map the unwind paths
			$unwind = _.filter(req.query.unwind.split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
			// unwind the paths sorted by path length, shortest to longest
			$unwind.sort(function (a, b) {
				return a.length > b.length;
			}).forEach(function (path) {
				return req.baucis.query._pipeline.push({
					$unwind: '$' + path
				});
			});
			// build regex or match to search for matching keys in the query conditions targeted for any of the unwind paths
			$unwind = $unwind.join('|');
			// project the match conditions for the unwinded paths only
			umatch = JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) {
				if (key.match($unwind)) {
					return val;
				}
			})));
			// add the projected match after all the unwinded paths
			req.baucis.query._pipeline.push({
				$match: umatch
			});
		}
		if (!!req.query.group) {
			gmatch = {};
			group = req.query.group;
			if (!Array.isArray(group)) {
				group = [group];
			}
			group.forEach(function ($group) {
				var j, key, len, ref5;
				if ($group[0] === '{') {
					$group = JSON.parse($group);
					if (($group != null ? $group.constructor.name : void 0) === 'String') {
						throw rested.Error.BadRequest('The group query string value was not valid JSON: "%s"', $group);
					}
				}
				if (($group != null ? $group.constructor.name : void 0) === 'String') {
					$group = {
						_id: $group,
						count: {
							$sum: 1
						}
					};
				}
				if (($group != null ? $group._id : void 0) != null) {
					if ($group._id.constructor.name === 'String' && $group._id !== '$_id') {
						$group._id = _.filter($group._id.split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						$group._id = _.object($group._id.map(encode), $group._id.map(function (k) {
							return '$' + k;
						}));
					}
					['$sum', '$avg', '$first', '$last', '$max', '$min', '$push', '$addToSet', '$stdDevPop', '$stdDevSamp'].forEach(function (op) {
						var gop;
						if (($group[op] == null) || $group[op].constructor.name !== 'String') {
							return;
						}
						gop = _.filter($group[op].split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						delete $group[op];
						return _.extend($group, _.object(gop.map(encode), gop.map(function (k) {
							return {
								[`${op}`]: '$' + k
							};
						})));
					});
					['$count'].forEach(function (op) {
						var gop;
						if (($group[op] == null) || $group[op].constructor.name !== 'String') {
							return;
						}
						gop = _.filter($group[op].split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						delete $group[op];
						return _.extend($group, _.object(gop.map(encode), gop.map(function (k) {
							return {
								$sum: {
									$cond: ['$' + k, 1, 0]
								}
							};
						})));
					});
					// rearrange the group fields for any aliasing or prefixing specified by the schema
					$group = controller.model().schema.rearrange($group, req.query.populate, false);
					if (($group._id == null) && !!(key = controller.model().schema.alias('_id'))) {
						$group._id = $group[key];
						delete $group[key];
					}
					if (_.isObject($group._id)) {
						// ensure all $group._id keys with '.' is replaced with '~' as $group keys can't be dotted
						$group._id = _.object(Object.keys($group._id).map(encode), _.values($group._id));
					}
					if (_.isObject($group._id)) {
						// ensure $group._id keys are added to the final $project step
						Object.keys($group._id).forEach(function (k) {
							var name;
							return $project[name = decode(k)] != null ? $project[name] : $project[name] = '$_id.' + k;
						});
					}
					// ensure all other selected fields that are not part of the groups to be mapped as $first
					Object.keys($project).filter(function (k) {
						return $project[k] > 0;
					}).forEach(function (k) {
						var name;
						return $group[name = encode(k)] != null ? $group[name] : $group[name] = {
							$first: '$' + k
						};
					});
					// ensure all $group keys with '.' is replaced with '~' as $group keys can't be dotted
					Object.keys($group).filter(function (k) {
						return k.indexOf('.') > 0;
					}).filter(function (k) {
						return $group[encode(k)] = $group[k];
					}).forEach(function (k) {
						return delete $group[k];
					});
					// ensure all other $group keys that are not selected by default to be projected in the output
					Object.keys($group).filter(function (k) {
						return k !== '_id' && $project[k] === void 0;
					}).forEach(function (k) {
						return $project[decode(k)] = '$' + k;
					});
					// separate the conditions targeted for $group from the conditions targeted at the collection
					_.extend(gmatch, JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) {
						var ref5;
						if ((ref5 = Object.keys($group[encode(key)] || {})[0]) === '$sum' || ref5 === '$avg' || ref5 === '$first' || ref5 === '$last' || ref5 === '$max' || ref5 === '$min' || ref5 === '$push' || ref5 === '$addToSet' || ref5 === '$stdDevPop' || ref5 === '$stdDevSamp') {
							return val;
						}
					}))));
					ref5 = Object.keys(gmatch);
					for (j = 0, len = ref5.length; j < len; j++) {
						key = ref5[j];
						if (!controller.model().schema.paths[key]) {
							// remove conditions targeted on $group unless the path is already defined in the schema so it can filters documents before grouping
							delete $match[key];
						}
					}
					// add the properly constructed $group to the pipeline
					req.baucis.query.group($group);
					// deselect $group._id
					return $project._id = 0;
				}
			});
			if (!_.isEmpty(gmatch)) {
				// add the grouped match after all grouping is proccessed
				req.baucis.query._pipeline.push({
					$match: _.object(Object.keys(gmatch).map(encode), _.values(gmatch))
				});
			}
		}
		if (_.isObject($project)) {
			pmatch = {};
			_.extend(pmatch, JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) {
				var ref5;
				if (_.isObject($project[key]) && !((ref5 = Object.keys($project[key])[0]) === '$first' || ref5 === '$last' || ref5 === '$push' || ref5 === '$addToSet' || ref5 === '$filter' || ref5 === '$reverseArray')) {
					return val;
				}
			}))));
			ref5 = Object.keys(pmatch);
			for (j = 0, len = ref5.length; j < len; j++) {
				key = ref5[j];
				if (!controller.model().schema.paths[key]) {
					// remove conditions targeted on final $project unless the path is already defined in the schema so it can filter documents before grouping
					delete $match[key];
				}
			}
			if (!_.find(req.baucis.query._pipeline, function (op) {
				return op.$project === $project;
			})) {
				// $project comes at the end after any grouping or unwinding
				req.baucis.query.select($project);
			}
			if (!_.isEmpty(pmatch)) {
				// add the projected match after the final projection
				req.baucis.query._pipeline.push({
					$match: pmatch
				});
			}
		}
		if (req.query.sort != null) {
			// $sort follows projection to ensure sorting on correct values
			req.baucis.query.sort(req.query.sort);
		}
		if (req.query.skip != null) {
			// $skip follows sorting to ensure right order
			req.baucis.query.skip(req.query.skip);
		}
		if (req.query.limit != null) {
			// $limit follows the skip to ensure correct numbder returned
			req.baucis.query.limit(req.query.limit);
		}
		if (req.query.lean !== 'false') {
			// use lean if the model is not based on aggregations or lean param set to false
			req.baucis.query.lean();
		}
		return nxt();
	});
});

rested.Error = require.cache[require.resolve('rested')].require('rest-error');


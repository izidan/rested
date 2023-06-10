/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async');
const _ = require('underscore');
const rested = require('rested');
const es = require('event-stream');
const mongoose = require('mongoose');

const alias = function (path, root) {
	let pp, ref;
	if (root == null) { root = ''; }
	// skip mongo query operators
	if (['$', '~'].includes(path[0])) { return path; }
	// skip aggregation specific keys
	if (['input', 'as', 'in', 'cond', 'format', 'timezone', 'vars', 'initialValue', 'if', 'else', 'then', 'case', 'default', 'branches', 'defaults', 'inputs'].includes(path)) { return path; }//,'date'
	// skip if called with schema unknown
	if (!(this instanceof mongoose.Schema)) { return path; }
	// skip include/exclude operators
	if ((path != null) && (path[0] === '-')) { return path[0] + alias.call(this, path.substr(1), root); }
	// if path already starts with root then skip root
	if (!!root && ((path != null ? path.indexOf(root) : undefined) === 0)) { return alias.call(this, path.substr(root.length), root); }
	// find exact matching path
	let p = this.path(path);
	// skip root when alias is set to false
	if ((__guard__(p != null ? p.options : undefined, x => x.alias) === false) || !!__guard__(p != null ? p.options : undefined, x1 => x1.alias) || (path === '_id') || (root.indexOf(`${path}.`) === 0)) { root = ''; }
	// return the exact schema path if found
	if ((p != null ? p.path.split('.').length : undefined) >= path.split('.').length) { return root + p.path; }
	// find path with exact alias match
	p = _.find(this.paths, p => p.options.alias === path);
	// skip root when alias is set to false
	if (((p != null ? p.options.alias : undefined) === false) || !!(p != null ? p.options.alias : undefined)) { root = ''; }
	// return the exact alias if found
	if (p != null) { return root + p.path; }
	// fall back to the same path if not found and it is not a complex path
	if (path.indexOf('.') < 0) { return root + path; }
	// take out the last part of a complex path
	let s = path.substr(path.lastIndexOf('.') + 1);
	// try to find the first part of the path excluding the last part
	p = alias.call(this, path.substr(0, path.lastIndexOf('.')), '');
	// fall back to the same path if still not found
	if ((p == null)) { return root + path; }
	// find the schema of the complex path
	while (!(pp = this.path(p)) && (p.indexOf('.') > 0)) {
		s = p.substr(p.lastIndexOf('.') + 1) + '.' + s;
		p = p.substr(0, p.lastIndexOf('.'));
	}
	if ((pp == null)) { return root + path; }
	// find the alias of the last part of a complex path with a internal or external schema
	s = (pp.schema ? (alias.call(pp.schema, s, '')) : undefined) || s;
	// find the alias of the last part of a complex path with a external schema
	s = (!!(ref = xref(pp)) ? alias.call(xmodel(ref).schema, s, '') : undefined) || s;
	// return the combined aliases for complex path
	return root + p + '.' + s;
	//return root + pp.path + p.substr(pp.path.length) + '.' + s # why using pp.path instead of p?
};

const rearrange = function (conditions, populate, cast) {
	let i;
	let asc, end;
	let asc1, end1;
	const schema = this;
	const elemMatch = [];
	if ((conditions == null)) { return {}; }
	// stringify conditions if not passed as a string already
	if (conditions.constructor.name !== 'String') { conditions = JSON.stringify(conditions); }
	// this step is important to eliminate all undefined properties
	conditions = JSON.parse(conditions);
	// ensure data type casting takes place before rearraning conditions
	if ((cast !== false) && (conditions.constructor.name !== 'String')) { mongoose.Query.prototype.cast({ schema }, conditions); }
	// stringify again after taking out undefined properties and type casting
	conditions = JSON.stringify(conditions);
	// take out the $elemMatch(s) before mapping of aliased field
	if ((conditions != null ? conditions.indexOf('$elemMatch') : undefined) > 0) { for (i = 0; i <= 3; i++) { conditions = conditions.replace(/\{"\$elemMatch":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}}/gm, txt => `\"@elemMatch${elemMatch.push(txt)}\"`); } }
	// take out the $map.in(s) before mapping of aliased field
	if ((conditions != null ? conditions.indexOf('$map') : undefined) > 0) { for (i = 0; i <= 3; i++) { conditions = conditions.replace(/"in":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}/gm, txt => `\"@elemMatch${elemMatch.push(txt)}\"`); } }
	// map aliased fields to their underlying paths
	if (conditions) { conditions = conditions.replace(/"[^"{},\$]+(?=":)/gm, txt => `"${schema.alias(txt.substr(1))}`); }
	// map aliased fields to their underlying paths when prefixed with $ as in $group, $project and $unwind
	if (conditions) { conditions = conditions.replace(/"\$[^"{},\$]+(?="[\],}])/gm, txt => `"$${schema.alias(txt.substr(2))}`); }
	// handle aliasing within the $elemMatch object
	for (i = 0, end = elemMatch.length, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
		__guard__(conditions.match(/(?!=")([^"{},]+)":({"\$\w+":)?"\@elemMatch(\d+)(?=")/gm), x => x.map(m => [m.split('"')[0], parseInt(m.split('@elemMatch')[1])]).forEach(m =>
			elemMatch[m[1] - 1] = elemMatch[m[1] - 1].replace(/(?!=")[^"{},]+(?=":)/gm, txt => schema.alias(m[0] + '.' + txt).replace(new RegExp(`^.*?${m[0]}\\.`), ''))));
	}
	// put back $elemMatch(s) as mapping aliased fields
	for (i = 0, end1 = elemMatch.length, asc1 = 0 <= end1; asc1 ? i <= end1 : i >= end1; asc1 ? i++ : i--) { conditions = conditions.replace(/"\@elemMatch\d+"/gm, txt => elemMatch[parseInt(txt.substr(11)) - 1]); }
	// handle short handed regex matches to appropriate mongo regex query
	conditions = conditions.replace(/:"\/([^"]+)\/([igm]+)"/g, ':{"$regex":"$1","$options":"$2"}');
	// undo the aliasing for conditions targeted to populated models, this will be handled later on
	const populated = __guardMethod__(populate, 'map', o => o.map(p => p.path).join(' ')) || populate;
	if (!!populated) { conditions = conditions.replace(new RegExp(`"(\\$or|\\$and)":\\[{"(${populated.trim().split(' ').join('|')})\.`, 'gm'), '"$2.$1":[{"$2.'); }
	// ensure dates always have time parts when before sending to mongo
	conditions = conditions.replace(new RegExp(`"(${RegExp.ISODate})"`, "g"), '"$1T00:00:00Z"');
	// parse conditions back into object
	conditions = JSON.parse(conditions);
	// ensure data type casting takes place post rearraning conditions
	if (cast !== false) { mongoose.Query.prototype.cast({ schema }, conditions); }
	// delete conditions targeted to populated objects when not populated
	Object.keys(conditions).filter(k => k.match(/\.\$and$/)).map(k => k.split('.$and')[0]).filter(k => populated.split(' ').indexOf(k) < 0).forEach(k => Object.keys(conditions).filter(k2 => k2.indexOf(k) === 0).forEach(k2 => delete conditions[k2]));
	return conditions;
};

const refs = function () { return _.uniq(_.filter(_.union(_.map(this.virtuals, v => v.options.ref), _.map(this.paths, p => p.options.ref || __guard__(p.options.type != null ? p.options.type[0] : undefined, x => x.ref) || ((p.schema != null) ? refs.call(p.schema) : undefined)), r => !!r))).toString(); };
const xrefs = function () { return _.uniq(_.filter(_.union(_.map(this.virtuals, function (v) { if (v.options.ref) { return v.path; } }), _.flatten(_.map(this.paths, p => (p.options.ref || __guard__(__guard__(p != null ? p.caster : undefined, x1 => x1.options), x => x.ref) || __guard__(p.options.type != null ? p.options.type[0] : undefined, x2 => x2.ref) ? (p.options.alias || p.path) : undefined) || __guard__(((p.schema != null) ? xrefs.call(p.schema) : undefined), x3 => x3.split(',').map(function (pp) { if (!!pp) { return `${p.path}.${pp}`; } })))), r => !!r))).toString(); };
const xmodel = modelName => mongoose.models[modelName] || __guard__(_.find(mongoose.connections, c => c.models[modelName]), x => x.models[modelName]);
const xref = path => __guard__(path != null ? path.options : undefined, x => x.ref) || __guard__(__guard__(path != null ? path.caster : undefined, x2 => x2.options), x1 => x1.ref) || __guard__(__guard__(__guard__(path != null ? path.options : undefined, x5 => x5.type), x4 => x4[0]), x3 => x3.ref);
const xpath = function (path) {
	let p = this.paths[_.find(Object.keys(this.paths), p => path.indexOf(p) === 0)];
	if (p == null) { p = this.virtuals[_.find(Object.keys(this.virtuals), p => path.indexOf(p) === 0)]; }
	if (((p != null ? p.schema : undefined) == null) || (p.path === path)) { return p; }
	return xpath.call(p.schema, path.substr(p.path.length + 1));
};

const aggregator = function (conditions) {
	// determine the aggregation pipeline steps either by calling a function or append to the conditions
	// must clone the aggregation pipeline to avoid any modifications to the original defaults.aggregate
	conditions = JSON.parse(JSON.stringify(conditions));
	let aggregate = _.filter(JSON.parse(JSON.stringify(__guardMethod__(this.defaults != null ? this.defaults.aggregate : undefined, 'call', o => o.call(conditions)) || [{ $match: conditions }].concat((this.defaults != null ? this.defaults.aggregate : undefined) || [])).replace(/\{"\$[a-z]+":{}}/g, 'null')));
	// the call to cursor() is required to ensure that a readable stream of aggregation results is created
	aggregate = this.aggregate(aggregate).allowDiskUse(true);
	// any selected fields should come last in the aggregation pipeline
	aggregate.select = function (fields) {
		fields = (!!fields && (fields.constructor.name === 'String') ? JSON.parse(`{${fields.replace(/[\s|\+]?(-)?([\w|\.|\:|\#|\@]+)/g, ',"$2":$11').substr(1)}}`) : undefined) || fields || {};
		// fix for "The top-level _id field is the only field currently supported for exclusion"
		if (_.find(_.values(fields), v => !([0, -1].includes(v))) != null) {
			Object.keys(fields).forEach(function (k) { if ((fields[k] < 1) && (k !== '_id')) { return delete fields[k]; } });
		} else {
			Object.keys(fields).forEach(function (k) { if (fields[k] < 1) { return fields[k] = 0; } });
		}
		// if only _id is deselected while no other explicit selection specificed
		if (Object.keys(fields).length === 1) { delete fields._id; }
		// only project if there is a meaningful selection criteria
		if (Object.keys(fields).length > 0) { this.append({ $project: fields }); }
		return this;
	};
	// capture the fields needs population to be used later within the streamed results
	aggregate.populate = function (path) {
		if (path.constructor.name === 'String') {
			this.options.populate = path;
		} else {
			if (this.options.populate == null) { this.options.populate = []; }
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
		this.options.cursor = { batchSize: size };
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
		let cursor;
		const { _model } = this;
		let _populate = this.options.populate;
		// turn populate into an array of population object instead of a plain key/value pair
		if (!!_populate && !Array.isArray(_populate) && (_populate.constructor.name !== 'String')) { _populate = Object.values(_populate || {}); }
		// mute populate option from db
		delete this.options.populate;
		// disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete this.options.hint;
		delete this.options.comment;
		// default cursor batchSize if not set
		if (this.options.cursor == null) { this.options.cursor = { batchSize: 2000 }; }
		// ignore $natural sort as it can't work with aggregation
		this._pipeline.filter(o => o.$sort != null).forEach(function (obj) { if (delete obj.$sort.$natural && (Object.keys(obj.$sort).length === 0)) { return delete obj.$sort; } });
		// remove empty objects in the pipeline
		this._pipeline = _.reject(this._pipeline, obj => Object.keys(obj).length === 0);
		// find the safe point to optimise the pipeline
		let safe = _.max(this._pipeline.map((op, i) => ((op != null) && ((op.$group != null) || op.$match || (op.$lookup != null ? op.$lookup.pipeline : undefined) || (op.$unwind && (op.$unwind.preserveNullAndEmptyArrays !== true)) || op.$replaceRoot || op.$addFields) ? i : undefined) || 0));
		// optimise sort, skip and limit position in the pipeline
		const relocate = _.uniq(this._pipeline.filter(op => (op.$sort != null) || (op.$skip != null) || (op.$limit != null)), op => JSON.stringify(op));
		const sort = Object.keys(__guard__(_.find(relocate, op => op.$sort), x => x.$sort) || {});
		if (sort.length > 0) { safe = Math.max(safe, _.max(this._pipeline.map((op, i) => ((i > safe) && !_.isEmpty(_.pick(op != null ? op.$project : undefined, (v, k) => isNaN(v) && (sort.indexOf(k) >= 0))) ? i : undefined) || 0))); }
		const _pipeline = _.reject(this._pipeline, (op, ix) => ((ix > safe) && (op.$sort != null)) || (op.$skip != null) || (op.$limit != null));
		relocate.forEach(op => _pipeline.splice(++safe, 0, op));
		// create the cursor using aggregation on the underying model collection
		let stream = (cursor = _model.collection.aggregate(_pipeline, this.options));
		// populate each document for the requested paths
		if (!!_populate) { stream = stream != null ? stream.pipe(es.map((doc, nxt) => _model.populate.call(_model, doc, _populate, nxt))) : undefined; }
		// create mongoose model for each of the document returned by the cursor
		if (this.options.lean !== true) { stream = stream != null ? stream.pipe(es.map((doc, nxt) => nxt(null, new _model(doc)))) : undefined; }
		if (cursor === stream) { return cursor; }
		// wire up the stream close to the underlying aggregation cursor close
		stream.on('close', () => cursor.destroy.call(cursor));
		stream.pause = () => cursor.pause.call(cursor, (stream.paused = true));
		stream.resume = () => cursor.resume.call(cursor, (stream.paused = false));
		// return the piped stream or the underlying cursor
		return stream;
	};
	// implement the query.count interface
	aggregate.count = function (callback) {
		let unwind;
		let sum = 1;
		// no need for a cursor
		delete this.options.cursor;
		// populate is useless
		delete this.options.populate;
		// disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete this.options.hint;
		delete this.options.comment;
		// find the safe point to optimise the pipeline
		let safe = _.max(this._pipeline.map((op, i) => (((op != null ? op.$group : undefined) != null) ? i : undefined) || 0));
		// for lookups only keep the ones that are followed by $unwind without preserveNullAndEmptyArrays as it won't affect the count calculation
		this._pipeline.forEach(function (op, ix, pipeline) {
			if (ix < safe) { return; }
			if (((op != null ? op.$lookup : undefined) == null)) { return; }
			const unwind = __guard__(pipeline[ix + 1], x => x.$unwind);
			let following = JSON.stringify(pipeline[ix + 1]);
			if (((unwind != null ? unwind.path : undefined) || unwind) === (`$${op.$lookup.as}`)) { following = JSON.stringify(pipeline[ix + 2]); }
			if (!(following != null ? following.match(`"\\$?${op.$lookup.as}["|\\.]`) : undefined) && (op.$lookup.pipeline == null)) { pipeline[ix] = undefined; } // delete if not used in the following pipeline step
			if (((unwind != null ? unwind.preserveNullAndEmptyArrays : undefined) === true) && (unwind.path.indexOf(op.$lookup.as) === 1) && !following.match(/\$replaceRoot/)) { return pipeline[ix + 1] = undefined; }
		}); // mute $unwind
		// remove the unnecessary steps in the pipeline that won't affect the count calculation
		this._pipeline = _.reject(this._pipeline, op => (op === undefined) || (op.$sort != null) || (op.$skip != null) || (op.$limit != null));
		// find the safe point to optimise the pipeline
		safe = _.max(this._pipeline.map((op, i) => ((op != null) && ((op.$group != null) || op.$match || ((op.$lookup != null ? op.$lookup.pipeline : undefined) != null) || (op.$unwind && (op.$unwind.preserveNullAndEmptyArrays !== true))) ? i : undefined) || 0));
		// remove anything after the last $group, $match or $unwind as these can reshape the data and affects the count
		this._pipeline = this._pipeline.slice(0, 1 + safe);
		// if pipeline ends with $unwind of type string
		if (__guard__(__guard__(_.last(this._pipeline), x1 => x1.$unwind), x => x.constructor.name) === 'String') {
			let project;
			unwind = this._pipeline.pop().$unwind.substr(1);
			// replace the $unwind and combine with count summing $size instead
			sum = { $size: { $ifNull: [`$${unwind}`, []] } };
			// remove any pass through preceeding projection
			while (((project = __guard__(_.last(this._pipeline).$project, x2 => x2[unwind])) != null) && !project.substr && ((project === 1) || (project[Object.keys(project)[0]] === 1))) { this._pipeline.pop(); }
			// only project the unwinded field
			project = __guard__(_.last(this._pipeline), x3 => x3.$project) || __guard__(_.last(this._pipeline), x4 => x4.$group) || {};
			Object.keys(project).forEach(function (k) { if (!(['_id', unwind].includes(k))) { return delete project[k]; } });
		}
		// for grouping only keep _id, $push and $addToSet, anything else should be deleted as it won't affect the count calculation
		this._pipeline.forEach(function (op, ix, pipeline) {
			if (((op != null ? op.$group : undefined) == null)) { return; }
			unwind = __guard__(pipeline[ix + 1], x5 => x5.$unwind);
			const lookup = __guard__(pipeline[ix + 1], x6 => x6.$lookup);
			const following = JSON.stringify(pipeline[ix + 1]);
			return Object.keys(op.$group).forEach(function (gkey) {
				if (gkey === '_id') { return; }
				if (!unwind && !following && !lookup) { delete op.$group[gkey]; }
				if (((following != null ? following.indexOf(`"${gkey}.`) : undefined) < 0) && ((following != null ? following.indexOf(`"${gkey}"`) : undefined) < 0)) { delete op.$group[gkey]; } // delete if not used in the following pipeline step
				if (__guardMethod__(unwind, 'indexOf', o1 => o1.indexOf(gkey)) === 1) { delete op.$group[gkey]; } // if not used in the following unwind
				if (((unwind != null ? unwind.preserveNullAndEmptyArrays : undefined) === true) && (unwind.path.indexOf(gkey) === 1)) { delete op.$group[gkey]; } // if not used in the following unwind
				if (((lookup != null ? lookup.localField : undefined) != null) && (((lookup != null ? lookup.localField : undefined) != null) === gkey) && !__guard__(lookup != null ? lookup.localField : undefined, x7 => x7.startsWith(gkey + '.'))) { return delete op.$group[gkey]; }
			});
		}); // delete if not used in the following lookup
		// add the count calculation to the pipleline
		this._pipeline.push({ $group: { _id: null, count: { $sum: sum } } });
		// ensure only the options needed are the onest to be sent
		this.options = JSON.parse(JSON.stringify(_.mapObject(this.options, function (val) { if ((val != null) && !_.isObject(val)) { return val; } })));
		// execute the aggregation and callback with the count
		return this.exec((err, results) => callback(err, __guard__(results != null ? results[0] : undefined, x5 => x5.hasOwnProperty('count')) ? results[0].count : ((results != null ? results[0] : undefined) || 0)));
	};
	// implement the query.distinct interface
	aggregate.distinct = function (path) {
		delete this.options.cursor;
		this.append({ $group: { _id: null, distinct: { $addToSet: `$${path}` } } });
		return { exec(callback) { return aggregate.exec((err, results) => callback(err, __guard__(results != null ? results[0] : undefined, x => x.distinct))); } };
	};
	return aggregate;
};

// register default rest controllers handlers
rested.Controller.decorators(function () {
	const controller = this;
	controller.model().schema.refs = refs;
	controller.model().schema.xrefs = xrefs;
	controller.model().schema.rearrange = rearrange;
	if (!!__guard__(controller.model().defaults, x => x.aggregate)) {
		controller.model().find = aggregator;
		controller.model().findOne = aggregator;
	}
	if (!!__guard__(controller.model().defaults, x1 => x1.aggregate)) { controller.model().distinct = (function (path, cond) { return this.find(cond).distinct(path); }); }
	controller.model().schema.alias = path => alias.call(controller.model().schema, path, __guard__(controller.model().defaults, x2 => x2.path) || '');
	//if (!!__guard__(controller.model().defaults, x2 => x2.findBy)) { controller.findBy(controller.model().defaults.findBy); }
	// override the populate to support populating of virtual fields where values provided by virtual getters
	if (_.find(controller.model().schema.virtuals, v => !!v.options.ref && (v.path === v.options.localField))) {
		controller.model().$_populate = controller.model().populate;
		controller.model().populate = function (doc, options, callback) {
			options.filter(p => !!__guard__(controller.model().schema.virtuals[__guard__(controller.model().schema.paths[p.path], x4 => x4.options.alias)], x3 => x3.options.localField)).forEach(p => p.path = __guard__(controller.model().schema.paths[p.path], x3 => x3.options.alias));
			options.map(function (p) {
				let v;
				if (((v = controller.model().schema.virtuals[p.path]) != null) && (v.getters.length > 1)) { return v; }
			}).forEach(function (v) { if (v != null) { return doc[v.path] = v.getters[v.getters.length - 1].call(doc); } });
			return controller.model().$_populate(doc, options, callback);
		};
	}

	// handle all the custom syntactic sugar addon's and options
	controller.request('get', function (req, res, nxt) {
		let _sort;
		const _matches = {};
		const _distinct = {};
		const _conditions = {};
		// ignore skip and limit when counting
		if (req.query.count === 'true') { delete req.query.skip; }
		if (req.query.count === 'true') { delete req.query.limit; }
		// ensure the skip and limit values are numbers if presented
		if (!!req.query.skip) { req.query.skip = parseInt(req.query.skip); }
		if (!!req.query.limit) { req.query.limit = parseInt(req.query.limit); }
		if ((req.query.count !== 'true') && !!!req.query.limit) { req.query.limit = 10; }
		if (req.query.limit < 0) { delete req.query.limit; } // intention to get all
		if (req.query.skip === 0) { delete req.query.skip; } // pointless to have
		// turn into aggregation if query.select contains aggregation specific operators that starts with '$' like $filter
		if (!!req.query.select && (req.query.select[0] === '{') && (req.query.select.indexOf('"$') > 0)) { if (req.query.aggregate == null) { req.query.aggregate = 'true'; } }
		// turn into aggregation if query.group or query.unwind is present and not empty
		if (!!req.query.group || !!req.query.unwind) { if (req.query.aggregate == null) { req.query.aggregate = 'true'; } }
		// handle the case where there are multiple conditions specificed in the query string by merging them
		if (Array.isArray(req.baucis.conditions)) {
			req.baucis.conditions = _.flatten(req.baucis.conditions.map(o => JSON.parse(`[${o}]`))).reduce(function (out, obj) {
				if ((obj != null ? obj.constructor.name : undefined) === 'String') { throw rested.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', obj); }
				for (let key of Array.from(Object.keys(obj))) { out[key] = obj[key]; }
				return out;
			}, {});
		}
		// query parameters validation
		if ((req.query.skip != null) && isNaN(req.query.skip)) { return nxt(rested.Error.BadRequest('Skip must be a positive integer if set')); }
		if ((req.query.limit != null) && isNaN(req.query.limit)) { return nxt(rested.Error.BadRequest('Limit must be a positive integer if set')); }
		if ((req.baucis.conditions != null ? req.baucis.conditions.constructor.name : undefined) === 'String') { return nxt(rested.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', req.baucis.conditions)); }
		// if no conditions specificed then check if any of the query params matches any of the model attributes to construct conditions
		_.each(Object.keys(req.query || {}), function (key) {
			let kalias;
			if (['conditions', 'sort', 'limit', 'skip', 'count', 'select', 'populate', 'distinct', 'explain', 'aggregate', 'group', 'unwind'].includes(key)) { return; }
			if (!(((kalias = controller.model().schema.alias(key)) != null) && (controller.model().schema.path(kalias) != null))) { return; }
			if (req.query[key][0] === '{') {
				req.query[key] = JSON.parse(req.query[key]);
			} else if (req.query[key].indexOf(',') > 0) {
				req.query[key] = { $in: req.query[key].split(',') };
			}
			req.baucis.conditions[kalias] = req.query[key];
			return delete req.query[key];
		});
		// set model defaults for the conditions, sort and population
		if (controller.model().defaults != null) {
			if (req.query.sort == null) { req.query.sort = controller.model().defaults.sort; }
			if (!req.query.select || (((req.query.select != null ? req.query.select[0] : undefined) === '-') && (__guard__(controller.model().defaults.select, x3 => x3[0]) === '-')) || (((req.query.select != null ? req.query.select.trim : undefined) != null) && ((req.query.select != null ? req.query.select[0] : undefined) !== '-') && (__guard__(controller.model().defaults.select, x4 => x4[0]) !== '-'))) {
				req.query.select = ((req.query.select || '').trim() + ' ' + (controller.model().defaults.select || '').trim()).trim();
			}
			req.query.populate = ((req.query.populate || '').trim() + ' ' + (controller.model().defaults.populate || '').trim()).trim();
			if ((!req.headers.accept || (req.headers.accept === "*/*")) && (req.query.aggregate !== 'true')) { req.headers.accept = (controller.model().defaults.accept || "*/*"); }
			_.extend(req.baucis.conditions, __guardMethod__(controller.model().defaults.conditions, 'call', o => o.call(req.baucis.conditions)) || controller.model().defaults.conditions);
		}
		// map any aliases used in the query parameters
		if (req.query.distinct) { req.query.distinct = controller.model().schema.alias(req.query.distinct); }
		if (req.query.sort) { req.query.sort = _.map(req.query.sort.trim().split(' '), controller.model().schema.alias).join(' '); }
		if (((req.query.select != null ? req.query.select.trim : undefined) != null) && (req.query.select[0] !== '{')) { req.query.select = _.map(req.query.select.trim().split(' '), controller.model().schema.alias).join(' '); }
		if (req.query.populate) { req.query.populate = _.map(req.query.populate.trim().split(/\s|,/), controller.model().schema.alias).join(' '); }
		req.baucis.conditions = controller.model().schema.rearrange(req.baucis.conditions, req.query.populate);
		// ensure the selected fields doesn't conflict with the populate
		if (!!req.query.populate && (!!req.query.select || req.baucis.conditions)) {
			// take out conditions targeted for sub docuemnts
			let _select;
			Object.keys(req.baucis.conditions).forEach(k => req.query.populate.trim().split(' ').forEach(function (p) {
				if ((req.query.distinct != null ? req.query.distinct.indexOf(p + '.') : undefined) === 0) {
					if (_conditions[p] == null) { _conditions[p] = {}; }
					_distinct[p] = req.query.distinct.substr(p.length + 1);
				}
				if (k.indexOf(p + '.') !== 0) { return; }
				if (k.substr(p.length + 1) === '_id') {
					req.baucis.conditions[p] = req.baucis.conditions[k];
				} else if (req.baucis.conditions[k] != null) {
					const _replace = (((controller.model().schema.path(k) != null) || (controller.model().schema.path(p) != null)) && (controller.model().schema.path(p).instance !== 'Array') ? _conditions : undefined) || _matches;
					if (_replace[p] == null) { _replace[p] = {}; }
					_replace[p][k.substr(p.length + 1)] = JSON.parse(JSON.stringify(req.baucis.conditions[k]).replace(new RegExp(`\"${p}.`, 'gm'), '"'));
					// supress the effect of the join condition if it is included in $or query on the master collection
					__guard__(_.find(req.baucis.conditions.$or, k => k[p] != null), x5 => x5[p] = { $exists: true });
				}
				// take out the join condition from the query directed to the master collection
				return delete req.baucis.conditions[k];
			}));
			// esnure that sort id directed to the right collection if it is intended to be on the child
			if (req.query.sort) { _sort = req.query.sort.match(new RegExp(`(\\s|^)-?(${req.query.populate.split(' ').join('|')})\\.[^\\s]+`, 'gm')); }
			if (_sort) { req.query.sort = req.query.sort.replace(new RegExp(`(\\s|^)-?(${req.query.populate.trim().split(' ').join('|')})\\.[^\\s]+`, 'gm'), ''); }
			// override the populate if there are any selection targeted on sub documents
			if (req.query.select && (req.query.select[0] !== '{')) { _select = req.query.select.match(new RegExp(`(\\s|^)-?(${req.query.populate.split(' ').join('|')})\\.[^\\s]+`, 'gm')); }
			if (!!_select) {
				if (_select) { req.query.select = req.query.select.replace(new RegExp(`(\\s|^)-?(${req.query.populate.trim().split(' ').join('|')})\\.[^\\s]+`, 'gm'), ''); }
				if (!!req.query.select && (req.query.select[0] !== '-')) { req.query.select += ` ${req.query.populate.replace(new RegExp(`(\\s|^)(${req.query.select.trim().split(' ').join('|')})(\\s|$)`, 'gm'), '$3')}`; }
			}
			if (!!req.query.populate) { req.baucis.allowPopulateSelect = true; }
			req.query.populate = req.query.populate.split(' ').map(function (pop) {
				let _model, _pop, ref;
				const model = controller.model();
				const _path = xpath.call(model.schema, pop);
				if (!!(ref = xref(_path))) { _model = xmodel(ref); }
				const _options = _.clone(__guard__(_path != null ? _path.caster : undefined, x5 => x5.options) || (_path != null ? _path.options.options : undefined) || (_path != null ? _path.options : undefined) || {});
				if (!!req.query.select && !!(_path != null ? _path.options.localField : undefined) && (req.query.select[0] !== '{') && (req.query.select[0] !== '-') && !req.query.select.match(_path != null ? _path.options.localField : undefined)) { req.query.select += ` ${_path.options.localField}`; }
				if ((_options.lean == null)) { _options.lean = __guard__((_model || model).schema.options.toJSON, x6 => x6.virtuals) !== true; }
				Object.keys(_options).forEach(function (key) { if (!(['lean', 'sort', 'limit'].includes(key))) { return delete _options[key]; } });
				if (_options.lean !== false) { _options.lean = true; }
				if (_select) { _pop = _.filter(_select, p => p.match(new RegExp(`(\\s|^)-?(${pop})\\.`))).join(' ').replace(new RegExp(`(\\s|^)(-)?(${pop})\\.`, 'gm'), '$2'); }
				if (!!_pop && (_model != null)) { _pop = _pop.split(' ').map(p => alias.call(_model.schema, p, _model.defaults != null ? _model.defaults.path : undefined)).join(' '); }
				if (!!!_pop && (_model != null)) { _pop = _model.defaults != null ? _model.defaults.select : undefined; }
				let _match = _matches[pop];
				// if select contains array positional filter then ensure conditions passed through populate
				if (_pop != null ? _pop.match(/\.\$(\s|$)/) : undefined) { if (_match == null) { _match = JSON.parse(JSON.stringify(_conditions[pop])); } }
				// simplify the populate match when it only contains a single $and
				if (_match && (Object.keys(_match).length === 1) && ((_match.$and != null ? _match.$and.length : undefined) === 1)) { _match = _match.$and[0]; }
				return { path: pop, select: _pop, match: _match, options: _options, model: _model };
			});
		}
		// pass through the query select parameter if it is specified as json object
		if (!!req.query.select && (req.query.select[0] === '{')) {
			req.query.select = controller.model().schema.rearrange(req.query.select, req.query.populate, false);
			// throw error if select represents an object whilst it can't be parsed as an object
			if (req.query.select.constructor.name === 'String') { return nxt(rested.Error.BadRequest('The select query string value was not valid JSON: "%s"', req.query.select)); }
			// recheck the query select if it needs defaulting by model default select after being cleaned of populate selected fields
		} else if (!!!req.query.select && !!__guard__(controller.model().defaults, x5 => x5.select)) {
			req.query.select = ((req.query.select || '').trim() + ' ' + (controller.model().defaults.select || '').trim()).trim();
		}
		// replace the conditions targeted to sub documents with the specific targeted set using the _id
		var _nxt = function (index) {
			let _model, key, ref;
			if (((key = Object.keys(_conditions)[index]) == null)) { return nxt(); }
			const _path = xpath.call(controller.model().schema, key);
			if (!!(ref = xref(_path))) { _model = xmodel(ref); }
			// ignore the sub condition if can't find its model
			if ((_model == null) && delete _conditions[key]) { return _nxt(index); }
			let superset = [];
			const cur = controller.model().find(req.baucis.conditions).select({ [key]: 1, '_id': Number(key === '_id') }).lean().cursor();
			res.on('close', () => cur.close(nxt = cur.removeAllListeners() && null));
			cur.on('data', doc => superset.push(doc));
			cur.on('error', err => nxt(err));
			return cur.on('end', function () {
				superset = Array.from(new Set(superset.map(s => s[key]).filter(s => s != null)));
				// if a distinct is requested on a joined model, then just return the results
				if (!!req.query.distinct && !!_distinct[key]) { return _model.distinct(_distinct[key], _.extend(_conditions[key], { _id: { $in: superset } }), function (err, results) { if ((req.baucis.documents = results) && (delete req.query.distinct)) { return nxt(err); } }); }
				const sort = _.filter(_sort, p => p.match(new RegExp(`(\\s|^)-?(${key})\\.`))).join(' ').replace(new RegExp(`(\\s|^)(-)?(${key})\\.`, 'gm'), '$2');
				// assume all _id's fits into a single find of 16mb size
				let supersets = [superset];
				// due to 16mb document size limit, we should calculate how many _id's can fit in 12mb max to workaround this limitation
				const cutoff = Math.floor((12 * 1024 * 1024) / (superset[0] != null ? superset[0].toString().length : undefined));
				// split the _id's into chunks each with max of cutoff limit
				if (superset.length > cutoff) { supersets = _.values(_.groupBy(superset, (obj, ix) => Math.floor(ix / cutoff))); }
				// if there is more than a single _id's chunk or the model implements transform function then let the sort, skip and limit pass through as the final stage
				const safe = (Object.keys(_conditions).length === 1) && (__guard__(controller.model().schema.options.toJSON, x6 => x6.virtuals) !== true) && (supersets.length === 1);
				return async.map(supersets, function (superset, cb) {
					// get distinct list of document id and replace the populated key in the original condition
					let _query = _model.find(_.extend(_conditions[key], { _id: { $in: superset } })).select(_distinct[key] || '_id');
					if (safe && (req.query.limit < superset.length)) { _query = _query.limit(req.query.limit); }
					if ((_path != null ? _path.options.limit : undefined) > 0) { _query = _query.limit(_path != null ? _path.options.limit : undefined); }
					if (!!(_path != null ? _path.options.sort : undefined)) { _query = _query.sort(_path != null ? _path.options.sort : undefined); }
					if (safe && (req.query.skip != null)) { _query = _query.skip(req.query.skip); }
					if (safe && (sort != null)) { _query = _query.sort(sort); }
					return _query.lean().exec(cb);
				}
					, function (err, subset) {
						if (err != null) { return nxt(err); }
						subset = _.flatten(subset);
						if (safe) { delete req.query.skip; }
						if (safe) { delete req.query.limit; }
						subset = Array.from(new Set(subset.map(s => s[_distinct[key] || '_id']).filter(s => s != null)));
						if (((superset[0] != null ? superset[0].constructor.name : undefined) === 'String') && ((subset[0] != null ? subset[0].constructor.name : undefined) !== 'String')) { subset = subset.map(obj => obj != null ? obj.toString() : undefined); }
						let cond = _.find(req.baucis.conditions.$or, k => k[key] != null);
						if (cond == null) { cond = req.baucis.conditions; }
						cond[key] = { $in: subset };
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
		// add a comment with the real ip of the host making the query
		req.baucis.query.comment(((req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace('::ffff:', '').replace('::1', '127.0.0.1') + ' ' + ((req.headers['remote-user'] != null ? req.headers['remote-user'].split('@')[0] : undefined) || '')).trim());
		// if model default hint is provided then use it, if it is a function then call it, otherwise use it as is
		if (__guard__(controller.model().defaults, x3 => x3.hint) != null) { req.baucis.query.hint(__guardMethod__(__guard__(controller.model().defaults, x4 => x4.hint), 'call', o => o.call(req.baucis.query._conditions)) || controller.model().defaults.hint); }
		// when query explain requested ensure lean and no count conficts, explain should take precedence over count
		if (req.query.explain === 'true') { req.baucis.query.lean(req.baucis.query.options.explain = true); } //and delete req.baucis.count #and delete req.query.count
		// if the model.toJSON is not overriden then opt for lean query as it is much faster
		if (__guard__(controller.model().schema.options.toJSON, x5 => x5.virtuals) !== true) { req.baucis.query.lean(); }
		// bypass the callback function name to be used by the formatter when writing into the response
		if (!!req.query.callback && (req.headers.accept === 'application/javascript')) { req.baucis.jsonp = req.query.callback; }
		// set batch size to speed up streaming of the cursor data
		req.baucis.query.batchSize(2000);
		return nxt();
	});

	// handle the count differenctly to the default baucis behaviour that uses collection.count
	controller.query('get', function (req, res, nxt) {
		if (req.query.count === 'true') {
			const _conditions = req.baucis.query._conditions || req.baucis.conditions || JSON.parse(req.query.conditions);
			// handle count on pre-populated documents as in the case of distinct
			if (req.baucis.documents instanceof Array) {
				req.baucis.query.count = cb => cb(null, req.baucis.documents.length);
				// if count is overriden in the model then pass through a callback and write back the count in the response
			} else if (controller.model()._count != null) {
				return controller.model().count(_conditions, function (err, count) {
					if (err) { return nxt(rested.Error.BadRequest()); }
					return res.json(count);
				});
				// ensure count utilise the indexes and hints via cursor instead of collection.count as it doesn't use indexes or hints
			} else if (!!req.baucis.query.op) {
				req.baucis.query = req.baucis.query._collection.findCursor(_conditions, req.baucis.query._optionsForExec());
				if (req.query.explain === 'true') { req.baucis.query.count = req.baucis.query.next; }
			}
		}
		return nxt();
	});

	// implementation of mongodb aggregation $group using http query parameters
	return controller.query('collection', 'get', function (req, res, nxt) {
		if (req.query.aggregate !== 'true') { return nxt(); }
		// helper methods to decode/encode group keys with dots
		const decode = k => (k.indexOf('~') < 0 ? k : undefined) || (k.substr(1).replace(/~/g, '.'));
		const encode = k => (k.indexOf('.') < 0 ? k : undefined) || (`~${k.replace(/\./g, '~')}`);
		// initialize the final projection
		let $project = req.baucis.query._fields;
		if (!Array.isArray(req.baucis.query._pipeline)) {
			delete req.baucis.query.options.sort;
			delete req.baucis.query.options.skip;
			delete req.baucis.query.options.limit;
			const aggregate = aggregator.call(controller.model(), req.baucis.query._conditions || req.baucis.conditions || JSON.parse(req.query.conditions));
			req.baucis.query = aggregate.setOptions(req.baucis.query._mongooseOptions).setOptions(req.baucis.query.options);
		}
		// find the query first $match that maps to query conditions
		const $match = __guard__(_.find(req.baucis.query._pipeline, op => op.$match), x3 => x3.$match) || {};
		// find existing pipeline final projection if not passed in
		if ($project == null) { $project = __guard__(_.last(_.filter(req.baucis.query._pipeline, op => op.$project != null)), x4 => x4.$project) || {}; }
		// ensure $project doesn't have duplicate paths
		Object.keys($project).sort().filter((key, ix, array) => __guard__(array[ix + 1], x5 => x5.indexOf(key + '.')) === 0).forEach(key => delete $project[key]);
		// delay specific steps from the pipeline if there is unwind or group specificed as they take precedence
		if (Array.isArray(req.baucis.query._pipeline) && !!(req.query.unwind || req.query.group)) {
			req.baucis.query._pipeline = _.reject(req.baucis.query._pipeline, op => (op.$skip != null) || (op.$limit != null) || (op.$project === $project));
		}
		if (!!req.query.unwind) {
			// split and map the unwind paths
			let $unwind = _.filter(req.query.unwind.split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
			// unwind the paths sorted by path length, shortest to longest
			$unwind.sort((a, b) => a.length > b.length).forEach(path => req.baucis.query._pipeline.push({ $unwind: `$${path}` }));
			// build regex or match to search for matching keys in the query conditions targeted for any of the unwind paths
			$unwind = $unwind.join('|');
			// project the match conditions for the unwinded paths only
			const umatch = JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) { if (key.match($unwind)) { return val; } })));
			// add the projected match after all the unwinded paths
			req.baucis.query._pipeline.push({ $match: umatch });
		}
		if (!!req.query.group) {
			const gmatch = {};
			let { group } = req.query;
			if (!Array.isArray(group)) { group = [group]; }
			group.forEach(function ($group) {
				if ($group[0] === '{') {
					$group = JSON.parse($group);
					if (($group != null ? $group.constructor.name : undefined) === 'String') { throw rested.Error.BadRequest('The group query string value was not valid JSON: "%s"', $group); }
				}
				if (($group != null ? $group.constructor.name : undefined) === 'String') { $group = { _id: $group, count: { $sum: 1 } }; }
				if (($group != null ? $group._id : undefined) != null) {
					let key;
					if (($group._id.constructor.name === 'String') && ($group._id !== '$_id')) {
						$group._id = _.filter($group._id.split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						$group._id = _.object($group._id.map(encode), $group._id.map(k => `$${k}`));
					}
					['$sum', '$avg', '$first', '$last', '$max', '$min', '$push', '$addToSet', '$stdDevPop', '$stdDevSamp'].forEach(function (op) {
						if (($group[op] == null) || ($group[op].constructor.name !== 'String')) { return; }
						const gop = _.filter($group[op].split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						delete $group[op];
						return _.extend($group, _.object(gop.map(encode), gop.map(k => ({ [op]: `$${k}` }))));
					});
					['$count'].forEach(function (op) {
						if (($group[op] == null) || ($group[op].constructor.name !== 'String')) { return; }
						const gop = _.filter($group[op].split(/\s|\+|\-|\$/)).map(controller.model().schema.alias);
						delete $group[op];
						return _.extend($group, _.object(gop.map(encode), gop.map(k => ({ $sum: { $cond: [`$${k}`, 1, 0] } }))));
					});
					// rearrange the group fields for any aliasing or prefixing specified by the schema
					$group = controller.model().schema.rearrange($group, req.query.populate, false);
					// handle special case when _id is an alias for another field
					if (($group._id == null) && !!(key = controller.model().schema.alias('_id'))) {
						$group._id = $group[key];
						delete $group[key];
					}
					// ensure all $group._id keys with '.' is replaced with '~' as $group keys can't be dotted
					if (_.isObject($group._id)) { $group._id = _.object(Object.keys($group._id).map(encode), _.values($group._id)); }
					// ensure $group._id keys are added to the final $project step
					if (_.isObject($group._id)) {
						Object.keys($group._id).forEach(function (k) {
							let name;
							return $project[name = decode(k)] != null ? $project[name] : ($project[name] = `$_id.${k}`);
						});
					}
					// ensure all other selected fields that are not part of the groups to be mapped as $first
					Object.keys($project).filter(k => $project[k] > 0).forEach(function (k) {
						let name;
						return $group[name = encode(k)] != null ? $group[name] : ($group[name] = { $first: `$${k}` });
					});
					// ensure all $group keys with '.' is replaced with '~' as $group keys can't be dotted
					Object.keys($group).filter(k => k.indexOf('.') > 0).filter(k => $group[encode(k)] = $group[k]).forEach(k => delete $group[k]);
					// ensure all other $group keys that are not selected by default to be projected in the output
					Object.keys($group).filter(k => (k !== '_id') && ($project[k] === undefined)).forEach(k => $project[decode(k)] = `$${k}`);
					// separate the conditions targeted for $group from the conditions targeted at the collection
					_.extend(gmatch, JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) {
						let needle;
						if ((needle = Object.keys($group[encode(key)] || {})[0], ['$sum', '$avg', '$first', '$last', '$max', '$min', '$push', '$addToSet', '$stdDevPop', '$stdDevSamp'].includes(needle))) { return val; }
					}))));
					// remove conditions targeted on $group unless the path is already defined in the schema so it can filters documents before grouping
					for (key of Array.from(Object.keys(gmatch))) { if (!controller.model().schema.paths[key]) { delete $match[key]; } }
					// add the properly constructed $group to the pipeline
					req.baucis.query.group($group);
					// deselect $group._id
					return $project._id = 0;
				}
			});
			// add the grouped match after all grouping is proccessed
			if (!_.isEmpty(gmatch)) { req.baucis.query._pipeline.push({ $match: _.object(Object.keys(gmatch).map(encode), _.values(gmatch)) }); }
		}
		if (_.isObject($project)) {
			const pmatch = {};
			_.extend(pmatch, JSON.parse(JSON.stringify(_.mapObject($match, function (val, key) {
				let needle;
				if (_.isObject($project[key]) && !((needle = Object.keys($project[key])[0], ['$first', '$last', '$push', '$addToSet', '$filter', '$reverseArray'].includes(needle)))) { return val; }
			}))));
			// remove conditions targeted on final $project unless the path is already defined in the schema so it can filter documents before grouping
			for (let key of Array.from(Object.keys(pmatch))) { if (!controller.model().schema.paths[key]) { delete $match[key]; } }
			// $project comes at the end after any grouping or unwinding
			if (!_.find(req.baucis.query._pipeline, op => op.$project === $project)) { req.baucis.query.select($project); }
			// add the projected match after the final projection
			if (!_.isEmpty(pmatch)) { req.baucis.query._pipeline.push({ $match: pmatch }); }
		}
		// $sort follows projection to ensure sorting on correct values
		if (req.query.sort != null) { req.baucis.query.sort(req.query.sort); }
		// $skip follows sorting to ensure right order
		if (req.query.skip != null) { req.baucis.query.skip(req.query.skip); }
		// $limit follows the skip to ensure correct numbder returned
		if (req.query.limit != null) { req.baucis.query.limit(req.query.limit); }
		// use lean if the model is not based on aggregations or lean param set to false
		if (req.query.lean !== 'false') { req.baucis.query.lean(); }
		return nxt();
	});
});

rested.Error = require.cache[require.resolve('rested')].require('rest-error');

function __guard__(value, transform) {
	return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}

function __guardMethod__(obj, methodName, transform) {
	if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
		return transform(obj, methodName);
	} else {
		return undefined;
	}
}
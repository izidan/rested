async = require 'async'
_ = require 'underscore'
baucis = require 'baucis'
moment = require 'moment'
express = require 'express'
es = require 'event-stream'
mongoose = require 'mongoose'

alias = (path, root)->
	root ?= ''
	# skip mongo query operators
	return path if path[0] in ['$','~']
	# skip aggregation specific keys
	return path if path in ['input','as','in','cond','format','timezone','vars','initialValue','if','else','then','case','default','branches','defaults','inputs']#,'date'
	# skip if called with schema unknown
	return path if !(@ instanceof mongoose.Schema)
	# skip include/exclude operators
	return path[0] + alias.call @, path.substr(1), root if path? and path[0] is '-'
	# if path already starts with root then skip root
	return alias.call @, path.substr(root.length), root if !!root and path?.indexOf(root) is 0
	# find exact matching path
	p = @path path
	# skip root when alias is set to false
	root = '' if p?.options?.alias is false or !!p?.options?.alias or path is '_id' or root.indexOf("#{path}.") is 0
	# return the exact schema path if found
	return root + p.path if p?.path.split('.').length >= path.split('.').length
	# find path with exact alias match
	p = _.find @paths, (p)-> p.options.alias is path
	# skip root when alias is set to false
	root = '' if p?.options.alias is false or !!p?.options.alias
	# return the exact alias if found
	return root + p.path if p?
	# fall back to the same path if not found and it is not a complex path
	return root + path if path.indexOf('.') < 0
	# take out the last part of a complex path
	s = path.substr path.lastIndexOf('.') + 1
	# try to find the first part of the path excluding the last part
	p = alias.call @, path.substr(0, path.lastIndexOf '.'), ''
	# fall back to the same path if still not found
	return root + path if not p?
	# find the schema of the complex path
	while not(pp = @path p) and p.indexOf('.') > 0
		s = p.substr(p.lastIndexOf('.') + 1) + '.' + s
		p = p.substr(0, p.lastIndexOf('.'))
	return root + path if not pp?
	# find the alias of the last part of a complex path with a internal or external schema
	s = ((alias.call pp.schema, s, '') if pp.schema) or s
	# find the alias of the last part of a complex path with a external schema
	s = (alias.call xmodel(ref).schema, s, '' if !!(ref = xref pp)) or s
	# return the combined aliases for complex path
	return root + p + '.' + s
	#return root + pp.path + p.substr(pp.path.length) + '.' + s # why using pp.path instead of p?

rearrange = (conditions, populate, cast)->
	schema = @
	elemMatch = []
	return {} if !conditions?
	# stringify conditions if not passed as a string already
	conditions = JSON.stringify(conditions) if conditions.constructor.name isnt 'String'
	# this step is important to eliminate all undefined properties
	conditions = JSON.parse conditions
	# ensure data type casting takes place before rearraning conditions
	mongoose.Query.prototype.cast({ schema: schema }, conditions) if cast isnt false and conditions.constructor.name isnt 'String'
	# stringify again after taking out undefined properties and type casting
	conditions = JSON.stringify conditions
	# take out the $elemMatch(s) before mapping of aliased field
	conditions = conditions.replace(/\{"\$elemMatch":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}}/gm, (txt)-> "\"@elemMatch#{elemMatch.push(txt)}\"") for i in [0..3] if conditions?.indexOf('$elemMatch') > 0
	# take out the $map.in(s) before mapping of aliased field
	conditions = conditions.replace(/"in":{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R)|{([^{}]|(:?R))*})*})*})*})*}/gm, (txt)-> "\"@elemMatch#{elemMatch.push(txt)}\"") for i in [0..3] if conditions?.indexOf('$map') > 0
	# map aliased fields to their underlying paths
	conditions = conditions.replace(/"[^"{},\$]+(?=":)/gm, (txt)-> '"' + schema.alias txt.substr 1) if conditions
	# map aliased fields to their underlying paths when prefixed with $ as in $group, $project and $unwind
	conditions = conditions.replace(/"\$[^"{},\$]+(?="[\],}])/gm, (txt)-> '"$' + schema.alias txt.substr 2) if conditions
	# handle aliasing within the $elemMatch object
	conditions.match(/(?!=")([^"{},]+)":({"\$\w+":)?"\@elemMatch(\d+)(?=")/gm)?.map((m)-> [m.split('"')[0], parseInt(m.split('@elemMatch')[1])]).forEach((m)->
		elemMatch[m[1]-1] = elemMatch[m[1]-1].replace(/(?!=")[^"{},]+(?=":)/gm, (txt)->
			schema.alias(m[0] + '.' + txt).replace new RegExp("^.*?#{m[0]}\\."), '')) for i in [0..elemMatch.length]
	# put back $elemMatch(s) as mapping aliased fields
	conditions = conditions.replace(/"\@elemMatch\d+"/gm, (txt)-> elemMatch[parseInt(txt.substr(11))-1]) for i in [0..elemMatch.length]
	# handle short handed regex matches to appropriate mongo regex query
	conditions = conditions.replace /:"\/([^"]+)\/([igm]+)"/g, ':{"$regex":"$1","$options":"$2"}'
	# undo the aliasing for conditions targeted to populated models, this will be handled later on
	populated = populate?.map?((p)-> p.path).join(' ') or populate
	conditions = conditions.replace(new RegExp('"(\\$or|\\$and)":\\[{"(' + populated.trim().split(' ').join('|') + ')\.', 'gm'),'"$2.$1":[{"$2.') if !!populated
	# ensure dates always have time parts when before sending to mongo
	conditions = conditions.replace new RegExp('"(' + RegExp.ISODate + ')"', "g"), '"$1T00:00:00Z"'
	# parse conditions back into object
	conditions = JSON.parse conditions
	# ensure data type casting takes place post rearraning conditions
	mongoose.Query.prototype.cast({ schema: schema }, conditions) if cast isnt false
	# delete conditions targeted to populated objects when not populated
	Object.keys(conditions).filter((k)-> k.match /\.\$and$/ ).map((k)-> k.split('.$and')[0]).filter((k)-> populated.split(' ').indexOf(k) < 0).forEach (k)->
		Object.keys(conditions).filter((k2)-> k2.indexOf(k) is 0).forEach (k2)-> delete conditions[k2]
	return conditions

refs = -> _.uniq(_.filter _.union _.map(@virtuals, (v)-> v.options.ref), _.map(@paths, (p)-> p.options.ref or p.options.type?[0]?.ref or (refs.call p.schema if p.schema?)), (r)-> !!r).toString()
xrefs = -> _.uniq(_.filter _.union _.map(@virtuals, (v)-> v.path if v.options.ref), _.flatten(_.map(@paths, (p)-> ((p.options.alias or p.path) if p.options.ref or p?.caster?.options?.ref or p.options.type?[0]?.ref) or (xrefs.call p.schema if p.schema?)?.split(',').map((pp)-> "#{p.path}.#{pp}" if !!pp))), (r)-> !!r).toString()
xmodel = (modelName)-> mongoose.models[modelName] or _.find(mongoose.connections, (c)-> c.models[modelName])?.models[modelName]
xref = (path)-> path?.options?.ref or path?.caster?.options?.ref or path?.options?.type?[0]?.ref
xpath = (path)->
	p = @paths[_.find(Object.keys(@paths), (p)-> path.indexOf(p) is 0)]
	p ?= @virtuals[_.find(Object.keys(@virtuals), (p)-> path.indexOf(p) is 0)]
	return p if !p?.schema? or p.path is path
	xpath.call p.schema, path.substr p.path.length + 1

aggregator = (conditions)->
	# determine the aggregation pipeline steps either by calling a function or append to the conditions
	# must clone the aggregation pipeline to avoid any modifications to the original defaults.aggregate
	conditions = JSON.parse JSON.stringify conditions
	aggregate = _.filter JSON.parse JSON.stringify(@defaults?.aggregate?.call?(conditions) or [{ $match: conditions }].concat(@defaults?.aggregate or [])).replace(/\{"\$[a-z]+":{}}/g, 'null')
	# the call to cursor() is required to ensure that a readable stream of aggregation results is created
	aggregate = @aggregate(aggregate).allowDiskUse(true)
	# any selected fields should come last in the aggregation pipeline
	aggregate.select = (fields)->
		fields = (JSON.parse("{#{fields.replace(/[\s|\+]?(-)?([\w|\.|\:|\#|\@]+)/g,',"$2":$11').substr(1)}}") if !!fields and fields.constructor.name is 'String') or fields or {}
		# fix for "The top-level _id field is the only field currently supported for exclusion"
		if _.find(_.values(fields), (v)-> !(v in [0, -1]))?
			Object.keys(fields).forEach (k)-> delete fields[k] if fields[k] < 1 and k isnt '_id'
		else
			Object.keys(fields).forEach (k)-> fields[k] = 0 if fields[k] < 1
		# if only _id is deselected while no other explicit selection specificed
		delete fields._id if Object.keys(fields).length is 1
		# only project if there is a meaningful selection criteria
		@append { $project: fields } if Object.keys(fields).length > 0
		return @
	# capture the fields needs population to be used later within the streamed results
	aggregate.populate = (path)->
		if path.constructor.name is 'String'
			@options.populate = path
		else
			@options.populate ?= []
			@options.populate.push path
		return @
	# support lean function to skip instantiating a model instance for each doc
	aggregate.lean = ->
		@options.lean = true
		return @
	# support hint function to allow using specific index by the query optimiser
	aggregate.hint = (hint)->
		@options.hint = hint
		return @
	# support comment function to allow capturing extra query stats
	aggregate.comment = (str)->
		@options.comment = str
		return @
	# support hint function to allow using specific index by the query optimiser
	aggregate.batchSize = (size)->
		@options.cursor = { batchSize: size }
		return @
	# support set extra options when provided
	aggregate.setOptions = (opt)->
		_.extend @options, opt
		return @
	# mimic the Query.stream() method by returning a the readable stream that yields the results.
	# the underlying MongoDB driver aggregate() menthod is used as this presents a readable stream using the cursor option
	aggregate.cursor = ->
		_model = @_model
		_populate = @options.populate
		# turn populate into an array of population object instead of a plain key/value pair
		_populate = Object.values(_populate||{}) if !!_populate and !Array.isArray(_populate) and _populate.constructor.name isnt 'String'
		# mute populate option from db
		delete @options.populate
		# disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete @options.hint
		delete @options.comment
		# default cursor batchSize if not set
		@options.cursor ?= { batchSize: 2000 }
		# ignore $natural sort as it can't work with aggregation
		@_pipeline.filter((o)-> o.$sort?).forEach (obj)-> delete obj.$sort if delete obj.$sort.$natural and Object.keys(obj.$sort).length is 0
		# remove empty objects in the pipeline
		@_pipeline = _.reject @_pipeline, (obj)-> Object.keys(obj).length is 0
		# find the safe point to optimise the pipeline
		safe = _.max @_pipeline.map (op, i)-> (i if op? and (op.$group? or op.$match or op.$lookup?.pipeline or (op.$unwind and op.$unwind.preserveNullAndEmptyArrays isnt true) or op.$replaceRoot or op.$addFields)) or 0
		# optimise sort, skip and limit position in the pipeline
		relocate = _.uniq @_pipeline.filter((op)-> op.$sort? or op.$skip? or op.$limit?), (op)-> JSON.stringify op
		sort = Object.keys _.find(relocate, (op)-> op.$sort)?.$sort or {}
		safe = Math.max(safe, _.max @_pipeline.map (op, i)-> (i if i > safe and !_.isEmpty _.pick op?.$project, (v, k)-> isNaN(v) and sort.indexOf(k) >= 0) or 0) if sort.length > 0
		_pipeline = _.reject @_pipeline, (op, ix)-> (ix > safe and op.$sort?) or op.$skip? or op.$limit?
		relocate.forEach (op)-> _pipeline.splice ++safe, 0, op
		# create the cursor using aggregation on the underying model collection
		stream = cursor = _model.collection.aggregate _pipeline, @options
		# populate each document for the requested paths
		stream = stream?.pipe(es.map (doc, nxt)-> _model.populate.call _model, doc, _populate, nxt) if !!_populate
		# create mongoose model for each of the document returned by the cursor
		stream = stream?.pipe(es.map (doc, nxt)-> nxt null, new _model doc) if @options.lean isnt true
		return cursor if cursor is stream
		# wire up the stream close to the underlying aggregation cursor close
		stream.on 'close', -> cursor.destroy.call cursor
		stream.pause = -> cursor.pause.call cursor, stream.paused = true
		stream.resume = -> cursor.resume.call cursor, stream.paused = false
		# return the piped stream or the underlying cursor
		return stream
	# implement the query.count interface
	aggregate.count = (callback)->
		sum = 1
		# no need for a cursor
		delete @options.cursor
		# populate is useless
		delete @options.populate
		# disabled incompatible aggregations options not recognised post mongoose 5.x update
		delete @options.hint
		delete @options.comment
		# find the safe point to optimise the pipeline
		safe = _.max @_pipeline.map (op, i)-> (i if op?.$group?) or 0
		# for lookups only keep the ones that are followed by $unwind without preserveNullAndEmptyArrays as it won't affect the count calculation
		@_pipeline.forEach (op, ix, pipeline)->
			return if ix < safe
			return if !op?.$lookup?
			unwind = pipeline[ix + 1]?.$unwind
			following = JSON.stringify pipeline[ix + 1]
			following = JSON.stringify pipeline[ix + 2] if (unwind?.path or unwind) is '$' + op.$lookup.as
			pipeline[ix] = undefined if !following?.match('"\\$?' + op.$lookup.as + '["|\\.]') and !op.$lookup.pipeline? # delete if not used in the following pipeline step
			pipeline[ix + 1] = undefined if unwind?.preserveNullAndEmptyArrays is true and unwind.path.indexOf(op.$lookup.as) is 1 and !following.match(/\$replaceRoot/) # mute $unwind
		# remove the unnecessary steps in the pipeline that won't affect the count calculation
		@_pipeline = _.reject @_pipeline, (op)-> op is undefined or op.$sort? or op.$skip? or op.$limit?
		# find the safe point to optimise the pipeline
		safe = _.max @_pipeline.map (op, i)-> (i if op? and (op.$group? or op.$match or op.$lookup?.pipeline? or (op.$unwind and op.$unwind.preserveNullAndEmptyArrays isnt true))) or 0
		# remove anything after the last $group, $match or $unwind as these can reshape the data and affects the count
		@_pipeline = @_pipeline.slice 0, 1 + safe
		# if pipeline ends with $unwind of type string
		if _.last(@_pipeline)?.$unwind?.constructor.name is 'String'
			unwind = @_pipeline.pop().$unwind.substr(1)
			# replace the $unwind and combine with count summing $size instead
			sum = { $size: { $ifNull: [ '$' + unwind, [] ] } }
			# remove any pass through preceeding projection
			@_pipeline.pop() while (project = _.last(@_pipeline).$project?[unwind])? and !project.substr and (project is 1 or project[Object.keys(project)[0]] is 1)
			# only project the unwinded field
			project = _.last(@_pipeline)?.$project or _.last(@_pipeline)?.$group or {}
			Object.keys(project).forEach (k)-> delete project[k] if !(k in [ '_id', unwind ])
		# for grouping only keep _id, $push and $addToSet, anything else should be deleted as it won't affect the count calculation
		@_pipeline.forEach (op, ix, pipeline)->
			return if !op?.$group?
			unwind = pipeline[ix + 1]?.$unwind
			lookup = pipeline[ix + 1]?.$lookup
			following = JSON.stringify pipeline[ix + 1]
			Object.keys(op.$group).forEach (gkey)->
				return if gkey is '_id'
				delete op.$group[gkey] if !unwind and !following and !lookup
				delete op.$group[gkey] if following?.indexOf('"' + gkey + '.') < 0 and following?.indexOf('"' + gkey + '"') < 0 # delete if not used in the following pipeline step
				delete op.$group[gkey] if unwind?.indexOf?(gkey) is 1 # if not used in the following unwind
				delete op.$group[gkey] if unwind?.preserveNullAndEmptyArrays is true and unwind.path.indexOf(gkey) is 1 # if not used in the following unwind
				delete op.$group[gkey] if lookup?.localField? and lookup?.localField? is gkey and !lookup?.localField?.startsWith(gkey + '.') # delete if not used in the following lookup
		# add the count calculation to the pipleline
		@_pipeline.push { $group: { _id: null, count: { $sum: sum } } }
		# ensure only the options needed are the onest to be sent
		@options = JSON.parse JSON.stringify _.mapObject @options, (val)-> val if val? and !_.isObject val
		# execute the aggregation and callback with the count
		@exec (err, results)-> callback err, if results?[0]?.hasOwnProperty('count') then results[0].count else (results?[0] or 0)
	# implement the query.distinct interface
	aggregate.distinct = (path)->
		delete @options.cursor
		@append { $group: { _id: null, distinct: { $addToSet: "$#{path}" } } }
		return { exec: (callback)-> aggregate.exec (err, results)-> callback err, results?[0]?.distinct }
	return aggregate

# register default rest controllers handlers
baucis.Controller.decorators ->
	controller = @
	controller.model().schema.refs = refs
	controller.model().schema.xrefs = xrefs
	controller.model().schema.rearrange = rearrange
	if !!controller.model().defaults?.aggregate
		controller.model().find = aggregator
		controller.model().findOne = aggregator
	controller.model().distinct = ((path, cond)-> @find(cond).distinct path) if !!controller.model().defaults?.aggregate
	controller.model().schema.alias = (path)-> alias.call controller.model().schema, path, controller.model().defaults?.path or ''
	#controller.findBy(controller.model().defaults.findBy) if !!controller.model().defaults?.findBy
	# override the populate to support populating of virtual fields where values provided by virtual getters
	if _.find(controller.model().schema.virtuals, (v)-> !!v.options.ref and v.path is v.options.localField)
		controller.model().$_populate = controller.model().populate
		controller.model().populate = (doc, options, callback)->
			options.filter((p)-> !!controller.model().schema.virtuals[controller.model().schema.paths[p.path]?.options.alias]?.options.localField).forEach (p)-> p.path = controller.model().schema.paths[p.path]?.options.alias
			options.map((p)-> v if (v = controller.model().schema.virtuals[p.path])? and v.getters.length > 1).forEach (v)-> doc[v.path] = v.getters[v.getters.length - 1].call(doc) if v?
			controller.model().$_populate doc, options, callback

	# handle all the custom syntactic sugar addon's and options
	controller.request 'get', (req, res, nxt)->
		_matches = {}
		_distinct = {}
		_conditions = {}
		# ignore skip and limit when counting
		delete req.query.skip if req.query.count is 'true'
		delete req.query.limit if req.query.count is 'true'
		# ensure the skip and limit values are numbers if presented
		req.query.skip = parseInt req.query.skip if !!req.query.skip
		req.query.limit = parseInt req.query.limit if !!req.query.limit
		req.query.limit = 10 if req.query.count isnt 'true' and !!!req.query.limit
		delete req.query.limit if req.query.limit < 0 # intention to get all
		delete req.query.skip if req.query.skip is 0 # pointless to have
		# turn into aggregation if query.select contains aggregation specific operators that starts with '$' like $filter
		req.query.aggregate ?= 'true' if !!req.query.select and req.query.select[0] is '{' and req.query.select.indexOf('"$') > 0
		# turn into aggregation if query.group or query.unwind is present and not empty
		req.query.aggregate ?= 'true' if !!req.query.group or !!req.query.unwind
		# handle the case where there are multiple conditions specificed in the query string by merging them
		if Array.isArray(req.baucis.conditions)
			req.baucis.conditions =  _.flatten(req.baucis.conditions.map (o)-> JSON.parse "[#{o}]").reduce (out, obj)->
				throw baucis.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', obj) if obj?.constructor.name is 'String'
				out[key] = obj[key] for key in Object.keys(obj)
				return out
			, {}
		# query parameters validation
		return nxt(baucis.Error.BadRequest('Skip must be a positive integer if set')) if req.query.skip? and isNaN(req.query.skip)
		return nxt(baucis.Error.BadRequest('Limit must be a positive integer if set')) if req.query.limit? and isNaN(req.query.limit)
		return nxt(baucis.Error.BadRequest('The conditions query string value was not valid JSON: "%s"', req.baucis.conditions)) if req.baucis.conditions?.constructor.name is 'String'
		# if no conditions specificed then check if any of the query params matches any of the model attributes to construct conditions
		_.each Object.keys(req.query or {}), (key)->
			return if key in ['conditions','sort','limit','skip','count','select','populate','distinct','explain','aggregate','group','unwind']
			return if not ((kalias = controller.model().schema.alias(key))? and controller.model().schema.path(kalias)?)
			if req.query[key][0] is '{'
				req.query[key] = JSON.parse req.query[key]
			else if req.query[key].indexOf(',') > 0
				req.query[key] = { $in: req.query[key].split(',') }
			req.baucis.conditions[kalias] = req.query[key]
			delete req.query[key]
		# set model defaults for the conditions, sort and population
		if controller.model().defaults?
			req.query.sort ?= controller.model().defaults.sort
			if !req.query.select or (req.query.select?[0] is '-' and controller.model().defaults.select?[0] is '-') or (req.query.select?.trim? and req.query.select?[0] isnt '-' and controller.model().defaults.select?[0] isnt '-')
				req.query.select = ((req.query.select or '').trim() + ' ' + (controller.model().defaults.select or '').trim()).trim()
			req.query.populate = ((req.query.populate or '').trim() + ' ' + (controller.model().defaults.populate or '').trim()).trim()
			req.headers.accept = (controller.model().defaults.accept or "*/*") if (!req.headers.accept or req.headers.accept is "*/*") and req.query.aggregate isnt 'true'
			_.extend(req.baucis.conditions, controller.model().defaults.conditions?.call?(req.baucis.conditions) or controller.model().defaults.conditions)
		# map any aliases used in the query parameters
		req.query.distinct = controller.model().schema.alias req.query.distinct if req.query.distinct
		req.query.sort = _.map(req.query.sort.trim().split(' '), controller.model().schema.alias).join(' ') if req.query.sort
		req.query.select = _.map(req.query.select.trim().split(' '), controller.model().schema.alias).join(' ') if req.query.select?.trim? and req.query.select[0] isnt '{'
		req.query.populate = _.map(req.query.populate.trim().split(/\s|,/), controller.model().schema.alias).join(' ') if req.query.populate
		req.baucis.conditions = controller.model().schema.rearrange req.baucis.conditions, req.query.populate
		# ensure the selected fields doesn't conflict with the populate
		if !!req.query.populate and (!!req.query.select or req.baucis.conditions)
			# take out conditions targeted for sub docuemnts
			Object.keys(req.baucis.conditions).forEach (k)-> req.query.populate.trim().split(' ').forEach (p)->
				if req.query.distinct?.indexOf(p + '.') is 0
					_conditions[p] ?= {}
					_distinct[p] = req.query.distinct.substr(p.length + 1)
				return if k.indexOf(p + '.') isnt 0
				if k.substr(p.length + 1) is '_id'
					req.baucis.conditions[p] = req.baucis.conditions[k]
				else if req.baucis.conditions[k]?
					_replace = (_conditions if (controller.model().schema.path(k)? or controller.model().schema.path(p)?) and controller.model().schema.path(p).instance isnt 'Array') or _matches
					_replace[p] ?= {}
					_replace[p][k.substr(p.length + 1)] = JSON.parse JSON.stringify(req.baucis.conditions[k]).replace(new RegExp("\"#{p}.", 'gm'), '"')
					# supress the effect of the join condition if it is included in $or query on the master collection
					_.find(req.baucis.conditions.$or, (k)-> k[p]?)?[p] = { $exists: true }
				# take out the join condition from the query directed to the master collection
				delete req.baucis.conditions[k]
			# esnure that sort id directed to the right collection if it is intended to be on the child
			_sort = req.query.sort.match(new RegExp('(\\s|^)-?(' + req.query.populate.split(' ').join('|') + ')\\.[^\\s]+', 'gm')) if req.query.sort
			req.query.sort = req.query.sort.replace(new RegExp('(\\s|^)-?(' + req.query.populate.trim().split(' ').join('|') + ')\\.[^\\s]+', 'gm'),'') if _sort
			# override the populate if there are any selection targeted on sub documents
			_select = req.query.select.match(new RegExp('(\\s|^)-?(' + req.query.populate.split(' ').join('|') + ')\\.[^\\s]+', 'gm')) if req.query.select and req.query.select[0] isnt '{'
			if !!_select
				req.query.select = req.query.select.replace(new RegExp('(\\s|^)-?(' + req.query.populate.trim().split(' ').join('|') + ')\\.[^\\s]+', 'gm'),'') if _select
				req.query.select += ' ' + req.query.populate.replace(new RegExp('(\\s|^)(' + req.query.select.trim().split(' ').join('|') + ')(\\s|$)', 'gm'),'$3') if !!req.query.select and req.query.select[0] isnt '-'
			req.baucis.allowPopulateSelect = true if !!req.query.populate
			req.query.populate = req.query.populate.split(' ').map (pop)->
				model = controller.model()
				_path = xpath.call model.schema, pop
				_model = xmodel ref if !!(ref = xref _path)
				_options = _.clone _path?.caster?.options or _path?.options.options or _path?.options or {}
				req.query.select += ' ' + _path.options.localField if !!req.query.select and !!_path?.options.localField and req.query.select[0] isnt '{' and req.query.select[0] isnt '-' and !req.query.select.match(_path?.options.localField)
				_options.lean = (_model or model).schema.options.toJSON?.virtuals isnt true if !_options.lean?
				Object.keys(_options).forEach (key)-> delete _options[key] if !(key in ['lean', 'sort', 'limit'])
				_options.lean = true if _options.lean isnt false
				_pop = _.filter(_select, (p)-> p.match new RegExp '(\\s|^)-?(' + pop + ')\\.').join(' ').replace(new RegExp('(\\s|^)(-)?(' + pop + ')\\.', 'gm'),'$2') if _select
				_pop = _pop.split(' ').map((p)-> alias.call _model.schema, p, _model.defaults?.path).join(' ') if !!_pop and _model?
				_pop = _model.defaults?.select if !!!_pop and _model?
				_match = _matches[pop]
				# if select contains array positional filter then ensure conditions passed through populate
				_match ?= JSON.parse JSON.stringify _conditions[pop] if _pop?.match /\.\$(\s|$)/
				# simplify the populate match when it only contains a single $and
				_match = _match.$and[0] if _match and Object.keys(_match).length is 1 and _match.$and?.length is 1
				return { path: pop, select: _pop, match: _match, options: _options, model: _model }
		# pass through the query select parameter if it is specified as json object
		if !!req.query.select and req.query.select[0] is '{'
			req.query.select = controller.model().schema.rearrange req.query.select, req.query.populate, false
			# throw error if select represents an object whilst it can't be parsed as an object
			return nxt(baucis.Error.BadRequest('The select query string value was not valid JSON: "%s"', req.query.select)) if req.query.select.constructor.name is 'String'
		# recheck the query select if it needs defaulting by model default select after being cleaned of populate selected fields
		else if !!!req.query.select and !!controller.model().defaults?.select
			req.query.select = ((req.query.select or '').trim() + ' ' + (controller.model().defaults.select or '').trim()).trim()
		# replace the conditions targeted to sub documents with the specific targeted set using the _id
		_nxt = (index)->
			return nxt() if not (key = Object.keys(_conditions)[index])?
			_path = xpath.call controller.model().schema, key
			_model = xmodel ref if !!(ref = xref _path)
			# ignore the sub condition if can't find its model
			return _nxt index if !_model? and delete _conditions[key]
			superset = []
			cur = controller.model().find(req.baucis.conditions).select({"#{key}": 1, '_id': Number(key is '_id')}).lean().cursor()
			res.on 'close', -> cur.close nxt = cur.removeAllListeners() and null
			cur.on 'data', (doc)-> superset.push doc
			cur.on 'error', (err)-> nxt err
			cur.on 'end', ->
				superset = Array.from(new Set(superset.map((s)-> s[key]).filter((s)-> s?)))
				# if a distinct is requested on a joined model, then just return the results
				return _model.distinct(_distinct[key], _.extend(_conditions[key], _id: { $in: superset }), (err, results)-> nxt(err) if (req.baucis.documents = results) and (delete req.query.distinct)) if !!req.query.distinct and !!_distinct[key]
				sort = _.filter(_sort, (p)-> p.match new RegExp '(\\s|^)-?(' + key + ')\\.').join(' ').replace(new RegExp('(\\s|^)(-)?(' + key + ')\\.', 'gm'),'$2')
				# assume all _id's fits into a single find of 16mb size
				supersets = [ superset ]
				# due to 16mb document size limit, we should calculate how many _id's can fit in 12mb max to workaround this limitation
				cutoff = Math.floor(12 * 1024 * 1024 / superset[0]?.toString().length)
				# split the _id's into chunks each with max of cutoff limit
				supersets = _.values _.groupBy(superset, (obj, ix)-> Math.floor(ix / cutoff)) if superset.length > cutoff
				# if there is more than a single _id's chunk or the model implements transform function then let the sort, skip and limit pass through as the final stage
				safe = Object.keys(_conditions).length is 1 and controller.model().schema.options.toJSON?.virtuals isnt true and supersets.length is 1
				async.map supersets, (superset, cb)->
					# get distinct list of document id and replace the populated key in the original condition
					_query = _model.find(_.extend _conditions[key], _id: { $in: superset }).select(_distinct[key] or '_id')
					_query = _query.limit(req.query.limit) if safe and req.query.limit < superset.length
					_query = _query.limit(_path?.options.limit) if _path?.options.limit > 0
					_query = _query.sort(_path?.options.sort) if !!_path?.options.sort
					_query = _query.skip(req.query.skip) if safe and req.query.skip?
					_query = _query.sort(sort) if safe and sort?
					_query.lean().exec cb
				, (err, subset)->
					return nxt err if err?
					subset = _.flatten subset
					delete req.query.skip if safe
					delete req.query.limit if safe
					subset = Array.from(new Set(subset.map((s)-> s[_distinct[key] or '_id']).filter((s)-> s?)))
					subset = subset.map((obj)-> obj?.toString()) if superset[0]?.constructor.name is 'String' and subset[0]?.constructor.name isnt 'String'
					cond = _.find req.baucis.conditions.$or, (k)-> k[key]?
					cond ?= req.baucis.conditions
					cond[key] = { $in: subset }
					delete _conditions[key]
					_nxt ++index
		# start replacing the sub docuemnts conditions async and only call next handler when conditions are replaced
		return _nxt 0

	# handle all query extra options, select = {}, lean, hint, explain, comment and batch size
	controller.query 'get', (req, res, nxt)->
		# add a comment with the real ip of the host making the query
		req.baucis.query.comment ((req.headers['x-forwarded-for'] or req.connection.remoteAddress).replace('::ffff:','').replace('::1','127.0.0.1') + ' ' + (req.headers['remote-user']?.split('@')[0] or '')).trim()
		# if model default hint is provided then use it, if it is a function then call it, otherwise use it as is
		req.baucis.query.hint(controller.model().defaults?.hint.call?(req.baucis.query._conditions) or controller.model().defaults.hint) if controller.model().defaults?.hint?
		# when query explain requested ensure lean and no count conficts, explain should take precedence over count
		req.baucis.query.lean(req.baucis.query.options.explain = true) if req.query.explain is 'true' #and delete req.baucis.count #and delete req.query.count
		# if the model.toJSON is not overriden then opt for lean query as it is much faster
		req.baucis.query.lean() if controller.model().schema.options.toJSON?.virtuals isnt true
		# bypass the callback function name to be used by the formatter when writing into the response
		req.baucis.jsonp = req.query.callback if !!req.query.callback and req.headers.accept is 'application/javascript'
		# set batch size to speed up streaming of the cursor data
		req.baucis.query.batchSize 2000
		nxt()

	# handle the count differenctly to the default baucis behaviour that uses collection.count
	controller.query 'get', (req, res, nxt)->
		if req.query.count is 'true'
			_conditions = req.baucis.query._conditions or req.baucis.conditions or JSON.parse(req.query.conditions)
			# handle count on pre-populated documents as in the case of distinct
			if req.baucis.documents instanceof Array
				req.baucis.query.count = (cb)-> cb null, req.baucis.documents.length
			# if count is overriden in the model then pass through a callback and write back the count in the response
			else if controller.model()._count?
				return controller.model().count _conditions, (err, count)->
					return nxt baucis.Error.BadRequest() if err
					res.json count
			# ensure count utilise the indexes and hints via cursor instead of collection.count as it doesn't use indexes or hints
			else if !!req.baucis.query.op
				req.baucis.query = req.baucis.query._collection.findCursor(_conditions, req.baucis.query._optionsForExec())
				req.baucis.query.count = req.baucis.query.next if req.query.explain is 'true'
		nxt()

	# implementation of mongodb aggregation $group using http query parameters
	controller.query 'collection', 'get', (req, res, nxt)->
		return nxt() if req.query.aggregate isnt 'true'
		# helper methods to decode/encode group keys with dots
		decode = (k)-> (k if k.indexOf('~') < 0) or (k.substr(1).replace /~/g,'.')
		encode = (k)-> (k if k.indexOf('.') < 0) or ('~' + k.replace /\./g,'~')
		# initialize the final projection
		$project = req.baucis.query._fields
		if !Array.isArray(req.baucis.query._pipeline)
			delete req.baucis.query.options.sort
			delete req.baucis.query.options.skip
			delete req.baucis.query.options.limit
			aggregate = aggregator.call controller.model(), req.baucis.query._conditions or req.baucis.conditions or JSON.parse(req.query.conditions)
			req.baucis.query = aggregate.setOptions(req.baucis.query._mongooseOptions).setOptions(req.baucis.query.options)
		# find the query first $match that maps to query conditions
		$match = _.find(req.baucis.query._pipeline, (op)-> op.$match)?.$match or {}
		# find existing pipeline final projection if not passed in
		$project ?= _.last(_.filter req.baucis.query._pipeline, (op)-> op.$project?)?.$project or {}
		# ensure $project doesn't have duplicate paths
		Object.keys($project).sort().filter((key, ix, array)-> array[ix + 1]?.indexOf(key + '.') is 0).forEach (key)-> delete $project[key]
		# delay specific steps from the pipeline if there is unwind or group specificed as they take precedence
		if Array.isArray(req.baucis.query._pipeline) and !!(req.query.unwind or req.query.group)
			req.baucis.query._pipeline = _.reject req.baucis.query._pipeline, (op)-> op.$skip? or op.$limit? or op.$project is $project
		if !!req.query.unwind
			# split and map the unwind paths
			$unwind = _.filter(req.query.unwind.split /\s|\+|\-|\$/).map controller.model().schema.alias
			# unwind the paths sorted by path length, shortest to longest
			$unwind.sort((a, b)-> a.length > b.length).forEach (path)-> req.baucis.query._pipeline.push { $unwind: '$' + path }
			# build regex or match to search for matching keys in the query conditions targeted for any of the unwind paths
			$unwind = $unwind.join('|')
			# project the match conditions for the unwinded paths only
			umatch = JSON.parse JSON.stringify _.mapObject $match, (val, key)-> val if key.match $unwind
			# add the projected match after all the unwinded paths
			req.baucis.query._pipeline.push { $match: umatch }
		if !!req.query.group
			gmatch = {}
			group = req.query.group
			group = [group] if !Array.isArray group
			group.forEach ($group)->
				if $group[0] is '{'
					$group = JSON.parse $group
					throw baucis.Error.BadRequest('The group query string value was not valid JSON: "%s"', $group) if $group?.constructor.name is 'String'
				$group = { _id: $group, count: { $sum: 1 } } if $group?.constructor.name is 'String'
				if $group?._id?
					if $group._id.constructor.name is 'String' and $group._id isnt '$_id'
						$group._id = _.filter($group._id.split /\s|\+|\-|\$/).map controller.model().schema.alias
						$group._id = _.object $group._id.map(encode), $group._id.map (k)-> '$' + k
					['$sum','$avg','$first','$last','$max','$min','$push','$addToSet','$stdDevPop','$stdDevSamp'].forEach (op)->
						return if !$group[op]? or $group[op].constructor.name isnt 'String'
						gop = _.filter($group[op].split /\s|\+|\-|\$/).map controller.model().schema.alias
						delete $group[op]
						_.extend $group, _.object gop.map(encode), gop.map (k)-> { "#{op}": '$' + k }
					['$count'].forEach (op)->
						return if !$group[op]? or $group[op].constructor.name isnt 'String'
						gop = _.filter($group[op].split /\s|\+|\-|\$/).map controller.model().schema.alias
						delete $group[op]
						_.extend $group, _.object gop.map(encode), gop.map (k)-> { $sum: { $cond: ['$' + k, 1, 0] } }
					# rearrange the group fields for any aliasing or prefixing specified by the schema
					$group = controller.model().schema.rearrange $group, req.query.populate, false
					# handle special case when _id is an alias for another field
					if !$group._id? and !!(key = controller.model().schema.alias '_id')
						$group._id = $group[key]
						delete $group[key]
					# ensure all $group._id keys with '.' is replaced with '~' as $group keys can't be dotted
					$group._id = _.object(Object.keys($group._id).map(encode), _.values $group._id) if _.isObject $group._id
					# ensure $group._id keys are added to the final $project step
					Object.keys($group._id).forEach((k)-> $project[decode k] ?= '$_id.' + k) if _.isObject $group._id
					# ensure all other selected fields that are not part of the groups to be mapped as $first
					Object.keys($project).filter((k)-> $project[k] > 0).forEach (k)-> $group[encode k] ?= { $first: '$' + k }
					# ensure all $group keys with '.' is replaced with '~' as $group keys can't be dotted
					Object.keys($group).filter((k)-> k.indexOf('.') > 0).filter((k)-> $group[encode k] = $group[k]).forEach (k)-> delete $group[k]
					# ensure all other $group keys that are not selected by default to be projected in the output
					Object.keys($group).filter((k)-> k isnt '_id' and $project[k] is undefined).forEach (k)-> $project[decode k] = '$' + k
					# separate the conditions targeted for $group from the conditions targeted at the collection
					_.extend gmatch, JSON.parse JSON.stringify _.mapObject $match, (val, key)-> val if Object.keys($group[encode key] or {})[0] in ['$sum','$avg','$first','$last','$max','$min','$push','$addToSet','$stdDevPop','$stdDevSamp']
					# remove conditions targeted on $group unless the path is already defined in the schema so it can filters documents before grouping
					delete $match[key] for key in Object.keys(gmatch) when !controller.model().schema.paths[key]
					# add the properly constructed $group to the pipeline
					req.baucis.query.group $group
					# deselect $group._id
					$project._id = 0
			# add the grouped match after all grouping is proccessed
			req.baucis.query._pipeline.push { $match: _.object Object.keys(gmatch).map(encode), _.values gmatch } if !_.isEmpty gmatch
		if _.isObject $project
			pmatch = {}
			_.extend pmatch, JSON.parse JSON.stringify _.mapObject $match, (val, key)-> val if _.isObject($project[key]) and !(Object.keys($project[key])[0] in ['$first','$last','$push','$addToSet','$filter','$reverseArray'])
			# remove conditions targeted on final $project unless the path is already defined in the schema so it can filter documents before grouping
			delete $match[key] for key in Object.keys(pmatch) when !controller.model().schema.paths[key]
			# $project comes at the end after any grouping or unwinding
			req.baucis.query.select $project if !_.find req.baucis.query._pipeline, (op)-> op.$project is $project
			# add the projected match after the final projection
			req.baucis.query._pipeline.push { $match: pmatch } if !_.isEmpty pmatch
		# $sort follows projection to ensure sorting on correct values
		req.baucis.query.sort req.query.sort if req.query.sort?
		# $skip follows sorting to ensure right order
		req.baucis.query.skip req.query.skip if req.query.skip?
		# $limit follows the skip to ensure correct numbder returned
		req.baucis.query.limit req.query.limit if req.query.limit?
		# use lean if the model is not based on aggregations or lean param set to false
		req.baucis.query.lean() if req.query.lean isnt 'false'
		nxt()

baucis.Error = require.cache[require.resolve('baucis')].require 'rest-error'

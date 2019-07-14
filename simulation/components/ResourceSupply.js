function ResourceSupply() {}

ResourceSupply.prototype.Schema =
	"<a:help>Provides a supply of one particular type of resource.</a:help>" +
	"<a:example>" +
		"<Amount>1000</Amount>" +
		"<Type>food.meat</Type>" +
		"<KillBeforeGather>false</KillBeforeGather>" +
		"<MaxGatherers>25</MaxGatherers>" +
		"<DiminishingReturns>0.8</DiminishingReturns>" +
	"</a:example>" +
	"<optional>"+
		"<element name='SpawnEntityOnExhaustion'>"+
			"<text/>"+
		"</element>"+
	"</optional>"+
	"<optional>" +
		"<element name='RequiredTechnology'>"+
			"<text/>"+
		"</element>"+
	"</optional>" +
	"<optional>" +
		"<element name='WorkStation'>" +
			"<data type='boolean'/>" +
		"</element>" +
	"</optional>" +
	"<element name='KillBeforeGather' a:help='Whether this entity must be killed (health reduced to 0) before its resources can be gathered'>" +
		"<data type='boolean'/>" +
	"</element>" +
	"<element name='Amount' a:help='Amount of resources available from this entity'>" +
		"<choice><data type='nonNegativeInteger'/><value>Infinity</value></choice>" +
	"</element>" +
	"<element name='Type' a:help='Type and Subtype of resource available from this entity'>" +
		Resources.BuildChoicesSchema(true, true) +
	"</element>" +
	"<element name='MaxGatherers' a:help='Amount of gatherers who can gather resources from this entity at the same time'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>" +
	"<optional>" +
		"<element name='DiminishingReturns' a:help='The relative rate of any new gatherer compared to the previous one (geometric sequence). Leave the element out for no diminishing returns.'>" +
			"<ref name='positiveDecimal'/>" +
		"</element>" +
	"</optional>";

ResourceSupply.prototype.Init = function()
{
	// Current resource amount (non-negative)
	this.maxAmmount = +this.template.Amount;
	this.amount = this.GetMaxAmount();

	// List of IDs for each player
	this.gatherers = [];
	let numPlayers = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager).GetNumPlayers();
	for (let i = 0; i < numPlayers; ++i)
		this.gatherers.push([]);

	this.infinite = !isFinite(+this.template.Amount);

	let [type, subtype] = this.template.Type.split('.');
	this.cachedType = { "generic": type, "specific": subtype };
};

ResourceSupply.prototype.IsInfinite = function()
{
	return this.infinite;
};

ResourceSupply.prototype.GetKillBeforeGather = function()
{
	return (this.template.KillBeforeGather == "true");
};

ResourceSupply.prototype.SetMax = function(amount)
{
	this.maxAmmount = amount;
	this.amount = this.maxAmmount;
}

ResourceSupply.prototype.AddToMax = function(amount)
{
	this.maxAmmount += amount;
	this.amount = this.maxAmmount;
}

ResourceSupply.prototype.GetMaxAmount = function()
{
	return this.maxAmmount;
};

ResourceSupply.prototype.GetCurrentAmount = function()
{
	return this.amount;
};

ResourceSupply.prototype.GetMaxGatherers = function()
{
	return +this.template.MaxGatherers;
};

ResourceSupply.prototype.GetNumGatherers = function()
{
	return this.gatherers.reduce((a, b) => a + b.length, 0);
};

/* The rate of each additionnal gatherer rate follow a geometric sequence, with diminishingReturns as common ratio. */
ResourceSupply.prototype.GetDiminishingReturns = function()
{
	if ("DiminishingReturns" in this.template)
	{
		let diminishingReturns = ApplyValueModificationsToEntity("ResourceSupply/DiminishingReturns", +this.template.DiminishingReturns, this.entity);
		if (diminishingReturns)
		{
			let numGatherers = this.GetNumGatherers();
			if (numGatherers > 1)
				return diminishingReturns == 1 ? 1 : (1. - Math.pow(diminishingReturns, numGatherers)) / (1. - diminishingReturns) / numGatherers;
		}
	}
	return null;
};

ResourceSupply.prototype.TakeResources = function(rate)
{
	// Before changing the amount, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	if (this.infinite)
		return { "amount": rate, "exhausted": false };

	// 'rate' should be a non-negative integer

	let old = this.amount;
	this.amount = Math.max(0, old - rate);
	let change = old - this.amount;

	// Remove entities that have been exhausted
	if (this.amount === 0) {
		if (this.timer) {
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.timer);
			this.timer = undefined;
		}
		if (this.template.SpawnEntityOnExhaustion)
			this.CreateExhaustionEntity();
		Engine.DestroyEntity(this.entity);
	}

	Engine.PostMessage(this.entity, MT_ResourceSupplyChanged, { "from": old, "to": this.amount });

	return { "amount": change, "exhausted": (this.amount === 0) };
};

ResourceSupply.prototype.CreateExhaustionEntity = function()
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition.IsInWorld())
		return INVALID_ENTITY;

	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	// Check we have needed research
	if (cmpOwnership && this.template.RequiredTechnology) {
		let cmpTechnologyManager = QueryPlayerIDInterface(cmpOwnership.GetOwner(), IID_TechnologyManager);
		if (cmpTechnologyManager && !cmpTechnologyManager.IsTechnologyResearched(this.template.RequiredTechnology))
			return;
	}	

	let spawnedEntity = Engine.AddEntity(this.template.SpawnEntityOnExhaustion);

	let cmpSpawnedPosition = Engine.QueryInterface(spawnedEntity, IID_Position);
	let pos = cmpPosition.GetPosition();
	cmpSpawnedPosition.JumpTo(pos.x, pos.z);
	let rot = cmpPosition.GetRotation();
	cmpSpawnedPosition.SetYRotation(rot.y);
	cmpSpawnedPosition.SetXZRotation(rot.x, rot.z);

	let cmpSpawnedOwnership = Engine.QueryInterface(spawnedEntity, IID_Ownership);
	if (cmpOwnership && cmpSpawnedOwnership)
		cmpSpawnedOwnership.SetOwner(cmpOwnership.GetOwner());

	return spawnedEntity;
}

ResourceSupply.prototype.IsWorkStation = function()
{
	return !!this.template.WorkStation && this.template.WorkStation=="true";
}

ResourceSupply.prototype.GetType = function()
{
	// All resources must have both type and subtype
	return this.cachedType;
};

ResourceSupply.prototype.IsAvailable = function(player, gathererID)
{
	return this.amount > 0 && (this.GetNumGatherers() < this.GetMaxGatherers() || this.gatherers[player].indexOf(gathererID) !== -1);
};

ResourceSupply.prototype.AddGatherer = function(player, gathererID)
{
	if (!this.IsAvailable(player, gathererID))
		return false;

	if (this.gatherers[player].indexOf(gathererID) === -1)
	{
		this.gatherers[player].push(gathererID);
		// broadcast message, mainly useful for the AIs.
		Engine.PostMessage(this.entity, MT_ResourceSupplyNumGatherersChanged, { "to": this.GetNumGatherers() });
	}

	return true;
};

// should this return false if the gatherer didn't gather from said resource?
ResourceSupply.prototype.RemoveGatherer = function(gathererID, player)
{
	// this can happen if the unit is dead
	if (player == undefined || player == INVALID_PLAYER)
	{
		for (let i = 0; i < this.gatherers.length; ++i)
			this.RemoveGatherer(gathererID, i);
	}
	else
	{
		let index = this.gatherers[player].indexOf(gathererID);
		if (index !== -1)
		{
			this.gatherers[player].splice(index,1);
			// broadcast message, mainly useful for the AIs.
			Engine.PostMessage(this.entity, MT_ResourceSupplyNumGatherersChanged, { "to": this.GetNumGatherers() });
			return;
		}
	}
};

ResourceSupply.prototype.GatherWorkStation = function()
{
	let nGatherers = this.GetNumGatherers();
	if (!nGatherers) {
		this.CheckTimer();
		return;
	}

	let result = this.TakeResources(nGatherers);
	let cmpPlayer = QueryOwnerInterface(this.entity);
	let type = this.cachedType.generic;
		cmpPlayer.AddResource(type, result.amount);
	if (result.exhausted) {
		this.CheckTimer();
		return;
	}
}

ResourceSupply.prototype.CheckTimer = function()
{
	let gatherers = this.GetNumGatherers();
	if (!gatherers || this.amount <= 0) {
		if (this.timer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.timer);
			this.timer = undefined;
		}
		return;
	}
	if (this.timer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.timer = cmpTimer.SetInterval(this.entity, IID_ResourceSupply, "GatherWorkStation", 1000, 1000, null);
}

ResourceSupply.prototype.OnGarrisonedUnitsChanged = function(msg)
{
	let checkTimer = false;
	for (let worker of msg.removed) {
		let player = Engine.QueryInterface(worker, IID_Ownership).GetOwner();
		this.RemoveGatherer(worker, player);
		checkTimer = true;
	}
	for (let worker of msg.added) {
		let player = Engine.QueryInterface(worker, IID_Ownership).GetOwner();
		if (this.AddGatherer(player, worker))
			checkTimer = true;
	}

	if (checkTimer)
		this.CheckTimer();
}

Engine.RegisterComponentType(IID_ResourceSupply, "ResourceSupply", ResourceSupply);

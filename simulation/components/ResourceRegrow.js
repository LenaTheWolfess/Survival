function ResourceRegrow() {}

ResourceRegrow.prototype.Schema = 
	"<element name = 'Time'>" +
		"<data type='nonNegativeInteger'/>"+
	"</element>"+
	"<element name = 'EntityRegrow'>" +
		"<text/>"+
	"</element>"+
	"<element name = 'MaxToComplete'>"+
		"<ref name='nonNegativeDecimal'/>"+
	"</element>"+
	"<element name = 'Multiplier'>"+
		"<ref name='nonNegativeDecimal'/>"+
	"</element>";

ResourceRegrow.prototype.Init = function()
{
	// Start timer
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	let tt = this.GetTime();
	this.timer = cmpTimer.SetInterval(this.entity, IID_ResourceRegrow, "Grow", tt, tt, null);
	this.grown = 0;
}

ResourceRegrow.prototype.GetTime = function()
{
	return ApplyValueModificationsToEntity("ResourceRegrow/Time", +(this.template.Time), this.entity)
}

ResourceRegrow.prototype.GetBonus = function()
{
	return ApplyValueModificationsToEntity("ResourceRegrow/Multiplier", +(this.template.Multiplier), this.entity);
}

ResourceRegrow.prototype.GetPercents = function()
{
	return Math.floor((this.grown / +this.template.MaxToComplete) * 100.0);
}

ResourceRegrow.prototype.Grow = function()
{
	if (this.grown >= this.template.MaxToComplete && this.timer) {
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		cmpTimer.CancelTimer(this.timer);
		this.timer = undefined;
		this.Regrown();
		return;
	}
	this.grown += 1;
}

ResourceRegrow.prototype.Regrown = function()
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition.IsInWorld())
		return INVALID_ENTITY;

	let spawnedEntity = Engine.AddEntity(this.template.EntityRegrow);

	let cmpSpawnedPosition = Engine.QueryInterface(spawnedEntity, IID_Position);
	let pos = cmpPosition.GetPosition();
	cmpSpawnedPosition.JumpTo(pos.x, pos.z);
	let rot = cmpPosition.GetRotation();
	cmpSpawnedPosition.SetYRotation(rot.y);
	cmpSpawnedPosition.SetXZRotation(rot.x, rot.z);

	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	let cmpSpawnedOwnership = Engine.QueryInterface(spawnedEntity, IID_Ownership);
	if (cmpOwnership && cmpSpawnedOwnership)
		cmpSpawnedOwnership.SetOwner(cmpOwnership.GetOwner());

	// Apply regrow bonus from techs
	let cmpSupply = Engine.QueryInterface(spawnedEntity, IID_ResourceSupply);
	cmpSupply.SetMax(cmpSupply.GetMaxAmount() * this.GetBonus());
		
	Engine.DestroyEntity(this.entity);
}

Engine.RegisterComponentType(IID_ResourceRegrow, "ResourceRegrow", ResourceRegrow);

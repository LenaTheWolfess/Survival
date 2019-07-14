function Morale() {}

Morale.prototype.Schema =
	"<element name='MaxPoints'>"+
		"<ref name='positiveDecimal'/>" +
	"</element>"+
	"<element name='RegenRate'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>"
;

Morale.prototype.Init = function()
{
	this.maxPoints = +this.template.MaxPoints;
	this.morale = +this.template.MaxPoints;
	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);
	this.CheckRegenTimer();
}

Morale.prototype.GetPoints = function()
{
	return this.morale;
}

Morale.prototype.GetMaxPoints = function()
{
	return this.maxPoints;
}

Morale.prototype.GetRegenRate = function()
{
	return this.regenRate;
}

Morale.prototype.GetPercentage = function()
{
	return this.morale / this.maxPoints;
}

Morale.prototype.HasMorale = function(amount)
{
	return this.morale >= amount;
}

Morale.prototype.CancelRegenerationTimer = function()
{
	if (!this.moraleTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.moraleTimer);
	this.moraleTimer = undefined;
}

Morale.prototype.SetPoints = function(value)
{
	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	let old = this.morale;
	this.morale = Math.max(0, Math.min(this.GetMaxPoints(), value));

	this.RegisterMoraleChange(old);
}

Morale.prototype.ExecuteRegeneration = function()
{
	let regen = this.GetRegenRate();
	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (!cmpUnitAI)
		return;

	if (cmpUnitAI.IsIdle() || cmpUnitAI.IsGarrisoned() && !cmpUnitAI.IsTurret())
		this.Increase(regen);
}

Morale.prototype.CheckRegenTimer = function()
{
	if (this.GetRegenRate() == 0 || this.GetPoints() == this.GetMaxPoints())
	{
		if (this.moraleTimer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.moraleTimer);
			this.moraleTimer = undefined;
		}
		return;
	}

	if (this.moraleTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.moraleTimer = cmpTimer.SetInterval(this.entity, IID_Morale, "ExecuteRegeneration", 1000, 1000, null);
}

Morale.prototype.Reduce = function(amount)
{
	if (amount < 0 || amount == 0){
		return;
	}

	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	let old = this.morale;
	this.morale = Math.max(0, this.morale - amount);
	this.RegisterMoraleChange(old);
}

Morale.prototype.Increase = function(amount)
{
	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	if (this.morale == this.GetMaxPoints())
		return {"old": this.morale, "new":this.morale};

	let old = this.morale;
	this.morale = Math.min(this.morale + amount, this.GetMaxPoints());

	this.RegisterMoraleChange(old);

	return {"old": old, "new": this.morale};
}

Morale.prototype.OnValueModification = function(msg)
{
	if(msg.component != "Morale")
		return;

	let oldMaxPoints = this.GetMaxPoints();
	let newMaxPoints = ApplyValueModificationsToEntity("Morale/MaxPoints", +this.template.MaxPoints, this.entity);
	if (oldMaxPoints != newMaxPoints)
	{
		let newPoints = this.GetPoints() * newMaxPoints/oldMaxPoints;
		this.maxPoints = newMaxPoints;
		this.SetPoints(newPoints);
	}

	let oldRegenRate = this.regenRate;
	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);

	if (this.regenRate != oldRegenRate)
		this.CheckRegenTimer();
}

Morale.prototype.RegisterMoraleChange = function(from)
{
	this.CheckRegenTimer();
	Engine.PostMessage(this.entity, MT_MoraleChanged, { "from": from, "to": this.morale });
}

Engine.RegisterComponentType(IID_Morale, "Morale", Morale);
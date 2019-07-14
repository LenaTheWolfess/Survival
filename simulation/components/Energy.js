function Energy() {}

Energy.prototype.Schema =
	"<element name='MaxPoints'>"+
		"<ref name='positiveDecimal'/>" +
	"</element>"+
	"<element name='RegenRate'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>"+
	"<element name='RunDegRate'>" +
		"<ref name='positiveDecimal'/>"+
	"</element>"
	;

Energy.prototype.Init = function()
{
	this.maxPoints = +this.template.MaxPoints;
	this.energy = +this.template.MaxPoints;
	this.runDegRate = ApplyValueModificationsToEntity("Energy/RunDegRate", +this.template.RunDegRate, this.entity);
	this.regenRate = ApplyValueModificationsToEntity("Energy/RegenRate", +this.template.RegenRate, this.entity);
	this.CheckRegenTimer();
	this.UpdateActor();
}

Energy.prototype.GetPoints = function()
{
	return this.energy;
}

Energy.prototype.GetMaxPoints = function()
{
	return this.maxPoints;
}

Energy.prototype.GetRegenRate = function()
{
	return this.regenRate;
}

Energy.prototype.GetPercentage = function()
{
	return this.energy / this.maxPoints;
}

Energy.prototype.HasEnergyToRun = function()
{
	return this.energy && this.energy >= this.runDegRate;
}

Energy.prototype.HasEnergyToStartRun = function()
{
	return this.energy * 2.0 > this.runDegRate;
}

Energy.prototype.HasEnergy = function(amount)
{
	return this.energy >= amount;
}

Energy.prototype.GetRunDegRate = function()
{
	return this.runDegRate;
}

Energy.prototype.GetChargeDegRate = function()
{
	return this.runDegRate;
}

Energy.prototype.CancelChargeTimer = function()
{
	if (!this.chargeTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.chargeTimer);
	this.chargeTimer = undefined;
}

Energy.prototype.CancelRunningTimer = function()
{
	if (!this.runTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.runTimer);
	this.runTimer = undefined;
}

Energy.prototype.CancelRegenerationTimer = function()
{
	if (!this.energyTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.energyTimer);
	this.energyTimer = undefined;
}

Energy.prototype.SetPoints = function(value)
{
	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	let old = this.energy;
	this.energy = Math.max(0, Math.min(this.GetMaxPoints(), value));

	this.RegisterEnergyChange(old);
}

Energy.prototype.ExecuteRegeneration = function()
{
	let regen = this.GetRegenRate();
	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (!cmpUnitAI)
		return;

	if (cmpUnitAI.IsIdle() || cmpUnitAI.IsGarrisoned() && !cmpUnitAI.IsTurret())
		this.Increase(regen);
}

Energy.prototype.ExecuteRunDegredation = function()
{
	let deg = this.GetRunDegRate();
	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (!cmpUnitAI)
		return;

	if (cmpUnitAI.IsRunning()) {
		this.Reduce(deg);
		if (this.HasEnergyToRun())
			return;

		// Stop running
		cmpUnitAI.StopRunning();
		cmpUnitAI.NotifyFormation();
	}

	this.CancelRunningTimer();
}

Energy.prototype.ExecuteChargeDegredation = function()
{
	let deg = this.GetChargeDegRate();
	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (!cmpUnitAI)
		return;

	if (cmpUnitAI.IsCharging()) {
		this.Reduce(deg);
		if (this.HasEnergyToRun())
			return;

		// Stop running
		cmpUnitAI.StopCharging();
		cmpUnitAI.NotifyFormationCharge();
	}

	this.CancelChargeTimer();
}

Energy.prototype.CheckRegenTimer = function()
{
	if (this.GetRegenRate() == 0 || this.GetPoints() == this.GetMaxPoints())
	{
		if (this.energyTimer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.energyTimer);
			this.energyTimer = undefined;
		}
		return;
	}

	if (this.energyTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.energyTimer = cmpTimer.SetInterval(this.entity, IID_Energy, "ExecuteRegeneration", 1000, 1000, null);
}

Energy.prototype.StartRunTimer = function()
{
	if (this.GetRunDegRate() == 0 || !this.HasEnergyToStartRun())
	{
		if (this.runTimer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.runTimer);
			this.runTimer = undefined;
		}
		return;
	}

	if (this.runTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.runTimer = cmpTimer.SetInterval(this.entity, IID_Energy, "ExecuteRunDegredation", 1000, 1000, null);

	if (this.energyTimer)
		this.CancelRegenerationTimer();
	if (this.chargeTimer)
		this.CancelChargeTimer();
}

Energy.prototype.StartChargeTimer = function()
{
	if (this.GetRunDegRate() == 0 || !this.HasEnergyToStartRun())
	{
		if (this.chargeTimer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.chargeTimer);
			this.chargeTimer = undefined;
		}
		return;
	}

	if (this.chargeTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.chargeTimer = cmpTimer.SetInterval(this.entity, IID_Energy, "ExecuteChargeDegredation", 1000, 1000, null);

	if (this.energyTimer)
		this.CancelRegenerationTimer();
	if (this.runTimer)
		this.CancelRunningTimer();
}

Energy.prototype.Reduce = function(amount)
{
	if (amount < 0 || amount == 0){
		warn("Tried to reduce energy by negative or zero value: " + amount);
		return;
	}

	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	let old = this.energy;
	this.energy = Math.max(0, this.energy - amount);
	this.RegisterEnergyChange(old);
}

Energy.prototype.Increase = function(amount)
{
	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	if (this.energy == this.GetMaxPoints())
		return {"old": this.energy, "new":this.energy};

	let old = this.energy;
	this.energy = Math.min(this.energy + amount, this.GetMaxPoints());

	this.RegisterEnergyChange(old);

	return {"old": old, "new": this.energy};
}

Energy.prototype.OnValueModification = function(msg)
{
	if(msg.component != "Energy")
		return;

	let oldMaxPoints = this.GetMaxPoints();
	let newMaxPoints = ApplyValueModificationsToEntity("Energy/MaxPoints", +this.template.MaxPoints, this.entity);
	if (oldMaxPoints != newMaxPoints)
	{
		let newPoints = this.GetPoints() * newMaxPoints/oldMaxPoints;
		this.maxPoints = newMaxPoints;
		this.SetPoints(newPoints);
	}

	let oldRegenRate = this.regenRate;
	this.regenRate = ApplyValueModificationsToEntity("Energy/RegenRate", +this.template.RegenRate, this.entity);

	let oldDegRate = this.runDegRate;
	this.runDegRate = ApplyValueModificationsToEntity("Energy/RunDegRate", +this.template.RunDegRate, this.entity);

	if (this.regenRate != oldRegenRate)
		this.CheckRegenTimer();
}

Energy.prototype.UpdateActor = function()
{
	// TODO
}

Energy.prototype.RegisterEnergyChange = function(from)
{
	this.CheckRegenTimer();
	this.UpdateActor();
	Engine.PostMessage(this.entity, MT_EnergyChanged, { "from": from, "to": this.energy });
}

Engine.RegisterComponentType(IID_Energy, "Energy", Energy);
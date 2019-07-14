function Payed () {}

Payed.prototype.Schema = 
	"<element name = 'Interval'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>" +
	"<element name = 'Code'>" +
		"<text/>" +
	"</element>" +
	"<element name = 'Sum'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>";


Payed.prototype.Init = function()
{
	this.disabled = false;
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	let tt = +this.template.Interval;
	this.timer = cmpTimer.SetInterval(this.entity, IID_Payed, "Pay", tt, tt, null);
}

Payed.prototype.Disable = function()
{
	this.disabled = true;
}

Payed.prototype.StopTimer = function()
{
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.timer);
	this.timer = undefined;
}

Payed.prototype.Pay = function()
{
	if (this.disabled) {
		this.StopTimer();
		return;
	}
	let cmpPlayer = QueryOwnerInterface(this.entity) || Engine.QueryInterface(this.entity, IID_Player);
	if (!cmpPlayer || cmpPlayer.GetPlayerID() == 0) {
		this.StopTimer();
		return;
	}
	
	if (!cmpPlayer.UseResource(this.template.Code, +this.template.Sum)) {
		// TODO: add loyality component
		// For now leave player immidialty
		// Go  to gaia and rebel 
		// - that would be funny if one cannot pay 50 mercenaries (lol)
		let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
		if (cmpOwnership)
			cmpOwnership.SetOwner(0);
		else
			error("unit cannot rebel - does not have ownership");
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		if (cmpUnitAI)
			cmpUnitAI.SetStance("violent");
		
		this.StopTimer();
	}
}

Payed.prototype.GetInterval = function()
{
	return +this.template.Interval;
}

Payed.prototype.GetCode = function()
{
	return this.template.Code;
}

Payed.prototype.GetCost = function()
{
	return +this.template.Sum;
}

Engine.RegisterComponentType(IID_Payed, "Payed", Payed);

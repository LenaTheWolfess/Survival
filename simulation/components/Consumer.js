function Consumer() {}

Consumer.prototype.ConsumeSchema = 
	"<zeroOrMore>" +
		"<element>" +
		"<anyName/>" +
			"<interleave>" +
				"<element name = 'Code'>" +
					"<text/>" +
				"</element>" +
				"<element name = 'Count'>" +
					"<data type='nonNegativeInteger'/>" +
				"</element>" +
			"</interleave>" +
		"</element> " +
	"</zeroOrMore>";

Consumer.prototype.PunishSchema = 
	"<element name = 'Punish'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>";
	
Consumer.prototype.FeedSchema = 
	"<optional>" +
		"<element name = 'Feed'>" +
			"<interleave>" +
				"<element name = 'Res'>" +
					"<text/>" +
				"</element>" +
				"<element name = 'Count'>" +
					"<data type='nonNegativeInteger'/>" +
				"</element>" +
				"<element name = 'Max'>" +
					"<data type='nonNegativeInteger'/>" +
				"</element>" +
			"</interleave>" +
		"</element>" +
	"</optional>";
	
Consumer.prototype.Schema = 
	"<element name = 'Time'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>" +
	"<element name ='Groups'>" +
		"<zeroOrMore>" +
			"<element>" +
				"<anyName/>" +
				"<interleave>" +
					"<optional>" +
						"<element name = 'Or'>" +
							Consumer.prototype.ConsumeSchema +
						"</element>" +
					"</optional>" +
					"<optional>" +
						"<element name = 'And'>" +
							Consumer.prototype.ConsumeSchema +
						"</element>" +
					"</optional>" +
					Consumer.prototype.PunishSchema +
					Consumer.prototype.FeedSchema +
				"</interleave>" +
			"</element>" +
		"</zeroOrMore>" +
	"</element>";

Consumer.prototype.Init = function()
{
	this.PreCompute();
	
	this.disabled = false;
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	let tt = +this.template.Time;
	this.timer = cmpTimer.SetInterval(this.entity, IID_Consumer, "Consume", tt, tt, null);
	this.fed = 0;
	this.isFed = false;
}

Consumer.prototype.Disable = function()
{
	this.disabled  = true;
}

Consumer.prototype.PreCompute = function()
{
	this.rates = {};
	this.canBeFed = false;
	this.fedRes = undefined;
	
	for (let g in this.template.Groups) {
		let group = this.template.Groups[g];
		if (!!group.Or) {
			let needs = group.Or;
			for (let n in needs) {
				let need = needs[n];
				this.rates[need.Code] = +need.Count;
			}	
		}
		if (!!group.And) {
			let needs = group.And
			for (let n in needs) {
				let need = needs[n];
				this.rates[need.Code] = +need.Count;
			}
		}
		if (!!group.Feed) {
			this.canBeFed = +group.Feed.Max;
			this.fedRes = group.Feed.Res;
		}
	}
}

Consumer.prototype.StopTimer = function()
{
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.timer);
	this.timer = undefined;
}

Consumer.prototype.Consume = function()
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
	
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	
	for (let g in this.template.Groups) {
		let group = this.template.Groups[g];
		// Consume one from Or
		if (!!group.Or) {
			let needs = group.Or;
			let ate = false;
			for (let n in needs) {
				let need = needs[n];
				if (cmpPlayer.UseResource(need.Code, +need.Count)) {
					ate = true;
					break;
				}
			}
			if (!ate && cmpHealth) {
				let status = cmpHealth.Reduce(+group.Punish);
				if (status.killed)
					this.StopTimer();
				return;
			}
		}
		// Consume all from And
		if (!!group.And) {
			let needs = group.And;
			let ate = true;
			for (let n in needs) {
				let need = needs[n];
				if (!cmpPlayer.UseResource(need.Code, +need.Count)) {
					ate = false;
					break;
				}
			}
			if (!ate && cmpHealth) {
				let status = cmpHealth.Reduce(+group.Punish);
				if (status.killed)
					this.StopTimer();
				return;
			}
		}
		let wasHurt = false;
		if (cmpHealth) {
			if (cmpHealth.IsHurt()) {
				wasHurt = true;
				cmpHealth.Increase(+group.Punish);
			}
		}
		// Check if we can feed it up
		if (!wasHurt && !!group.Feed && group.Feed.Count && !this.isFed) {
			let cmpResourceSupply = Engine.QueryInterface(this.entity, IID_ResourceSupply);
			if (!cmpResourceSupply) {
				this.fed = group.Feed.Max + 1;
				this.isFed = true;
				Engine.PostMessage(this.entity, MT_FedChanged, { "from": false, "to": this.isFed });
				return;
			}
			cmpResourceSupply.AddToMax(+group.Feed.Count);
			this.fed += +group.Feed.Count;
			this.isFed = +group.Feed.Max < this.fed + 1;
			if (this.isFed)
				Engine.PostMessage(this.entity, MT_FedChanged, { "from": false, "to": this.isFed });
		}
	}
}

Consumer.prototype.IsFed = function()
{
	return this.isFed;
}

Consumer.prototype.GetFedRes = function()
{
	return this.fedRes;
}

Consumer.prototype.GetTimer = function()
{
	return +this.template.Time;
}

Consumer.prototype.GetRates = function()
{
	return this.rates;
}

Consumer.prototype.GetCanBeFed = function()
{
	return this.canBeFed;
}

Engine.RegisterComponentType(IID_Consumer, "Consumer", Consumer);

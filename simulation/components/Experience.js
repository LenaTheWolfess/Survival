function Experience() {}

Experience.prototype.Schema =
	"<element name='MaxLevel'>"+
		"<data type='positiveInteger'/>" +
	"</element>"+
	"<element name='RequiredXp'>" +
		"<data type='positiveInteger'/>" +
	"</element>";

Experience.prototype.Init = function()
{
	this.currentXp = 0;
	this.level = 0;
	this.subLevel = 1;
	this.maxSubLevel = 3;
	this.modificationCache = new Map();
	this.modifications = new Map();
};

Experience.prototype.GetRequiredXp = function()
{
	return ApplyValueModificationsToEntity("Experience/RequiredXp", +this.template.RequiredXp, this.entity);
};

Experience.prototype.GetCurrentXp = function()
{
	return this.currentXp;
};

Experience.prototype.GetRank = function()
{
	switch (this.level)
	{
		case 1: return "Basic";
		case 2: return "Advanced";
		case 3: return "Elite";
		default: return "";
	}
}

Experience.prototype.GetRankExt = function()
{
	if ( this.level == 0 ) {
		switch (this.subLevel)
		{
			case 1: return "bronze_1";
			case 2: return "bronze_2";
			case 3: return "bronze_3";
			default: return "";
		}
	}
	else if ( this.level == 1 ) {
		switch (this.subLevel)
		{
			case 1: return "iron_1";
			case 2: return "iron_2";
			case 3: return "iron_3";
			default: return "";
		}
	}
	else if ( this.level == 2 ) {
		switch (this.subLevel)
		{
			case 1: return "silver_1";
			case 2: return "silver_2";
			case 3: return "silver_3";
			default: return "";
		}
	}
	else if ( this.level == 3 ) {
		switch (this.subLevel)
		{
			case 1: return "gold_1";
			case 2: return "gold_2";
			case 3: return "gold_3";
			default: return "";
		}
	}
	else {
		return "";
	}
}

Experience.prototype.IsMaxLeveled = function()
{
	return this.level == +this.template.MaxLevel && this.subLevel == this.maxSubLevel;
};

Experience.prototype.Advance = function()
{
	if(this.IsMaxLeveled())
		return;

	// If the unit is dead, don't advance
	let cmpCurrentUnitHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (cmpCurrentUnitHealth.GetHitpoints() == 0)
		return;

	if (this.subLevel < this.maxSubLevel + 1)
		this.subLevel++;

	if (this.subLevel > this.maxSubLevel && this.level < +this.template.MaxLevel) {
		this.level++;
		this.subLevel = 1;
	}

	this.LevelUp(this.level, this.subLevel);
	this.RegisterXpChanged();
};

Experience.prototype.LevelUp = function(level, subLevel)
{
	let modifiedComponents = {};
	let tech = "bonus_" + level + "_" + subLevel;
	tech = "bonus_0_1";
	let template = ExperienceBonusTemplates.Get(tech);
	if (template.modifications)
	{
		let derivedModifiers = DeriveModificationsFromTech(template);
		for (let modifierPath in derivedModifiers)
		{
			if (!this.modifications[modifierPath])
				this.modifications[modifierPath] = [];
			this.modifications[modifierPath] = this.modifications[modifierPath].concat(derivedModifiers[modifierPath]);

			let component = modifierPath.split("/")[0];
			if (!modifiedComponents[component])
				modifiedComponents[component] = [];
			modifiedComponents[component].push(modifierPath);
			this.modificationCache[modifierPath] = {};
		}
	}
	for (let component in modifiedComponents)
	{
		Engine.BroadcastMessage(MT_ValueModification, { "entities": [this.entity], "component": component, "valueNames": modifiedComponents[component]});
	}
};

Experience.prototype.ApplyModifications = function(valueName, curValue, ent)
{
	if (!ent)
		return curValue;

	if (!this.modifications[valueName])
		return curValue;

	if (!this.modificationCache[valueName])
		this.modificationCache[valueName] = {};

	if (!this.modificationCache[valueName][ent] || this.modificationCache[valueName][ent].origValue != curValue)
	{
		let cmpIdentity = Engine.QueryInterface(ent, IID_Identity);
		if (!cmpIdentity)
			return curValue;

		this.modificationCache[valueName][ent] = {
			"origValue": curValue,
			"newValue": GetTechModifiedProperty(this.modifications, cmpIdentity.GetClassesList(), valueName, curValue)
		};
	}

	return this.modificationCache[valueName][ent].newValue;
};

Experience.prototype.IncreaseXp = function(amount)
{
	if (this.IsMaxLeveled())
		return;

	this.currentXp += +(amount);
	let requiredXp = this.GetRequiredXp();

	while (this.currentXp >= requiredXp)
	{
		this.currentXp -= requiredXp;
		this.Advance();
	}
};

Experience.prototype.OnValueModification = function(msg)
{
	if (msg.component == "Experience")
		this.IncreaseXp(0);
};

Experience.prototype.RegisterXpChanged = function()
{
	Engine.PostMessage(this.entity, MT_XpChanged, {});
};

Engine.RegisterComponentType(IID_Experience, "Experience", Experience);

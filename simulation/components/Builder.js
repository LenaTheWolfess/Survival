function Builder() {}

Builder.prototype.Schema =
	"<element name='Rate' a:help='Construction speed multiplier (1.0 is normal speed, higher values are faster).'>" +
		"<ref name='positiveDecimal'/>" +
	"</element>" +
	"<element name ='Groups'>" +
		"<zeroOrMore>" +
			"<element>" +
				"<anyName/>" +
				"<interleave>" +
					"<element name='GenericName'>" +
						"<text/>" +
					"</element>" +
					"<element name='Icon'>" +
						"<text/>" +
					"</element>" +
					"<element name='Tooltip'>" +
						"<text/>" +
					"</element>" +
					"<element name='Entities' a:help='Space-separated list of entity template names that this unit can build. The special string \"{civ}\" will be automatically replaced by the civ code of the unit&apos;s owner, while the string \"{native}\" will be automatically replaced by the unit&apos;s civ code. This element can also be empty, in which case no new foundations may be placed by the unit, but they can still repair existing buildings.'>" +
						"<attribute name='datatype'>" +
							"<value>tokens</value>" +
						"</attribute>" +
						"<text/>" +
					"</element>" +
				"</interleave>" +
			"</element>" +
		"</zeroOrMore>" +
	"</element>";

Builder.prototype.Init = function()
{
};

Builder.prototype.Serialize = null; // we have no dynamic state to save

Builder.prototype.GetGroups = function()
{
	let groups = [];
	
	for (let g in this.template.Groups) {
		let group = this.template.Groups[g];
		let ret = {
				"id": g,
				"Name": group.GenericName,
				"Icon": group.Icon,
				"Tooltip": group.Tooltip
		};
		groups.push(ret);
	}
	
	return groups;
}

Builder.prototype.GetEntitiesList = function(group)
{
	if (!this.template.Groups || !this.template.Groups[group])
		return [];
	
	let string = this.template.Groups[group].Entities._string;
	if (!string)
		return [];

	let cmpPlayer = QueryOwnerInterface(this.entity);
	if (!cmpPlayer)
		return [];

	let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);
	if (cmpIdentity)
		string = string.replace(/\{native\}/g, cmpIdentity.GetCiv());

	let entities = string.replace(/\{civ\}/g, cmpPlayer.GetCiv()).split(/\s+/);

	let disabledTemplates = cmpPlayer.GetDisabledTemplates();

	let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);

	return entities.filter(ent => !disabledTemplates[ent] && cmpTemplateManager.TemplateExists(ent));
};

Builder.prototype.GetRange = function()
{
	let max = 2;
	let cmpObstruction = Engine.QueryInterface(this.entity, IID_Obstruction);
	if (cmpObstruction)
		max += cmpObstruction.GetUnitRadius();

	return { "max": max, "min": 0 };
};

Builder.prototype.GetRate = function()
{
	return ApplyValueModificationsToEntity("Builder/Rate", +this.template.Rate, this.entity);
};

/**
 * Build/repair the target entity. This should only be called after a successful range check.
 * It should be called at a rate of once per second.
 */
Builder.prototype.PerformBuilding = function(target)
{
	let rate = this.GetRate();

	let cmpFoundation = Engine.QueryInterface(target, IID_Foundation);
	if (cmpFoundation)
	{
		cmpFoundation.Build(this.entity, rate);
		return;
	}

	let cmpRepairable = Engine.QueryInterface(target, IID_Repairable);
	if (cmpRepairable)
	{
		cmpRepairable.Repair(this.entity, rate);
		return;
	}
};

Engine.RegisterComponentType(IID_Builder, "Builder", Builder);

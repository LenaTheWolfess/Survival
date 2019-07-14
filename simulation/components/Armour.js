function Armour() {}

Armour.prototype.Schema =
	"<a:help>Controls the damage resistance of the unit.</a:help>" +
	"<a:example>" +
		"<Hack>10.0</Hack>" +
		"<Pierce>0.0</Pierce>" +
		"<Crush>5.0</Crush>" +
	"</a:example>" +
	DamageTypes.BuildSchema("damage protection") +
	"<optional>" +
		"<element name='Foundation' a:help='Armour given to building foundations'>" +
			"<interleave>" +
				DamageTypes.BuildSchema("damage protection") +
			"</interleave>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Shield'>"+
			"<interleave>"+
			DamageTypes.BuildSchema("damage protection") +
			"</interleave>"+
		"</element>" +
	"</optional>"
	;

Armour.prototype.Init = function()
{
	this.invulnerable = false;
};

Armour.prototype.IsInvulnerable = function()
{
	return this.invulnerable;
};

Armour.prototype.SetInvulnerability = function(invulnerability)
{
	this.invulnerable = invulnerability;
	Engine.PostMessage(this.entity, MT_InvulnerabilityChanged, { "entity": this.entity, "invulnerability": invulnerability });
};

/**
 * Take damage according to the entity's armor.
 * @param {Object} strengths - { "hack": number, "pierce": number, "crush": number } or something like that.
 * @param {number} multiplier - the damage multiplier.
 * @param {number} flank - 1 - full flank, 0.5 - half flank, 0 - no flank
 * Returns object of the form { "killed": false, "change": -12 }.
 */
Armour.prototype.TakeDamage = function(strengths, multiplier = 1, flank = 0, fire = 0, charge = 0, mount = 0, crit = 0)
{
	if (this.invulnerable)
		return { "killed": false, "change": 0 };


	let applyShield = 1;
	if (flank == 1 && this.template.Shield)
		applyShield = 0;

	let cmpEnergy = Engine.QueryInterface(this.entity, IID_Energy);
	if (cmpEnergy && cmpEnergy.GetPercentage() < 0.2)
		applyShield = 0;

	// Adjust damage values based on armour; exponential armour: damage = attack * 0.9^armour
	let armourStrengths = this.GetArmourStrengths(applyShield);

	// Total is sum of individual damages
	// Don't bother rounding, since HP is no longer integral.
	let total = fire + mount + crit;
	let chargePenalty = 1;
	if (charge) {
		chargePenalty = 0.5;
	}
	/*
	if (mount) {
	//	warn("mount: " + mount);
	}
*/
	for (let type in strengths) {
		total += strengths[type] * multiplier * Math.pow(0.9, armourStrengths[type] * chargePenalty || 0);
	}

	// Reduce health
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (!cmpHealth)
		return 0;
	let reduced = cmpHealth.Reduce(total);
	return reduced;
};

/**
* Get Armour strenghts
* @param {number} applyShield - protection from the shield 1 yes, 0 no
*/
Armour.prototype.GetShieldStrengths = function(applyShield = 1)
{
	if (!this.template.Shield)
		return 0;
	// Work out the armour values with technology effects
	var applyMods = (type) => {
		var strength;

		strength = +this.template.Shield[type];
		let resS = ApplyValueModificationsToEntity("Armour/Shield/" + type, strength, this.entity);

		return resS;
	};

	let ret = {};
	for (let damageType of DamageTypes.GetTypes())
		ret[damageType] = applyMods(damageType);

	return ret;
};

/**
* Get Armour strenghts
* @param {number} applyShield - protection from the shield 1 yes, 0 no
*/
Armour.prototype.GetArmourStrengths = function(applyShield = 1)
{
	// Work out the armour values with technology effects
	var applyMods = (type, foundation, shield) => {
		var strength;
		if (foundation)
		{
			strength = +this.template.Foundation[type];
			type = "Foundation/" + type;
		}
		else
			strength = +this.template[type];

		let res = ApplyValueModificationsToEntity("Armour/" + type, strength, this.entity);

		if (!shield)
			return res;

		strength = +this.template.Shield[type];
		let resS = ApplyValueModificationsToEntity("Armour/Shield/" + type, strength, this.entity);

		return res + resS;
	};

	var foundation = Engine.QueryInterface(this.entity, IID_Foundation) && this.template.Foundation;
	var shield = this.template.Shield && applyShield;

	let ret = {};
	for (let damageType of DamageTypes.GetTypes())
		ret[damageType] = applyMods(damageType, foundation, shield);

	return ret;
};

Engine.RegisterComponentType(IID_DamageReceiver, "Armour", Armour);

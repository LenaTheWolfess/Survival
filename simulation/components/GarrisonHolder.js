function GarrisonHolder() {}

GarrisonHolder.prototype.Schema =
	"<optional>"+
	  "<element name='FormationTake'>"+
	     "<data type='boolean'/>"+
	  "</element>"+
	"</optional>"+
	"<optional>" +
		"<element name='WorkStation'>" +
			"<data type='boolean'/>" +
		"</element>" +
	"</optional>" +
	"<optional>"+
		"<element name='MaxAttackers' a:help='Maximum number of entities which can attack inside this holder'>" +
			"<data type='positiveInteger'/>" +
		"</element>" +
	"</optional>" +
	"<element name='Max' a:help='Maximum number of entities which can be garrisoned inside this holder'>" +
		"<data type='positiveInteger'/>" +
	"</element>" +
	"<optional>" + 
		"<element name='Train'>" +
			"<interleave>"+
			"<element name='Points'>" + 
				"<ref name='nonNegativeDecimal'/>" +
			"</element>" +
			"<element name='TrainList'>" +
				"<attribute name='datatype'>" +
					"<value>tokens</value>" +
				"</attribute>" +
				"<text/>" +
			"</element>" +
		"</interleave>" +
		"</element>"+
	"</optional>" +
	"<element name='List' a:help='Classes of entities which are allowed to garrison inside this holder (from Identity)'>" +
		"<attribute name='datatype'>" +
			"<value>tokens</value>" +
		"</attribute>" +
		"<text/>" +
	"</element>" +
	"<element name='EjectHealth' a:help='Percentage of maximum health below which this holder no longer allows garrisoning'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<element name='EjectClassesOnDestroy' a:help='Classes of entities to be ejected on destroy. Others are killed'>" +
		"<attribute name='datatype'>" +
			"<value>tokens</value>" +
		"</attribute>" +
		"<text/>" +
	"</element>" +
	"<element name='BuffHeal' a:help='Number of hitpoints that will be restored to this holder&apos;s garrisoned units each second'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<element name='LoadingRange' a:help='The maximum distance from this holder at which entities are allowed to garrison. Should be about 2.0 for land entities and preferably greater for ships'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<optional>" +
		"<element name='Pickup' a:help='This garrisonHolder will move to pick up units to be garrisoned'>" +
			"<data type='boolean'/>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='VisibleGarrisonPoints' a:help='Points that will be used to visibly garrison a unit'>" +
			"<zeroOrMore>" +
				"<element a:help='Element containing the offset coordinates'>" +
					"<anyName/>" +
					"<interleave>" +
						"<element name='X'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<element name='Y'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<element name='Z'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<optional>" +
							"<element name='Angle' a:help='Angle in degrees relative to the garrisonHolder direction'>" +
								"<data type='decimal'/>" +
							"</element>" +
						"</optional>" +
					"</interleave>" +
				"</element>" +
			"</zeroOrMore>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='VisibleAttackPoints' a:help='Points that will be used to visibly attacking a unit'>" +
			"<zeroOrMore>" +
				"<element a:help='Element containing the offset coordinates'>" +
					"<anyName/>" +
					"<interleave>" +
						"<element name='X'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<element name='Y'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<element name='Z'>" +
							"<data type='decimal'/>" +
						"</element>" +
						"<optional>" +
							"<element name='Angle' a:help='Angle in degrees relative to the garrisonHolder direction'>" +
								"<data type='decimal'/>" +
							"</element>" +
						"</optional>" +
					"</interleave>" +
				"</element>" +
			"</zeroOrMore>" +
		"</element>" +
	"</optional>";

/**
 * Initialize GarrisonHolder Component
 * Garrisoning when loading a map is set in the script of the map, by setting initGarrison
 * which should contain the array of garrisoned entities.
 */
GarrisonHolder.prototype.Init = function()
{
	// Garrisoned Units
	this.entities = [];
	this.attackerEntities = [];
	this.timer = undefined;
	this.trainTimer = undefined;
	this.allowGarrisoning = new Map();
	this.visibleGarrisonPoints = [];
	this.visibleAttackPoints = [];
	this.formationTake = !!this.template.FormationTake && this.template.FormationTake;
	if (this.template.VisibleGarrisonPoints)
	{
		let points = this.template.VisibleGarrisonPoints;
		for (let point in points)
			this.visibleGarrisonPoints.push({
				"offset": {
					"x": +points[point].X,
					"y": +points[point].Y,
					"z": +points[point].Z
				},
				"angle": points[point].Angle ? +points[point].Angle * Math.PI / 180 : null,
				"entity": null
			});
	}
	if (this.template.VisibleAttackPoints)
	{
		let points = this.template.VisibleAttackPoints;
		for (let point in points)
			this.visibleAttackPoints.push({
				"offset": {
					"x": +points[point].X,
					"y": +points[point].Y,
					"z": +points[point].Z
				},
				"angle": points[point].Angle ? +points[point].Angle * Math.PI / 180 : null,
				"entity": null
			});
	}
};

/**
 * @return {Object} max and min range at which entities can garrison the holder.
 */
GarrisonHolder.prototype.GetLoadingRange = function()
{
	return { "max": +this.template.LoadingRange, "min": 0 };
};

GarrisonHolder.prototype.IsWorkStation = function()
{
	return !!this.template.WorkStation && this.template.WorkStation=="true";
}

GarrisonHolder.prototype.CanPickup = function(ent)
{
	if (!this.template.Pickup || this.IsFull())
		return false;
	let cmpOwner = Engine.QueryInterface(this.entity, IID_Ownership);
	return !!cmpOwner && IsOwnedByPlayer(cmpOwner.GetOwner(), ent);
};

GarrisonHolder.prototype.GetEntities = function()
{
	return this.entities;
};

GarrisonHolder.prototype.GetAttackerEntities = function()
{
	return this.attackerEntities;
};

GarrisonHolder.prototype.RequiresFormationTake = function()
{
	return this.formationTake;
}

/**
 * @return {Array} unit classes which can be garrisoned inside this
 * particular entity. Obtained from the entity's template.
 */
GarrisonHolder.prototype.GetAllowedClasses = function()
{
	return this.template.List._string;
};

GarrisonHolder.prototype.GetTrainableClasses = function()
{
	if (this.template.Train && this.template.Train.TrainList && this.template.Train.TrainList._string)
		return this.template.Train.TrainList._string.split(/\s+/);

	return [];
};

GarrisonHolder.prototype.GetTrainPoints = function()
{
	if (!this.template.Train)
		return 0;
	return +this.template.Train.Points;
};

GarrisonHolder.prototype.GetCapacity = function()
{
	return ApplyValueModificationsToEntity("GarrisonHolder/Max", +this.template.Max, this.entity);
};

GarrisonHolder.prototype.GetAttackerCapacity = function()
{
	if (this.template.MaxAttackers)
		return ApplyValueModificationsToEntity("GarrisonHolder/MaxAttackers", +this.template.MaxAttackers, this.entity);

	return 0;
};

GarrisonHolder.prototype.HasDeffenders = function()
{
	return this.entities.length > 0;
};

GarrisonHolder.prototype.IsFull = function()
{
	return this.GetGarrisonedEntitiesCount() >= this.GetCapacity();
};

GarrisonHolder.prototype.IsAttackerFull = function()
{
	return this.GetAttackerEntitiesCount() >= this.GetAttackerCapacity();
};

GarrisonHolder.prototype.GetHealRate = function()
{
	return ApplyValueModificationsToEntity("GarrisonHolder/BuffHeal", +this.template.BuffHeal, this.entity);
};

GarrisonHolder.prototype.IsAttackedInside = function()
{
	if (!this.attackerEntities.length)
		return false;

	let out = 0;
	for (let vp of this.visibleAttackPoints)
		if (vp.entity)
			out++;
	return this.attackerEntities.length - out > 0;
};

GarrisonHolder.prototype.IsAttacked = function()
{
	return this.attackerEntities.length;
};

GarrisonHolder.prototype.GetAttackPower = function()
{
	return this.attackerEntities.length;
};

GarrisonHolder.prototype.GetMainAttacker = function()
{
	let players = [];
	for ( let ent of this.attackerEntities)
	{
		if (!ent)
			continue;
		let cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		if (!cmpOwnership)
			continue;
		let playerId = cmpOwnership.GetOwner();
		if (!players[playerId])
			players[playerId] = 0;
		players[playerId] = players[playerId] + 1;
	}

	for (let vp of this.visibleAttackPoints)
	{
		if (!vp.entity)
			continue;
		let ent = vp.entity;
		let cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		if (!cmpOwnership)
			continue;
		let playerId = cmpOwnership.GetOwner();
		if (!players[playerId])
			players[playerId] = 0;
		players[playerId] = players[playerId] -1;
	}

	let bestPlayer = INVALID_PLAYER;
	for (let i in players) {
		if (bestPlayer == INVALID_PLAYER)
			bestPlayer = +i;
		if (players[i] >= players[bestPlayer])
			bestPlayer = +i;
	}

	return bestPlayer;
};

/**
 * Set this entity to allow or disallow garrisoning in the entity.
 * Every component calling this function should do it with its own ID, and as long as one
 * component doesn't allow this entity to garrison, it can't be garrisoned
 * When this entity already contains garrisoned soldiers,
 * these will not be able to ungarrison until the flag is set to true again.
 *
 * This more useful for modern-day features. For example you can't garrison or ungarrison
 * a driving vehicle or plane.
 * @param {boolean} allow - Whether the entity should be garrisonable.
 */
GarrisonHolder.prototype.AllowGarrisoning = function(allow, callerID)
{
	this.allowGarrisoning.set(callerID, allow);
};

GarrisonHolder.prototype.IsGarrisoningAllowed = function()
{
	return Array.from(this.allowGarrisoning.values()).every(allow => allow);
};

GarrisonHolder.prototype.GetGarrisonedEntitiesCount = function()
{
	let count = this.entities.length;
	for (let ent of this.entities)
	{
		let cmpGarrisonHolder = Engine.QueryInterface(ent, IID_GarrisonHolder);
		if (cmpGarrisonHolder)
			count += cmpGarrisonHolder.GetGarrisonedEntitiesCount();
	}
	return count;
};

GarrisonHolder.prototype.GetAttackerEntitiesCount = function()
{
	let count = this.attackerEntities.length;
	for (let ent of this.attackerEntities)
	{
		let cmpGarrisonHolder = Engine.QueryInterface(ent, IID_GarrisonHolder);
		if (cmpGarrisonHolder)
			count += cmpGarrisonHolder.GetAttackerEntitiesCount();
	}
	return count;
};

GarrisonHolder.prototype.IsAllowedToAttack = function(ent)
{
	if (!this.IsGarrisoningAllowed())
		return false;

	if (IsOwnedByMutualAllyOfEntity(ent, this.entity))
		return false;

	let cmpIdentity = Engine.QueryInterface(ent, IID_Identity);
	if (!cmpIdentity)
		return false;

	let entityClasses = cmpIdentity.GetClassesList();
	return MatchesClassList(entityClasses, this.template.List._string) && !!Engine.QueryInterface(ent, IID_Garrisonable);
};

GarrisonHolder.prototype.IsAllowedToGarrison = function(ent)
{
	if (!this.IsGarrisoningAllowed())
		return false;

	if (!IsOwnedByMutualAllyOfEntity(ent, this.entity))
		return false;

	let cmpIdentity = Engine.QueryInterface(ent, IID_Identity);
	if (!cmpIdentity)
		return false;

	let entityClasses = cmpIdentity.GetClassesList();
	return MatchesClassList(entityClasses, this.template.List._string) && !!Engine.QueryInterface(ent, IID_Garrisonable);
};

GarrisonHolder.prototype.GarisonAttacker = function(entity)
{
	let cmpPosition = Engine.QueryInterface(entity, IID_Position);
	if (!cmpPosition)
		return false;

	if (!this.PerformaAttackerGarison(entity))
		return false;

	let visibleAttackPoint;
	for (let vgp of this.visibleAttackPoints)
	{
		if (vgp.entity)
			continue;
		visibleAttackPoint = vgp;
		break;
	}

	if (visibleAttackPoint)
	{
		visibleAttackPoint.entity = entity;
		let cmpTurretPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (visibleAttackPoint.angle != null)
			cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + visibleAttackPoint.angle);
		else if (!cmpPosition.IsInWorld())
			cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + Math.PI);
		let cmpUnitMotion = Engine.QueryInterface(entity, IID_UnitMotion);
		if (cmpUnitMotion)
			cmpUnitMotion.SetFacePointAfterMove(false);
		let pos = cmpTurretPosition.GetPosition();
		cmpPosition.SetTurretParent(this.entity, visibleAttackPoint.offset);
//		cmpPosition.SetTurretParent(this.entity, [0.0, visibleAttackPoint.offset.y, 0.0]);
		let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpUnitAI)
			cmpUnitAI.SetTurretStance();
//		cmpPosition.SetHeightFixed(pos.y + visibleAttackPoint.offset.y);
//		cmpPosition.JumpTo(pos.x + visibleAttackPoint.offset.x, pos.z + visibleAttackPoint.offset.z);
		let cmpObstruction = Engine.QueryInterface(entity, IID_Obstruction);
		if(cmpObstruction)
			cmpObstruction.SetActive(false);

		for (let visibleDeffender of this.visibleGarrisonPoints)
		{
			if (visibleDeffender.entity)
				Engine.PostMessage(visibleDeffender.entity, MT_GarrisonedUnitsChanged, { "added": [entity], "removed": [] });
		}
	}
	else
		cmpPosition.MoveOutOfWorld();

	return true;
};

GarrisonHolder.prototype.AttackAnotherHolder = function(hodlerTarget)
{
	let cmpTarget = Engine.QueryInterface(hodlerTarget, IID_GarrisonHolder);
	if (!cmpTarget)
		return false;

	let max = cmpTarget.GetAttackerCapacity();
	let taken = cmpTarget.GetAttackerEntities().length;

	let free = max - taken;

	let remove = [];

	let garrisoned = 0;

	for ( let ent of this.entities)
	{
		if(!cmpTarget.GarisonAttacker(ent))
			continue;
		--free;
		remove.push(ent);
		++garrisoned;
		if (!free)
			break;
	}

	for (let ent of remove)
	{
		let index = this.entities.indexOf(ent);
		if (index == -1) {
			warn("GarrisonHolder.AttackAnotherHolder tries to remove not owned entity");
			continue;
		}
		this.entities.splice(index, 1);
		for (let vgp of this.visibleGarrisonPoints) {
			if (vgp.entity != ent)
				continue;
			vgp.entity = null;
		}
	}

	return garrisoned > 0;
};

GarrisonHolder.prototype.PerformaAttackerGarison = function(entity)
{
	if (!this.HasEnoughHealth())
		return false;

	if (!this.IsAllowedToAttack(entity))
		return false;

	// Check capacity
	if (this.GetAttackerEntitiesCount() >= this.GetAttackerCapacity())
		return false;

	// Actual attack garison happens here
	this.attackerEntities.push(entity);
	let cmpProductionQueue = Engine.QueryInterface(entity, IID_ProductionQueue);
	if (cmpProductionQueue)
		cmpProductionQueue.PauseProduction();
	
	let cmpAura = Engine.QueryInterface(entity, IID_Auras);
	if (cmpAura && cmpAura.HasGarrisonAura())
		cmpAura.ApplyGarrisonBonus(this.entity);

	let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
	if (cmpUnitAI) {
		let formationEnt = cmpUnitAI.GetFormationController();
		if (formationEnt) {
			let formationAI = Engine.QueryInterface(formationEnt, IID_UnitAI);
			if (formationAI) {
				formationAI.AddGarrisonedMember(this.entity);
			}
		}
	}
	Engine.PostMessage(this.entity, MT_GarrisonedUnitsChanged, { "added": [entity], "removed": [] });
	return true;
};

/**
 * Garrison a unit inside. The timer for AutoHeal is started here.
 * @param {number} vgpEntity - The visual garrison point that will be used.
 * If vgpEntity is given, this visualGarrisonPoint will be used for the entity.
 * @return {boolean} Whether the entity was garrisonned.
 */
GarrisonHolder.prototype.Garrison = function(entity, vgpEntity)
{
	let cmpPosition = Engine.QueryInterface(entity, IID_Position);
	if (!cmpPosition)
		return false;

	if (this.RequiresFormationTake() && this.IsAllowedToGarrison(entity)) {
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		let cmpEntAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpEntAI && cmpEntAI.IsFormationMember() && cmpUnitAI && !cmpUnitAI.IsFormationMember()) {
			let formationContr = cmpEntAI.GetFormationController();
			if (formationContr) {
				let cmpFormation = Engine.QueryInterface(formationContr, IID_Formation);
				if(!cmpFormation.AddSiege(this.entity)) {
					return false;
				}
				formationContr = cmpUnitAI.GetFormationController();
				cmpFormation = Engine.QueryInterface(formationContr, IID_Formation);
				for (let fm of cmpFormation.GetMembers()) {
					if (fm == this.entity) {
						continue;
					}
					let cmpFmAI = Engine.QueryInterface(fm, IID_UnitAI);
					this.entities.push(fm);
					if (!cmpFmAI) {
						continue;
					}
					cmpFmAI.SetGarrisoned();
					cmpFmAI.FinishOrder();
					cmpFmAI.SetNextState("IDLE");
				}
				cmpFormation.MoveMembersIntoFormation(false, true);
				return true;
			}
		}
		return false;
	}
	
	if (!this.PerformGarrison(entity))
		return false;

	let visibleGarrisonPoint = vgpEntity;
	if (!visibleGarrisonPoint)
		for (let vgp of this.visibleGarrisonPoints)
		{
			if (vgp.entity)
				continue;
			visibleGarrisonPoint = vgp;
			break;
		}

	if (visibleGarrisonPoint)
	{
		visibleGarrisonPoint.entity = entity;
		// Angle of turrets:
		// Renamed entities (vgpEntity != undefined) should keep their angle.
		// Otherwise if an angle is given in the visibleGarrisonPoint, use it.
		// If no such angle given (usually walls for which outside/inside not well defined), we keep
		// the current angle as it was used for garrisoning and thus quite often was from inside to
		// outside, except when garrisoning from outWorld where we take as default PI.
		let cmpTurretPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (!vgpEntity && visibleGarrisonPoint.angle != null)
			cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + visibleGarrisonPoint.angle);
		else if (!vgpEntity && !cmpPosition.IsInWorld())
			cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + Math.PI);
		let cmpUnitMotion = Engine.QueryInterface(entity, IID_UnitMotion);
		if (cmpUnitMotion)
			cmpUnitMotion.SetFacePointAfterMove(false);
		let pos = cmpTurretPosition.GetPosition();
		cmpPosition.SetTurretParent(this.entity, visibleGarrisonPoint.offset);
//		cmpPosition.SetTurretParent(this.entity, [0.0, visibleGarrisonPoint.offset.y, 0.0]);
		let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpUnitAI)
			cmpUnitAI.SetTurretStance();
//		cmpPosition.SetHeightFixed(pos.y + visibleGarrisonPoint.offset.y);
//		cmpPosition.JumpTo(pos.x + visibleGarrisonPoint.offset.x, pos.z + visibleGarrisonPoint.offset.z);
		let cmpObstruction = Engine.QueryInterface(entity, IID_Obstruction);
		if(cmpObstruction)
			cmpObstruction.SetActive(false);

		for (let visibleAttacker of this.visibleAttackPoints)
		{
			if (visibleAttacker.entity)
				Engine.PostMessage(visibleAttacker.entity, MT_GarrisonedUnitsChanged, { "added": [entity], "removed": [] });
		}

	}
	else
		cmpPosition.MoveOutOfWorld();

	return true;
};

/**
 * @return {boolean} Whether the entity was garrisonned.
 */
GarrisonHolder.prototype.PerformGarrison = function(entity)
{
	if (!this.HasEnoughHealth())
		return false;

	// Check if the unit is allowed to be garrisoned inside the building
	if (!this.IsAllowedToGarrison(entity))
		return false;

	// Check the capacity
	let extraCount = 0;
	let cmpGarrisonHolder = Engine.QueryInterface(entity, IID_GarrisonHolder);
	if (cmpGarrisonHolder)
		extraCount += cmpGarrisonHolder.GetGarrisonedEntitiesCount();
	if (this.GetGarrisonedEntitiesCount() + extraCount >= this.GetCapacity())
		return false;

	if (!this.timer && this.GetHealRate() > 0)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		this.timer = cmpTimer.SetTimeout(this.entity, IID_GarrisonHolder, "HealTimeout", 1000, {});
	}

	if (!this.trainTimer && !!this.template.Train)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		this.trainTimer = cmpTimer.SetTimeout(this.entity, IID_GarrisonHolder, "TrainTimeout", 1000, {});
	}

	// Actual garrisoning happens here
	this.entities.push(entity);
	this.UpdateGarrisonFlag();
	let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
	if (cmpUnitAI) {
		let formationEnt = cmpUnitAI.GetFormationController();
		if (formationEnt) {
			let formationAI = Engine.QueryInterface(formationEnt, IID_UnitAI);
			if (formationAI) {
				formationAI.AddGarrisonedMember(this.entity);
			}
		}
	}
	let cmpProductionQueue = Engine.QueryInterface(entity, IID_ProductionQueue);
	if (cmpProductionQueue)
		cmpProductionQueue.PauseProduction();

	let cmpAura = Engine.QueryInterface(entity, IID_Auras);
	if (cmpAura && cmpAura.HasGarrisonAura())
		cmpAura.ApplyGarrisonBonus(this.entity);

	Engine.PostMessage(this.entity, MT_GarrisonedUnitsChanged, { "added": [entity], "removed": [] });
	return true;
};

/**
 * Simply eject the unit from the garrisoning entity without moving it
 * @param {number} entity - Id of the entity to be ejected.
 * @param {boolean} forced - Whether eject is forced (i.e. if building is destroyed).
 * @return {boolean} Whether the entity was ejected.
 */
GarrisonHolder.prototype.Eject = function(entity, forced)
{
	if (this.RequiresFormationTake() && this.IsAllowedToGarrison(entity)) {
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		let cmpEntAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpEntAI && cmpEntAI.IsFormationMember() && cmpUnitAI && cmpUnitAI.IsFormationMember()) {
			
			if (cmpEntAI.GetFormationController() == cmpUnitAI.GetFormationController())
				this.entities.splice(this.entities.indexOf(entity), 1);
			cmpEntAI.Ungarrison();
			cmpEntAI.ResetTurretStance();
			cmpEntAI.ResetSiegeCrew();
			let formationContr = cmpEntAI.GetFormationController();
			if (formationContr && !this.entities.length) {
				let cmpFormation = Engine.QueryInterface(formationContr, IID_Formation);
				cmpFormation.RemoveMembers([this.entity]);
				cmpUnitAI.Stop();
			}
			return true;
		}
	}
	
	let entityIndex = this.entities.indexOf(entity);
	let attacker = false;
	// Error: invalid entity ID, usually it's already been ejected
	if (entityIndex == -1) {
		// Check attackers
		entityIndex = this.attackerEntities.indexOf(entity);
		if (entityIndex == -1)
			return false;
		attacker = true;
	}

	// Find spawning location
	let cmpFootprint = Engine.QueryInterface(this.entity, IID_Footprint);
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);

	// If the garrisonHolder is a sinking ship, restrict the location to the intersection of both passabilities
	// TODO: should use passability classes to be more generic
	let pos;
	if ((!cmpHealth || cmpHealth.GetHitpoints() == 0) && cmpIdentity && cmpIdentity.HasClass("Ship"))
		pos = cmpFootprint.PickSpawnPointBothPass(entity);
	else
		pos = cmpFootprint.PickSpawnPoint(entity);

	if (pos.y < 0)
	{
		// Error: couldn't find space satisfying the unit's passability criteria
		if (!forced) 
			return false;

		// If ejection is forced, we need to continue, so use center of the building
		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		pos = cmpPosition.GetPosition();
	}

	if (attacker)
		this.attackerEntities.splice(entityIndex, 1);
	else
		this.entities.splice(entityIndex, 1);
	let cmpEntPosition = Engine.QueryInterface(entity, IID_Position);
	let cmpEntUnitAI = Engine.QueryInterface(entity, IID_UnitAI);

	if (attacker)
		var ents = this.visibleAttackPoints;
	else 
		var ents = this.visibleGarrisonPoints;
	for (let vgp of ents)
	{
		if (vgp.entity != entity)
			continue;
		cmpEntPosition.SetTurretParent(INVALID_ENTITY, new Vector3D());
		let cmpEntUnitMotion = Engine.QueryInterface(entity, IID_UnitMotion);
		if (cmpEntUnitMotion)
			cmpEntUnitMotion.SetFacePointAfterMove(true);
		if (cmpEntUnitAI)
			cmpEntUnitAI.ResetTurretStance();
		let cmpObstruction = Engine.QueryInterface(entity, IID_Obstruction);
		if(cmpObstruction)
			cmpObstruction.SetActive(true);
		vgp.entity = null;
		break;
	}

	if (cmpEntUnitAI)
		cmpEntUnitAI.Ungarrison();

	let cmpEntProductionQueue = Engine.QueryInterface(entity, IID_ProductionQueue);
	if (cmpEntProductionQueue)
		cmpEntProductionQueue.UnpauseProduction();

	let cmpEntAura = Engine.QueryInterface(entity, IID_Auras);
	if (cmpEntAura && cmpEntAura.HasGarrisonAura())
		cmpEntAura.RemoveGarrisonBonus(this.entity);

	cmpEntPosition.JumpTo(pos.x, pos.z);
	cmpEntPosition.SetHeightOffset(0);

	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (cmpPosition)
		cmpEntPosition.SetYRotation(cmpPosition.GetPosition().horizAngleTo(pos));

	let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
	if (cmpUnitAI) {
		let formationEnt = cmpUnitAI.GetFormationController();
		if (formationEnt) {
			let formationAI = Engine.QueryInterface(formationEnt, IID_UnitAI);
			if (formationAI) {
				formationAI.RemoveGarrisonedMember(this.entity);
			}
		}
	}
	
	Engine.PostMessage(this.entity, MT_GarrisonedUnitsChanged, { "added": [], "removed": [entity] });

	return true;
};

GarrisonHolder.prototype.PerformInFigth = function()
{
	let cmpCapture = Engine.QueryInterface(this.entity, IID_Capturable);
	if (!cmpCapture)
		return false;

	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	if (!cmpOwnership)
		return false;
	let owner =  cmpOwnership.GetOwner();

	let attackerCP = 0;
	for (let ent of this.attackerEntities)
	{
		let cmpAttack = Engine.QueryInterface(ent, IID_Attack);
		if (cmpAttack) {
			let str = cmpAttack.GetAttackStrengths("Capture");
			if ( str && str.value )
				attackerCP = attackerCP + str.value;
		}
	}
	let deffenderCP = 0;
	for (let ent of this.entities)
	{
		let cmpAttack = Engine.QueryInterface(ent, IID_Attack);
		if (cmpAttack) {
			let str = cmpAttack.GetAttackStrengths("Capture");
			if ( str && str.value )
				deffenderCP = deffenderCP + str.value;
		}
	}

	if (!attackerCP && !deffenderCP)
		return false;

	let result = attackerCP - deffenderCP;

	let cp = cmpCapture.GetCapturePoints();
	let max = cmpCapture.GetMaxCapturePoints();
	if (!result || (result < 0 && cp[owner] == max)) {
		// attackers loose health
		if (cp[owner]/max >= 0.5) {
			let changed = false;
			for (let ent of this.attackerEntities)
			{
				let cmpHealth = Engine.QueryInterface(ent, IID_Health);
				if (!cmpHealth)
					continue;
				let take = cmpHealth.GetMaxHitpoints() * 0.1;
				if ( take < 1)
					take = 1;
				take = 1;
				cmpHealth.Reduce(take);
				changed = true;
			}
			if(changed)
				return true;
		}
		return false;
	}

	// attackers takes points
	if (result > 0) {
		let taken = cmpCapture.Reduce(result, this.GetMainAttacker());
		if (!taken)
			return false;
	} 
	// deffenders takes points
	else {
		let taken = cmpCapture.Reduce(-result, owner);
		if (!taken)
			return false;
	}
	return true;
}

/**
 * Ejects units and orders them to move to the rally point. If an ejection
 * with a given obstruction radius has failed, we won't try anymore to eject
 * entities with a bigger obstruction as that is compelled to also fail.
 * @param {Array} entities - An array containing the ids of the entities to eject.
 * @param {boolean} forced - Whether eject is forced (ie: if building is destroyed).
 * @return {boolean} Whether the entities were ejected.
 */
GarrisonHolder.prototype.PerformEject = function(entities, forced)
{
	if (!this.IsGarrisoningAllowed() && !forced) {
		return false;
	}

	let ejectedEntities = [];
	let success = true;
	let failedRadius;
	let radius;
	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);

	for (let entity of entities)
	{
		let entityIndex = this.entities.indexOf(entity);

		if (entityIndex == -1) {
			// Check attackers
			entityIndex = this.attackerEntities.indexOf(entity);
			if (entityIndex == -1)
				continue;
		}

		if (failedRadius !== undefined)
		{
			let cmpObstruction = Engine.QueryInterface(entity, IID_Obstruction);
			radius = cmpObstruction ? cmpObstruction.GetUnitRadius() : 0;
			if (radius >= failedRadius)
				continue;
		}

		if (this.Eject(entity, forced))
		{
			let cmpEntOwnership = Engine.QueryInterface(entity, IID_Ownership);
			if (cmpOwnership && cmpEntOwnership && cmpOwnership.GetOwner() == cmpEntOwnership.GetOwner())
		//	if (cmpEntOwnership && cmpEntOwnership.GetOwner() ==  g_ViewedPlayer)
				ejectedEntities.push(entity);
		}
		else
		{
			success = false;
			if (failedRadius !== undefined)
				failedRadius = Math.min(failedRadius, radius);
			else
			{
				let cmpObstruction = Engine.QueryInterface(entity, IID_Obstruction);
				failedRadius = cmpObstruction ? cmpObstruction.GetUnitRadius() : 0;
			}
		}
	}

	this.OrderWalkToRallyPoint(ejectedEntities);
	this.UpdateGarrisonFlag();

	return success;
};

/**
 * Order entities to walk to the rally point.
 * @param {Array} entities - An array containing all the ids of the entities.
 */
GarrisonHolder.prototype.OrderWalkToRallyPoint = function(entities)
{
	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	let cmpRallyPoint = Engine.QueryInterface(this.entity, IID_RallyPoint);
	if (!cmpRallyPoint || !cmpRallyPoint.GetPositions()[0])
		return;

	let commands = GetRallyPointCommands(cmpRallyPoint, entities);
	// Ignore the rally point if it is autogarrison
	if (commands[0].type == "garrison" && commands[0].target == this.entity)
		return;

	for (let command of commands)
		ProcessCommand(cmpOwnership.GetOwner(), command);
};

/**
 * Unload unit from the garrisoning entity and order them
 * to move to the rally point.
 * @return {boolean} Whether the command was successful.
 */
GarrisonHolder.prototype.Unload = function(entity, forced)
{
	return this.PerformEject([entity], forced);
};

GarrisonHolder.prototype.UnloadEnts = function(ents, owner)
{
	let entities = [];
	for (let entity of ents) {
		if (owner != Engine.QueryInterface(entity, IID_Ownership).GetOwner())
			continue;
		entities.push(entity);
	}
	return this.PerformEject(entities, false);
}

/**
 * Unload one or all units that match a template and owner from
 * the garrisoning entity and order them to move to the rally point.
 * @param {string} template - Type of units that should be ejected.
 * @param {number} owner - Id of the player whose units should be ejected.
 * @param {boolean} all - Whether all units should be ejected.
 * @param {boolean} forced - Whether unload is forced.
 * @return {boolean} Whether the unloading was successful.
 */
GarrisonHolder.prototype.UnloadTemplate = function(template, owner, all, forced)
{
	let entities = [];
	let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
	for (let entity of this.entities)
	{
		let cmpIdentity = Engine.QueryInterface(entity, IID_Identity);

		let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpUnitAI && cmpUnitAI.GetFormationController())
			continue;
		// Units with multiple ranks are grouped together.
		let name = cmpIdentity.GetSelectionGroupName() || cmpTemplateManager.GetCurrentTemplateName(entity);
		if (name != template || owner != Engine.QueryInterface(entity, IID_Ownership).GetOwner())
			continue;

		entities.push(entity);

		// If 'all' is false, only ungarrison the first matched unit.
		if (!all)
			break;
	}

	for (let entity of this.attackerEntities)
	{
		let cmpIdentity = Engine.QueryInterface(entity, IID_Identity);

		if (!cmpIdentity)
			continue;
		
		let cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
		if (cmpUnitAI && cmpUnitAI.GetFormationController())
			continue;
		
		// Units with multiple ranks are grouped together.
		let name = cmpIdentity.GetSelectionGroupName() || cmpTemplateManager.GetCurrentTemplateName(entity);
		if (name != template || owner != Engine.QueryInterface(entity, IID_Ownership).GetOwner())
			continue;

		entities.push(entity);

		// If 'all' is false, only ungarrison the first matched unit.
		if (!all)
			break;
	}
	return this.PerformEject(entities, forced);
};

/**
 * Unload all units, that belong to certain player
 * and order all own units to move to the rally point.
 * @param {boolean} forced - Whether unload is forced.
 * @param {number} owner - Id of the player whose units should be ejected.
 * @return {boolean} Whether the unloading was successful.
 */
GarrisonHolder.prototype.UnloadAllByOwner = function(owner, forced)
{
	let entities = this.entities.filter(ent => {
		let cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
		return cmpOwnership && cmpOwnership.GetOwner() == owner;
	});
	return this.PerformEject(entities, forced);
};

/**
 * Unload all units from the entity and order them to move to the rally point.
 * @param {boolean} forced - Whether unload is forced.
 * @return {boolean} Whether the unloading was successful.
 */
GarrisonHolder.prototype.UnloadAll = function(forced)
{
	return this.PerformEject(this.entities.slice(), forced);
};

/**
 * Used to check if the garrisoning entity's health has fallen below
 * a certain limit after which all garrisoned units are unloaded.
 */
GarrisonHolder.prototype.OnHealthChanged = function(msg)
{
	if (!this.HasEnoughHealth() && this.entities.length){
		this.EjectOrKill(this.entities.slice());
		this.EjectOrKill(this.attackerEntities.slice());
	}
};

GarrisonHolder.prototype.HasEnoughHealth = function()
{
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (!cmpHealth && this.IsWorkStation())
		return true;
	return cmpHealth.GetHitpoints() > Math.floor(+this.template.EjectHealth * cmpHealth.GetMaxHitpoints());
};

/**
 * Called every second. Heals garrisoned units.
 */
GarrisonHolder.prototype.HealTimeout = function(data)
{
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	if (!this.entities.length)
	{
		cmpTimer.CancelTimer(this.timer);
		this.timer = undefined;
		return;
	}

	for (let entity of this.entities)
	{
		let cmpHealth = Engine.QueryInterface(entity, IID_Health);
		if (cmpHealth && !cmpHealth.IsUnhealable())
			cmpHealth.Increase(this.GetHealRate());
	}

	this.timer = cmpTimer.SetTimeout(this.entity, IID_GarrisonHolder, "HealTimeout", 1000, {});
};

GarrisonHolder.prototype.TrainTimeout = function(data)
{
	let playerID = Engine.QueryInterface(this.entity, IID_Ownership).GetOwner();
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	if (!this.entities.length || !this.template.Train)
	{
		cmpTimer.CancelTimer(this.trainTimer);
		this.trainTimer = undefined;
		return;
	}

	let canTrain = false;
	let entities = this.entities;
	let ranks = [];
	let maxLeveled = [];
	let toEject = [];
	for (let entity of entities)
	{
		let cmpIdentity = Engine.QueryInterface(entity, IID_Identity);
		if (!cmpIdentity)
			continue;
		let entityClasses = cmpIdentity.GetClassesList();
		if (!MatchesClassList(entityClasses, this.GetTrainableClasses())) {
			continue;
		}
		let cmpExperience = Engine.QueryInterface(entity, IID_Experience);
		let name = cmpIdentity.GetGenericName();
		if (cmpExperience && !cmpExperience.IsMaxLeveled()) {
			let rank = cmpExperience.GetRank();
			cmpExperience.IncreaseXp(this.GetTrainPoints());
			if (cmpExperience.IsMaxLeveled()) {
				if (!maxLeveled[name])
					maxLeveled[name] = 0;
				maxLeveled[name]++;
		//		toEject.push(entity);
				continue;
			}
			let newRank = cmpExperience.GetRank();
			if (newRank != rank) {
				if (!ranks[newRank])
					ranks[newRank] = [];
				if (!ranks[newRank][name])
					ranks[newRank][name] = 0;
				ranks[newRank][name]++;
		//		toEject.push(entity);
				continue;
			}
			canTrain = true;
		}
	}

//	this.PerformEject(toEject, true);

	let cmpGuiInterface = Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface);
	for (let rank in ranks) {
		for (let name in ranks[rank]) {
			let count = ranks[rank][name];
		//	warn(count + "x " + name + " edned training with rank " + rank);
			cmpGuiInterface.PushNotification({
				"type": "trained",
				"target": this.entity,
				"unitName": name,
				"unitCount": count,
				"maxLevel": false,
				"players": [playerID],
				"rank": rank
			});
		}
	}

	for (let name in maxLeveled) {
		let count = maxLeveled[name];
		cmpGuiInterface.PushNotification({
			"type": "trained",
			"target": this.entity,
			"unitName": name,
			"unitCount": count,
			"maxLevel": true,
			"players": [playerID],
			"rank": ""
		});
	}

	
	if (canTrain)
		this.trainTimer = cmpTimer.SetTimeout(this.entity, IID_GarrisonHolder, "TrainTimeout", 1000, {});
	else {
		cmpTimer.CancelTimer(this.trainTimer);
		this.trainTimer = undefined;
	}
};

/**
 * Updates the garrison flag depending whether something is garrisoned in the entity.
 */
GarrisonHolder.prototype.UpdateGarrisonFlag = function()
{
	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (!cmpVisual)
		return;

	let cmpGate = Engine.QueryInterface(this.entity, IID_Gate);
	if (cmpGate) {
		if (cmpGate.IsOpened())
			cmpVisual.SelectAnimation("gate_open", true, 1.0);
		else
			cmpVisual.SelectAnimation("gate_closed", true, 1.0);
	}
	cmpVisual.SetVariant("garrison", this.entities.length ? "garrisoned" : "ungarrisoned");
};

/**
 * Cancel timer when destroyed.
 */
GarrisonHolder.prototype.OnDestroy = function()
{
	if (this.timer)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		cmpTimer.CancelTimer(this.timer);
	}
};

/**
 * If a garrisoned entity is captured, or about to be killed (so its owner changes to '-1'),
 * remove it from the building so we only ever contain valid entities.
 */
GarrisonHolder.prototype.OnGlobalOwnershipChanged = function(msg)
{
	// The ownership change may be on the garrisonholder
	if (this.entity == msg.entity)
	{
		let entities = this.entities.filter(ent => msg.to == INVALID_PLAYER || !IsOwnedByMutualAllyOfEntity(this.entity, ent));

		if (entities.length)
			this.EjectOrKill(entities);

		let atEnts = this.attackerEntities.filter(ent => msg.to == INVALID_PLAYER || !IsOwnedByMutualAllyOfEntity(this.entity, ent));

		if (atEnts.length)
			this.EjectOrKill(atEnts);

		// Attackers become deffenders
		if (msg.to != INVALID_PLAYER) {
			let ents = this.attackerEntities.filter(ent => IsOwnedByMutualAllyOfEntity(this.entity, ent));
			this.SwapOrEject(ents);
		}
		return;
	}

	// or on some of its garrisoned units
	let entityIndex = this.entities.indexOf(msg.entity);
	if (entityIndex != -1)
	{
		// If the entity is dead, remove it directly instead of ejecting the corpse
		let cmpHealth = Engine.QueryInterface(msg.entity, IID_Health);
		if (cmpHealth && cmpHealth.GetHitpoints() == 0)
		{
			this.entities.splice(entityIndex, 1);
			Engine.PostMessage(this.entity, MT_GarrisonedUnitsChanged, { "added": [], "removed": [msg.entity] });
			this.UpdateGarrisonFlag();

			for (let point of this.visibleGarrisonPoints)
				if (point.entity == msg.entity)
					point.entity = null;
		}
		else if (msg.to == INVALID_PLAYER || !IsOwnedByMutualAllyOfEntity(this.entity, msg.entity))
			this.EjectOrKill([msg.entity]);
	}
};

/**
 * Update list of garrisoned entities if one gets renamed (e.g. by promotion).
 */
GarrisonHolder.prototype.OnGlobalEntityRenamed = function(msg)
{
	let entityIndex = this.entities.indexOf(msg.entity);
	if (entityIndex != -1)
	{
		let vgpRenamed;
		for (let vgp of this.visibleGarrisonPoints)
		{
			if (vgp.entity != msg.entity)
				continue;
			vgpRenamed = vgp;
			break;
		}
		this.Eject(msg.entity, true);
		this.Garrison(msg.newentity, vgpRenamed);
	} else {
		entityIndex = this.attackerEntities.indexOf(msg.entity);
		if (entityIndex != -1)
		{
			let vgpRenamed;
			for (let vgp of this.visibleAttackPoints)
			{
				if (vgp.entity != msg.entity)
					continue;
				vgpRenamed = vgp;
				break;
			}
			this.Eject(msg.entity, true);
			this.Garrison(msg.newentity, vgpRenamed);
		}
	}

	if (!this.initGarrison)
		return;

	// Update the pre-game garrison because of SkirmishReplacement
	if (msg.entity == this.entity)
	{
		let cmpGarrisonHolder = Engine.QueryInterface(msg.newentity, IID_GarrisonHolder);
		if (cmpGarrisonHolder)
			cmpGarrisonHolder.initGarrison = this.initGarrison;
	}
	else
	{
		entityIndex = this.initGarrison.indexOf(msg.entity);
		if (entityIndex != -1)
			this.initGarrison[entityIndex] = msg.newentity;
	}
};

/**
 * Eject all foreign garrisoned entities which are no more allied.
 */
GarrisonHolder.prototype.OnDiplomacyChanged = function()
{
	this.EjectOrKill(this.entities.filter(ent => !IsOwnedByMutualAllyOfEntity(this.entity, ent)));
};

/**
 * Change attackers to deffenders or eject them due to no space or fitting class
 */
GarrisonHolder.prototype.SwapOrEject = function(entities)
{
	let cmpTurretPosition = Engine.QueryInterface(this.entity, IID_Position);
	for (let ent of entities)
	{
		let index = this.attackerEntities.indexOf(ent);
		if (index == -1)
			continue;

		if (this.IsFull()) {
			this.Eject(ent, true);
			continue;
		}

		this.attackerEntities.splice(index, 1);
		this.entities.push(ent);

		let found = false;
		for (let vp of this.visibleAttackPoints)
		{
			if (vp.entity != ent)
				continue;
			vp.entity = null;
			found = true;
			break;
		}

		if (!found)
			continue;

		let cmpPosition = Engine.QueryInterface(ent, IID_Position);
		for (let vp of this.visibleGarrisonPoints)
		{
			if (vp.entity)
				continue;
			vp.entity = ent;
			if (vp.angle != null)
				cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + vp.angle);
			else if (!cmpPosition.IsInWorld())
				cmpPosition.SetYRotation(cmpTurretPosition.GetRotation().y + Math.PI);
			cmpPosition.SetTurretParent(this.entity, vp.offset);
			break;
		}
	} // for ent of entities
	Engine.PostMessage(this.entity, MT_RecomputeGarrisonedUnits, {});
};

/**
 * Eject or kill a garrisoned unit which can no more be garrisoned
 * (garrisonholder's health too small or ownership changed).
 */
GarrisonHolder.prototype.EjectOrKill = function(entities)
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	// Eject the units which can be ejected (if not in world, it generally means this holder
	// is inside a holder which kills its entities, so do not eject)
	if (cmpPosition && cmpPosition.IsInWorld())
	{
		let ejectables = entities.filter(ent => this.IsEjectable(ent));
		if (ejectables.length)
			this.PerformEject(ejectables, false);
	}

	// And destroy all remaining entities
	let killedEntities = [];
	for (let entity of entities)
	{
		let entityIndex = this.entities.indexOf(entity);
		let attacker = false;
		if (entityIndex == -1) {
			entityIndex = this.attackerEntities.indexOf(entity);
			if (entityIndex == -1)
				continue;
		}
		let cmpHealth = Engine.QueryInterface(entity, IID_Health);
		if (cmpHealth)
			cmpHealth.Kill();
		if (attacker)
			this.attackerEntities.splice(entityIndex, 1);
		else
			this.entities.splice(entityIndex, 1);
		killedEntities.push(entity);
	}

	if (killedEntities.length)
		Engine.PostMessage(this.entity, MT_GarrisonedUnitsChanged, { "added": [], "removed": killedEntities });
	this.UpdateGarrisonFlag();
};

GarrisonHolder.prototype.IsEjectable = function(entity)
{
	if (!entity)
		return false;
	if (!this.entities.find(ent => ent == entity)) {
		if (!this.attackerEntities.find(ent => ent == entity))
			return false;
	}

	let ejectableClasses = this.template.EjectClassesOnDestroy._string;
	ejectableClasses = ejectableClasses ? ejectableClasses.split(/\s+/) : [];
	let cmpIdentity = Engine.QueryInterface(entity, IID_Identity);
	if (!cmpIdentity)
		return false;
	let entityClasses = cmpIdentity.GetClassesList();

	return ejectableClasses.some(ejectableClass => entityClasses.indexOf(ejectableClass) != -1);
};

/**
 * Initialise the garrisoned units.
 */
GarrisonHolder.prototype.OnGlobalInitGame = function(msg)
{
	if (!this.initGarrison)
		return;

	for (let ent of this.initGarrison)
	{
		let cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
		if (cmpUnitAI && cmpUnitAI.CanGarrison(this.entity) && this.Garrison(ent))
			cmpUnitAI.Autogarrison(this.entity);
	}
	this.initGarrison = undefined;
};

GarrisonHolder.prototype.OnValueModification = function(msg)
{
	if (msg.component != "GarrisonHolder" || msg.valueNames.indexOf("GarrisonHolder/BuffHeal") == -1)
		return;

	if (this.timer && this.GetHealRate() == 0)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		cmpTimer.CancelTimer(this.timer);
		this.timer = undefined;
	}
	else if (!this.timer && this.GetHealRate() > 0)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		this.timer = cmpTimer.SetTimeout(this.entity, IID_GarrisonHolder, "HealTimeout", 1000, {});
	}
};

Engine.RegisterComponentType(IID_GarrisonHolder, "GarrisonHolder", GarrisonHolder);
function Foundation() {}

Foundation.prototype.Schema =
	"<empty/>";

Foundation.prototype.Init = function()
{
	// Foundations are initially 'uncommitted' and do not block unit movement at all
	// (to prevent players exploiting free foundations to confuse enemy units).
	// The first builder to reach the uncommitted foundation will tell friendly units
	// and animals to move out of the way, then will commit the foundation and enable
	// its obstruction once there's nothing in the way.
	this.committed = false;

	this.builders = new Map(); // Map of builder entities to their work per second
	this.totalBuilderRate = 0; // Total amount of work the builders do each second
	this.buildMultiplier = 1; // Multiplier for the amount of work builders do
	this.buildTimePenalty = 0.7; // Penalty for having multiple builders

	this.previewEntity = INVALID_ENTITY;
	
};

Foundation.prototype.InitialiseConstruction = function(owner, template)
{
	this.finalTemplateName = template;

	// We need to know the owner in OnDestroy, but at that point the entity has already been
	// decoupled from its owner, so we need to remember it in here (and assume it won't change)
	this.owner = owner;

	// Remember the cost here, so if it changes after construction begins (from auras or technologies)
	// we will use the correct values to refund partial construction costs
	let cmpCost = Engine.QueryInterface(this.entity, IID_Cost);
	if (!cmpCost)
		error("A foundation must have a cost component to know the build time");

	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (!cmpHealth)
		error("Foundation " + this.entity + " does not have a health component.");
	
	let max = cmpHealth.GetMaxHitpoints();
	
	this.costs = cmpCost.GetResourceCosts(owner);
	this.payed = {};

	let nRes = 0;
	
	for (let c in this.costs)
		nRes += this.costs[c];
	
	if (nRes)
		this.takeAfter = max / nRes;
	else
		this.takeAfter = max;
	
	this.lastTaken = 0;

	this.initialised = true;
};

/**
 * Moving the revelation logic from Build to here makes the building sink if
 * it is attacked.
 */
Foundation.prototype.OnHealthChanged = function(msg)
{
	// Gradually reveal the final building preview
	let cmpPosition = Engine.QueryInterface(this.previewEntity, IID_Position);
	if (cmpPosition)
		cmpPosition.SetConstructionProgress(this.GetBuildProgress());

	Engine.PostMessage(this.entity, MT_FoundationProgressChanged, { "to": this.GetBuildPercentage() });
};

/**
 * Returns the current build progress in a [0,1] range.
 */
Foundation.prototype.GetBuildProgress = function()
{
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (!cmpHealth)
		return 0;

	let hitpoints = cmpHealth.GetHitpoints();
	let maxHitpoints = cmpHealth.GetMaxHitpoints();

	return hitpoints / maxHitpoints;
};

Foundation.prototype.GetBuildPercentage = function()
{
	return Math.floor(this.GetBuildProgress() * 100);
};

Foundation.prototype.GetNumBuilders = function()
{
	return this.builders.size;
};

Foundation.prototype.IsFinished = function()
{
	return (this.GetBuildProgress() == 1.0);
};

Foundation.prototype.OnDestroy = function()
{
	// Refund a portion of the construction cost, proportional to the amount of build progress remaining

	if (!this.initialised) // this happens if the foundation was destroyed because the player had insufficient resources
		return;

	if (this.previewEntity != INVALID_ENTITY)
	{
		Engine.DestroyEntity(this.previewEntity);
		this.previewEntity = INVALID_ENTITY;
	}

	if (this.IsFinished())
		return;

	let cmpPlayer = QueryPlayerIDInterface(this.owner);

	for (let r in this.payed)
	{
		cmpPlayer.AddResource(r, this.payed[r]);
		let cmpStatisticsTracker = QueryPlayerIDInterface(this.owner, IID_StatisticsTracker);
		if (cmpStatisticsTracker)
			cmpStatisticsTracker.IncreaseResourceUsedCounter(r, -this.payed[r]);
	}
};

/**
 * Adds a builder to the counter.
 */
Foundation.prototype.AddBuilder = function(builderEnt)
{
	if (this.builders.has(builderEnt))
		return;

	this.builders.set(builderEnt, Engine.QueryInterface(builderEnt, IID_Builder).GetRate());
	this.totalBuilderRate += this.builders.get(builderEnt);
	this.SetBuildMultiplier();

	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (cmpVisual)
		cmpVisual.SetVariable("numbuilders", this.builders.size);

	Engine.PostMessage(this.entity, MT_FoundationBuildersChanged, { "to": Array.from(this.builders.keys()) });
};

Foundation.prototype.RemoveBuilder = function(builderEnt)
{
	if (!this.builders.has(builderEnt))
		return;

	this.totalBuilderRate -= this.builders.get(builderEnt);
	this.builders.delete(builderEnt);
	this.SetBuildMultiplier();

	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (cmpVisual)
		cmpVisual.SetVariable("numbuilders", this.builders.size);

	Engine.PostMessage(this.entity, MT_FoundationBuildersChanged, { "to": Array.from(this.builders.keys()) });
};

/**
 * The build multiplier is a penalty that is applied to each builder.
 * For example, ten women build at a combined rate of 10^0.7 = 5.01 instead of 10.
 */
Foundation.prototype.CalculateBuildMultiplier = function(num)
{
	// Avoid division by zero, in particular 0/0 = NaN which isn't reliably serialized
	return num < 2 ? 1 : Math.pow(num, this.buildTimePenalty) / num;
};

Foundation.prototype.SetBuildMultiplier = function()
{
	this.buildMultiplier = this.CalculateBuildMultiplier(this.GetNumBuilders());
};

Foundation.prototype.GetBuildTime = function()
{
	let timeLeft = (1 - this.GetBuildProgress()) * Engine.QueryInterface(this.entity, IID_Cost).GetBuildTime();
	let rate = this.totalBuilderRate * this.buildMultiplier;
	// The rate if we add another woman to the foundation.
	let rateNew = (this.totalBuilderRate + 1) * this.CalculateBuildMultiplier(this.GetNumBuilders() + 1);
	return {
		// Avoid division by zero, in particular 0/0 = NaN which isn't reliably serialized
		"timeRemaining": rate ? timeLeft / rate : 0,
		"timeRemainingNew": timeLeft / rateNew
	};
};

/**
 * Perform some number of seconds of construction work.
 * Returns true if the construction is completed.
 */
Foundation.prototype.Build = function(builderEnt, work)
{
	// Do nothing if we've already finished building
	// (The entity will be destroyed soon after completion so
	// this won't happen much)
	if (this.GetBuildProgress() == 1.0 && this.completed) {
		return;
	}

	this.completed = false;
	let cmpObstruction = Engine.QueryInterface(this.entity, IID_Obstruction);
	// If there are any units in the way, ask them to move away and return early from this method.
	if (cmpObstruction && cmpObstruction.GetBlockMovementFlag())
	{
		// Remove animal corpses
		for (let ent of cmpObstruction.GetEntitiesDeletedUponConstruction())
			Engine.DestroyEntity(ent);

		let collisions = cmpObstruction.GetEntitiesBlockingConstruction();
		if (collisions.length)
		{
			for (let ent of collisions)
			{
				let cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
				if (cmpUnitAI)
					cmpUnitAI.LeaveFoundation(this.entity);

				// TODO: What if an obstruction has no UnitAI?
			}

			// TODO: maybe we should tell the builder to use a special
			// animation to indicate they're waiting for people to get
			// out the way

			return;
		}
	}

	// Handle the initial 'committing' of the foundation
	if (!this.committed)
	{
		// The obstruction always blocks new foundations/construction,
		// but we've temporarily allowed units to walk all over it
		// (via CCmpTemplateManager). Now we need to remove that temporary
		// blocker-disabling, so that we'll perform standard unit blocking instead.
		if (cmpObstruction && cmpObstruction.GetBlockMovementFlag())
			cmpObstruction.SetDisableBlockMovementPathfinding(false, false, -1);

		// Call the related trigger event
		let cmpTrigger = Engine.QueryInterface(SYSTEM_ENTITY, IID_Trigger);
		cmpTrigger.CallEvent("ConstructionStarted", {
			"foundation": this.entity,
			"template": this.finalTemplateName
		});

		// Switch foundation to scaffold variant
		let cmpFoundationVisual = Engine.QueryInterface(this.entity, IID_Visual);
		if (cmpFoundationVisual)
			cmpFoundationVisual.SelectAnimation("scaffold", false, 1.0);

		// Create preview entity and copy various parameters from the foundation
		if (cmpFoundationVisual && cmpFoundationVisual.HasConstructionPreview())
		{
			this.previewEntity = Engine.AddEntity("construction|"+this.finalTemplateName);
			let cmpFoundationOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
			let cmpPreviewOwnership = Engine.QueryInterface(this.previewEntity, IID_Ownership);
			cmpPreviewOwnership.SetOwner(cmpFoundationOwnership.GetOwner());

			// Initially hide the preview underground
			let cmpPreviewPosition = Engine.QueryInterface(this.previewEntity, IID_Position);
			cmpPreviewPosition.SetConstructionProgress(0.0);

			let cmpPreviewVisual = Engine.QueryInterface(this.previewEntity, IID_Visual);
			if (cmpPreviewVisual)
			{
				cmpPreviewVisual.SetActorSeed(cmpFoundationVisual.GetActorSeed());
				cmpPreviewVisual.SelectAnimation("scaffold", false, 1.0, "");
			}

			let cmpFoundationPosition = Engine.QueryInterface(this.entity, IID_Position);
			let pos = cmpFoundationPosition.GetPosition2D();
			let rot = cmpFoundationPosition.GetRotation();
			cmpPreviewPosition.SetYRotation(rot.y);
			cmpPreviewPosition.SetXZRotation(rot.x, rot.z);
			cmpPreviewPosition.JumpTo(pos.x, pos.y);
		}

		this.committed = true;
	}

	// Add an appropriate proportion of hitpoints
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (!cmpHealth)
	{
		error("Foundation " + this.entity + " does not have a health component.");
		return;
	}
	let deltaHP = work * this.GetBuildRate() * this.buildMultiplier;
	
	let progress = this.GetBuildProgress();
	
	let cmpPlayer = QueryPlayerIDInterface(this.owner);
	
	if (deltaHP > 0 && progress < 1.0) {
		let points = cmpHealth.GetHitpoints();
		while (points + deltaHP >= this.lastTaken + this.takeAfter) {
			let hasResources = true;
			// Increase if we have resources to use
			for (let r in this.costs) {
				if (this.payed[r] === undefined)
					this.payed[r] = 0;
				let need = this.costs[r] - this.payed[r];
				if (need) {
					if (!cmpPlayer.UseResource(r, 1))
						hasResources = false;
					else {
						this.payed[r] += 1;
						break;
					}
				}
			}
			if (!hasResources) {
				// Stall
				return;
			}
			this.lastTaken += this.takeAfter;
		}
		
		// Take all remaining resources
		if (progress >= 0.9)
		{	
			let hasResources = true;
			for (let r in this.costs) {
				if (this.payed[r] === undefined)
					this.payed[r] = 0;
				let need = this.costs[r] - this.payed[r];
				if (need) {
					if (!cmpPlayer.UseResource(r, need)) {
						hasResources = hasResources && false;
						// Try to take at least 1
						if (need > 1 && cmpPlayer.UseResource(r, 1))
							this.payed[r] += 1;
					}
					else {
						hasResources = hasResources && true;
						this.payed[r] += need;
					}
				}
			}

			if (!hasResources) {
				let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
				let owner = cmpOwnership.GetOwner();
				let cmpGUIInterface = Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface);
				cmpGUIInterface.PushNotification({
					"players": [owner],
					"message": "Queue stalled"
				});
				return;
			}
		}
		cmpHealth.Increase(deltaHP);
	}

	// Update the total builder rate
	this.totalBuilderRate += work - this.builders.get(builderEnt);
	this.builders.set(builderEnt, work);

	progress = this.GetBuildProgress();
	
	if (progress >= 1.0)
	{
		// Finished construction
		
		// Create the real entity
		let building = Engine.AddEntity(this.finalTemplateName);

		// Copy various parameters from the foundation

		let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
		let cmpBuildingVisual = Engine.QueryInterface(building, IID_Visual);
		if (cmpVisual && cmpBuildingVisual)
			cmpBuildingVisual.SetActorSeed(cmpVisual.GetActorSeed());

		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (!cmpPosition || !cmpPosition.IsInWorld())
		{
			error("Foundation " + this.entity + " does not have a position in-world.");
			Engine.DestroyEntity(building);
			return;
		}
		let cmpBuildingPosition = Engine.QueryInterface(building, IID_Position);
		if (!cmpBuildingPosition)
		{
			error("New building " + building + " has no position component.");
			Engine.DestroyEntity(building);
			return;
		}
		let pos = cmpPosition.GetPosition2D();
		cmpBuildingPosition.JumpTo(pos.x, pos.y);
		let rot = cmpPosition.GetRotation();
		cmpBuildingPosition.SetYRotation(rot.y);
		cmpBuildingPosition.SetXZRotation(rot.x, rot.z);
		// TODO: should add a ICmpPosition::CopyFrom() instead of all this

		let cmpRallyPoint = Engine.QueryInterface(this.entity, IID_RallyPoint);
		let cmpBuildingRallyPoint = Engine.QueryInterface(building, IID_RallyPoint);
		if(cmpRallyPoint && cmpBuildingRallyPoint)
		{
			let rallyCoords = cmpRallyPoint.GetPositions();
			let rallyData = cmpRallyPoint.GetData();
			for (let i = 0; i < rallyCoords.length; ++i)
			{
				cmpBuildingRallyPoint.AddPosition(rallyCoords[i].x, rallyCoords[i].z);
				cmpBuildingRallyPoint.AddData(rallyData[i]);
			}
		}

		// ----------------------------------------------------------------------

		let owner;
		let cmpTerritoryDecay = Engine.QueryInterface(building, IID_TerritoryDecay);
		if (cmpTerritoryDecay && cmpTerritoryDecay.HasTerritoryOwnership())
		{
			let cmpTerritoryManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TerritoryManager);
			owner = cmpTerritoryManager.GetOwner(pos.x, pos.y);
		}
		else
		{
			let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
			if (!cmpOwnership)
			{
				error("Foundation " + this.entity + " has no ownership.");
				Engine.DestroyEntity(building);
				return;
			}
			owner = cmpOwnership.GetOwner();
		}
		let cmpBuildingOwnership = Engine.QueryInterface(building, IID_Ownership);
		if (!cmpBuildingOwnership)
		{
			error("New Building " + building + " has no ownership.");
			Engine.DestroyEntity(building);
			return;
		}
		cmpBuildingOwnership.SetOwner(owner);

		/*
		Copy over the obstruction control group IDs from the foundation
		entities. This is needed to ensure that when a foundation is completed
		and replaced by a new entity, it remains in the same control group(s)
		as any other foundation entities that may surround it. This is the
		mechanism that is used to e.g. enable wall pieces to be built closely
		together, ignoring their mutual obstruction shapes (since they would
		otherwise be prevented from being built so closely together). If the
		control groups are not copied over, the new entity will default to a
		new control group containing only itself, and will hence block
		construction of any surrounding foundations that it was previously in
		the same control group with.

		Note that this will result in the completed building entities having
		control group IDs that equal entity IDs of old (and soon to be deleted)
		foundation entities. This should not have any consequences, however,
		since the control group IDs are only meant to be unique identifiers,
		which is still true when reusing the old ones.
		*/

		let cmpBuildingObstruction = Engine.QueryInterface(building, IID_Obstruction);
		if (cmpObstruction && cmpBuildingObstruction)
		{
			cmpBuildingObstruction.SetControlGroup(cmpObstruction.GetControlGroup());
			cmpBuildingObstruction.SetControlGroup2(cmpObstruction.GetControlGroup2());
		}

		let cmpPlayerStatisticsTracker = QueryOwnerInterface(this.entity, IID_StatisticsTracker);
		if (cmpPlayerStatisticsTracker)
			cmpPlayerStatisticsTracker.IncreaseConstructedBuildingsCounter(building);

		let cmpKnowledeClass = Engine.QueryInterface(building, IID_KnowledgeClass);
		if (cmpKnowledeClass) {
			let cmpKnowledgeManager = QueryOwnerInterface(this.entity, IID_KnowledgeManager);
			if (cmpKnowledgeManager)
				cmpKnowledgeManager.AddPoints("Build", cmpKnowledeClass.GetClass(), 1);
		}
		
		let cmpBuildingHealth = Engine.QueryInterface(building, IID_Health);
		if (cmpBuildingHealth)
			cmpBuildingHealth.SetHitpoints(progress * cmpBuildingHealth.GetMaxHitpoints());

		PlaySound("constructed", building);
		
		Engine.PostMessage(this.entity, MT_ConstructionFinished,
			{ "entity": this.entity, "newentity": building });
		Engine.PostMessage(this.entity, MT_EntityRenamed, { "entity": this.entity, "newentity": building });

		Engine.DestroyEntity(this.entity);
	}
};

Foundation.prototype.GetBuildRate = function()
{
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	let cmpCost = Engine.QueryInterface(this.entity, IID_Cost);
	// Return infinity for instant structure conversion
	return cmpHealth.GetMaxHitpoints() / cmpCost.GetBuildTime();
};

Engine.RegisterComponentType(IID_Foundation, "Foundation", Foundation);


function AnimalAI() {}

AnimalAI.prototype.Schema = 
	"<element name='DefaultStance'>" +
		"<choice>" +
			"<value>violent</value>" +
			"<value>aggressive</value>" +
			"<value>defensive</value>" +
			"<value>passive</value>" +
			"<value>standground</value>" +
		"</choice>" +
	"</element>" +
	"<element name='FleeDistance'>" +
		"<ref name='positiveDecimal'/>" +
	"</element>" +
	"<optional>" +
		"<interleave>" +
			"<element name='NaturalBehaviour' a:help='Behaviour of the unit in the absence of player commands (intended for animals)'>" +
				"<choice>" +
					"<value a:help='Will actively attack any unit it encounters, even if not threatened'>violent</value>" +
					"<value a:help='Will attack nearby units if it feels threatened (if they linger within LOS for too long)'>aggressive</value>" +
					"<value a:help='Will attack nearby units if attacked'>defensive</value>" +
					"<value a:help='Will never attack units but will attempt to flee when attacked'>passive</value>" +
					"<value a:help='Will never attack units. Will typically attempt to flee for short distances when units approach'>skittish</value>" +
					"<value a:help='Will never attack units and will not attempt to flee when attacked'>domestic</value>" +
				"</choice>" +
			"</element>" +
			"<element name='RoamDistance'>" +
				"<ref name='positiveDecimal'/>" +
			"</element>" +
			"<element name='RoamTimeMin'>" +
				"<ref name='positiveDecimal'/>" +
			"</element>" +
			"<element name='RoamTimeMax'>" +
				"<ref name='positiveDecimal'/>" +
			"</element>" +
			"<element name='FeedTimeMin'>" +
				"<ref name='positiveDecimal'/>" +
			"</element>" +
			"<element name='FeedTimeMax'>" +
				"<ref name='positiveDecimal'/>" +
			"</element>"+
		"</interleave>" +
	"</optional>";

var g_Stances = {
	"violent": {
		"targetVisibleEnemies": true,
		"targetAttackersAlways": true,
		"respondFlee": false,
		"respondChase": true,
		"respondChaseBeyondVision": true,
		"respondStandGround": false,
		"respondHoldGround": false,
		"selectable": false
	},
	"aggressive": {
		"targetVisibleEnemies": true,
		"targetAttackersAlways": false,
		"respondFlee": false,
		"respondChase": true,
		"respondChaseBeyondVision": false,
		"respondStandGround": false,
		"respondHoldGround": false,
		"selectable": false
	},
	"defensive": {
		"targetVisibleEnemies": true,
		"targetAttackersAlways": false,
		"respondFlee": false,
		"respondChase": false,
		"respondChaseBeyondVision": false,
		"respondStandGround": false,
		"respondHoldGround": true,
		"selectable": false
	},
	"passive": {
		"targetVisibleEnemies": false,
		"targetAttackersAlways": false,
		"respondFlee": true,
		"respondChase": false,
		"respondChaseBeyondVision": false,
		"respondStandGround": false,
		"respondHoldGround": false,
		"selectable": false
	},
	"standground": {
		"targetVisibleEnemies": true,
		"targetAttackersAlways": false,
		"respondFlee": false,
		"respondChase": false,
		"respondChaseBeyondVision": false,
		"respondStandGround": true,
		"respondHoldGround": false,
		"selectable": false
	},
	"none": {
		// Only to be used by AI or trigger scripts
		"targetVisibleEnemies": false,
		"targetAttackersAlways": false,
		"respondFlee": false,
		"respondChase": false,
		"respondChaseBeyondVision": false,
		"respondStandGround": false,
		"respondHoldGround": false,
		"selectable": false
	}
};

// See ../helpers/FSM.js for some documentation of this FSM specification syntax
AnimalAI.prototype.UnitFsmSpec = {
	// Default event handlers:

	"NearbyAttacked": function(msg) {
		// All wild animals in a given distance respond to the attack :
		// If skittish behaviour, they flee
		// If defensive behaviour, they attack if it is a member of their species which is involved
		if (this.template.NaturalBehaviour == "skittish" ||
		  this.template.NaturalBehaviour == "passive")
			this.Flee(msg.data.attacker, false);
		else if (this.IsDangerousAnimal() || this.template.NaturalBehaviour == "defensive") {
			let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);
			if (cmpIdentity && cmpIdentity.IsSameSpecy(msg.data.target))
				if (this.CanAttack(msg.data.attacker))
					this.Attack(msg.data.attacker, false);
		}
	},
	"MoveCompleted": function() {
		// ignore spurious movement messages
		// (these can happen when stopping moving at the same time
		// as switching states)
	},

	"MoveStarted": function() {
		// ignore spurious movement messages
	},


	"LosRangeUpdate": function(msg) {
		// ignore newly-seen units by default
	},

	"LosHealRangeUpdate": function(msg) {
		// ignore newly-seen injured units by default
	},

	"Attacked": function(msg) {
		// ignore attacker
	},

	"HealthChanged": function(msg) {
		// ignore
	},

	"GuardedAttacked": function(msg) {
		// ignore
	},
	
	// Individual orders:
	// (these will switch the unit out of formation mode)

	"Order.Stop": function(msg) {

		// Stop moving immediately.
		this.StopMoving();
		this.FinishOrder();

		this.SetNextState("ANIMAL.IDLE");

	},

	"Order.Walk": function(msg) {
		// Let players move captured domestic animals around
		if (this.IsTurret())
		{
			this.FinishOrder();
			return;
		}

		this.SetHeldPosition(this.order.data.x, this.order.data.z);
		if (!this.order.data.max)
			this.MoveToPoint(this.order.data.x, this.order.data.z);
		else
			this.MoveToPointRange(this.order.data.x, this.order.data.z, this.order.data.min, this.order.data.max);

		this.SetNextState("ANIMAL.WALKING");
	},

	"Order.WalkAndFight": function(msg) {
		// Let players move captured domestic animals around
		if (this.IsTurret())
		{
			this.FinishOrder();
			return;
		}

		this.SetHeldPosition(this.order.data.x, this.order.data.z);
		this.MoveToPoint(this.order.data.x, this.order.data.z);
		this.SetNextState("ANIMAL.WALKINGANDFIGHTING");
	},


	"Order.WalkToTarget": function(msg) {
		// Let players move captured domestic animals around
		if (this.IsTurret())
		{
			this.FinishOrder();
			return;
		}

		if (this.MoveToTarget(this.order.data.target))
				this.SetNextState("ANIMAL.WALKING");
		else
		{
			// We are already at the target, or can't move at all
			this.StopMoving();
			this.FinishOrder();
		}
	},

	"Order.Flee": function(msg) {
		// We use the distance between the entities to account for ranged attacks
		let distance = DistanceBetweenEntities(this.entity, this.order.data.target) + (+this.template.FleeDistance);
		let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
		if (cmpUnitMotion.MoveToTargetRange(this.order.data.target, distance, -1))
			this.SetNextState("ANIMAL.FLEEING");
		else
		{
			// We are already at the target, or can't move at all
			this.StopMoving();
			this.FinishOrder();
		}
	},
	"Order.Rotate": function(msg) {
		if (this.IsTurret()) {
			this.FinishOrder();
			return;
		}
		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (!cmpPosition || !cmpPosition.IsInWorld()) {
			this.FinishOrder();
			return;
		}
		let targetPos = {"x": msg.data.position.x, "y": msg.data.position.z};
		let angle = cmpPosition.GetPosition2D().angleTo(targetPos);
		cmpPosition.TurnTo(angle);
		this.FinishOrder();
	},
	"Order.Attack": function(msg) {
		// Check the target is alive
		if (!this.TargetIsAlive(this.order.data.target))
		{
			this.FinishOrder();
			return;
		}

		// Work out how to attack the given target
		let type = this.GetBestAttackAgainst(this.order.data.target, this.order.data.allowCapture);
		if (!type)
		{
			// Oops, we can't attack at all
			this.FinishOrder();
			return;
		}
		this.order.data.attackType = type;

		// If we are already at the target, try attacking it from here
		if (this.CheckTargetAttackRange(this.order.data.target, this.order.data.attackType))
		{
			this.StopMoving();

			if (this.order.data.attackType == this.oldAttackType)
				this.SetNextState("ANIMAL.COMBAT.ATTACKING");
			else
				this.SetNextStateAlwaysEntering("ANIMAL.COMBAT.ATTACKING");
			return;
		}

		// If we can't reach the target, but are standing ground, then abandon this attack order.
		// Unless we're hunting, that's a special case where we should continue attacking our target.
		if (this.GetStance().respondStandGround && !this.order.data.force && !this.order.data.hunting || this.IsTurret())
		{
			this.FinishOrder();
			return;
		}
		
		// Try to move within attack range
		if (this.MoveToTargetAttackRange(this.order.data.target, this.order.data.attackType))
		{
			// We've started walking to the given point
			this.SetNextState("ANIMAL.COMBAT.APPROACHING");
			return;
		}

		// We can't reach the target, and can't move towards it,
		// so abandon this attack order
		this.FinishOrder();
	},
	
	"ANIMAL": {
		"Attacked": function(msg) {
			if (this.template.NaturalBehaviour == "skittish" ||
			    this.template.NaturalBehaviour == "passive")
			{
				this.Flee(msg.data.attacker, false);
			}
			else if (this.IsDangerousAnimal() || this.template.NaturalBehaviour == "defensive")
			{
				if (this.CanAttack(msg.data.attacker))
					this.Attack(msg.data.attacker, false);
			}
			else if (this.template.NaturalBehaviour == "domestic")
				this.SetNextState("IDLE");
		},
		"Order.LeaveFoundation": function(msg) {
			// Move a tile outside the building
			let range = 4;
			if (this.MoveToTargetRangeExplicit(msg.data.target, range, range))
				this.SetNextState("WALKING");
			else
				this.FinishOrder();
		},
		"IDLE": {
			// (We need an IDLE state so that FinishOrder works)
			"enter": function() {
				if (this.FindNewTargets())
					return true;
				// Start feeding immediately
				this.SetNextState("FEEDING");
				return true;
			},
			
			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetWalkSpeed());
			},
		}, // IDLE
		"ROAMING": {
			"enter": function() {				
				if (this.FindNewTargets())
					return true;
				// Walk in a random direction
				this.SelectAnimation("move");
				this.SetFacePointAfterMove(false);
				this.MoveRandomly(+this.template.RoamDistance);
				// Set a random timer to switch to feeding state
				this.StartTimer(randIntInclusive(+this.template.RoamTimeMin, +this.template.RoamTimeMax));
			},

			"leave": function() {
				this.StopTimer();
				this.SetFacePointAfterMove(true);
			},

			"LosRangeUpdate": function(msg) {
				if (this.template.NaturalBehaviour == "skittish")
				{
					if (msg.data.added.length > 0)
					{
						this.Flee(msg.data.added[0], false);
						return;
					}
				}
				// Start attacking one of the newly-seen enemy (if any)
				else if (this.IsDangerousAnimal())
				{
					this.AttackVisibleEntity(msg.data.added);
				}

				// TODO: if two units enter our range together, we'll attack the
				// first and then the second won't trigger another LosRangeUpdate
				// so we won't notice it. Probably we should do something with
				// ResetActiveQuery in ROAMING.enter/FEEDING.enter in order to
				// find any units that are already in range.
			},

			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetWalkSpeed());
			},
			
			"Timer": function(msg) {
				this.SetNextState("FEEDING");
			},

			"MoveCompleted": function() {
				this.MoveRandomly(+this.template.RoamDistance);
			},
		},//ROAMING
		"FEEDING": {
			"enter": function() {
				// Stop and eat for a while
				this.SelectAnimation("feeding");
				this.StopMoving();
				this.StartTimer(randIntInclusive(+this.template.FeedTimeMin, +this.template.FeedTimeMax));
			},

			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetRunSpeed());
			},
			"leave": function() {
				this.StopTimer();
			},

			"LosRangeUpdate": function(msg) {
				if (this.template.NaturalBehaviour == "skittish")
				{
					if (msg.data.added.length > 0)
					{
						this.Flee(msg.data.added[0], false);
						return;
					}
				}
				// Start attacking one of the newly-seen enemy (if any)
				else if (this.template.NaturalBehaviour == "violent")
				{
					this.AttackVisibleEntity(msg.data.added);
				}
			},

			"MoveCompleted": function() { },

			"Timer": function(msg) {
				this.SetNextState("ROAMING");
			},
		}, // FEEDING
		"WALKING": {
			"enter": function() {
				this.SelectAnimation("move");
			}, 
			"MoveCompleted": function() {
				this.FinishOrder();
			},
			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetWalkSpeed());
			},
		},
		"WALKINGANDFIGHTING": {
			"enter": function() {
				this.StartTimer(0, 1000);
				this.SetMoveSpeed(this.GetRunSpeed());
				this.SelectAnimation("move");
			},
			
			"Timer": function(msg) {
				this.FindWalkAndFightTargets();
			},
			
			"leave": function(msg) {
				this.StopTimer();
				this.SetMoveSpeed(this.GetWalkSpeed());
				this.SetDefaultAnimationVariant();
			},

			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetRunSpeed());
			},
			"MoveCompleted": function() {
				this.FinishOrder();
			},
		},
		"COMBAT": {
			"Order.LeaveFoundation": function() {
				return {"discardOrder": true};
			},
			"Attacked": function(msg) {
				if (msg.data.type === "Melee" && (this.GetStance().targetAttackersAlways || !this.order.data.force))
					this.RespondToTargetedEntities([msg.data.attacker]);
			},
			"APPROACHING": {
				"enter": function() {
					this.SetMoveSpeed(this.GetRunSpeed());
					this.SelectAnimation("move");
					this.StartTimer(1000, 1000);
					return false;
				},
				"leave": function() {
					this.SetDefaultAnimationVariant();
					this.StopTimer();;
					this.SetMoveSpeed(this.GetWalkSpeed());
				},
				"Timer": function(msg) {
					if (this.ShouldAbandonChase(this.order.data.target, this.order.data.force, IID_Attack, this.order.data.attackType))
					{
						this.StopMoving();
						this.FinishOrder();

						// Return to our original position
						if (this.GetStance().respondHoldGround)
							this.WalkToHeldPosition();
					}
				},
				"HealthChanged": function() {
					this.SetMoveSpeed(this.GetRunSpeed());
				},
				"MoveCompleted": function() {
					if (this.CheckTargetAttackRange(this.order.data.target, this.order.data.attackType))
						this.SetNextState("ATTACKING");
					else
					{
						if (this.MoveToTargetAttackRange(this.order.data.target, this.order.data.attackType))
							this.SetNextState("APPROACHING");
						else
							this.FinishOrder();
					}
				},
			}, // COMBAT.APPROACHING
			"ATTACKING": {
				"NearbyAttacked": function() {
					// ignore
				},
				"enter": function() {
					let target = this.order.data.target;
					if (this.CanAttack(target) && !this.CheckTargetAttackRange(target, this.order.data.attackType))
					{
						// Can't reach it - try to chase after it
						if (this.ShouldChaseTargetedEntity(target, this.order.data.force))
						{
							if (this.MoveToTargetAttackRange(target, this.order.data.attackType))
							{
								this.SetNextState("COMBAT.CHASING");
								return true;
							}
						}
					}
					let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
					this.attackTimers = cmpAttack.GetTimers(this.order.data.attackType);
					
					let prepare = this.attackTimers.prepare;
					if (this.lastAttacked)
					{
						let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
						let repeatLeft = this.lastAttacked + this.attackTimers.repeat - cmpTimer.GetTime();
						prepare = Math.max(prepare, repeatLeft);
					}
					this.oldAttackType = this.order.data.attackType;
					let att = this.order.data.attackType.toLowerCase();
					let animationName = "attack_" + att;

					this.SelectAnimation(animationName);
					this.SetAnimationSync(prepare, this.attackTimers.repeat);
					this.StartTimer(prepare, this.attackTimers.repeat);

					this.resyncAnimation = (prepare != this.attackTimers.prepare) ? true : false;
					this.FaceTowardsTarget(this.order.data.target);
					return false;
				}, // COMBAT.ATTACKING.enter
				"leave": function() {
					this.StopTimer();
					this.SetDefaultAnimationVariant();
				},
				"Timer": function(msg) {
					let target = this.order.data.target;
					// Check the target is still alive and attackable
					let canContinue = true;
					if (this.CanAttack(target))
					{
						let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
						let bestAttack = cmpAttack.GetBestAttackAgainst(target, this.order.data.attackType == "Capture")
						
						if (bestAttack != this.order.data.attackType) {
							if (!bestAttack) {
								if (!this.GetStance().respondStandGround) {
									this.SetDefaultAnimationVariant();
									if (this.FinishOrder())
										return;
								}
								this.SetNextState("IDLE");
								return;
							}
							this.order.data.attackType = bestAttack;
							this.SetNextState("ATTACKING");
							if (!this.GetStance().respondStandGround) {
								this.SetDefaultAnimationVariant();
								this.SelectAnimation("idle");
							}
							return;
						}
						
						// If we are hunting, first update the target position of the gather order so we know where will be the killed animal
						if (this.order.data.hunting && this.orderQueue[1] && this.orderQueue[1].data.lastPos)
						{
							let cmpPosition = Engine.QueryInterface(this.order.data.target, IID_Position);
							if (cmpPosition && cmpPosition.IsInWorld())
							{
								// Store the initial position, so that we can find the rest of the herd later
								if (!this.orderQueue[1].data.initPos)
									this.orderQueue[1].data.initPos = this.orderQueue[1].data.lastPos;
								this.orderQueue[1].data.lastPos = cmpPosition.GetPosition();
								// We still know where the animal is, so we shouldn't give up before going there
								this.orderQueue[1].data.secondTry = undefined;
							}
						}
						
						let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
						this.lastAttacked = cmpTimer.GetTime() - msg.lateness;
						this.FaceTowardsTarget(target);

						canContinue = cmpAttack.PerformAttack(this.order.data.attackType, target);
						
						// Check we can still reach the target for the next attack
						if (this.CheckTargetAttackRange(target, this.order.data.attackType))
						{
							if (!canContinue) {
								let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
								let bestAttack = cmpAttack.GetBestAttackAgainst(target, this.order.data.attackType == "Capture")
								if (bestAttack) {
									this.order.data.attackType = bestAttack;
									this.SetNextState("ATTACKING");
									return;
								}
							}
							if (this.resyncAnimation)
							{
								this.SetAnimationSync(this.attackTimers.repeat, this.attackTimers.repeat);
								this.resyncAnimation = false;
							}
							return;
						}
						// Can't reach it - try to chase after it
						if (this.ShouldChaseTargetedEntity(target, this.order.data.force))
						{
							if (this.MoveToTargetRange(target, IID_Attack, this.order.data.attackType))
							{
								this.SetNextState("COMBAT.CHASING");
								return;
							}
						}
					} // canAttack
					if (this.FinishOrder())
					{
						if (this.IsWalkingAndFighting())
							this.FindWalkAndFightTargets();
						return;
					}
					// See if we can switch to a new nearby enemy
					if (this.FindNewTargets())
					{
						// Attempt to immediately re-enter the timer function, to avoid wasting the attack.
						// Packable units may have switched to PACKING state, thus canceling the timer and having order.data.attackType undefined.
						if (this.orderQueue.length > 0 && this.orderQueue[0].data && this.orderQueue[0].data.attackType &&
						    this.orderQueue[0].data.attackType == this.oldAttackType)
							this.TimerHandler(msg.data, msg.lateness);
						return;
					}
					// Return to our original position
					if (this.GetStance().respondHoldGround)
						this.WalkToHeldPosition();
				}, // COMBAT.ATTACKING.Timer
				"Attacked": function(msg) {
					// We are attacking finish it
				},
			}, // COMBAT.ATTACKING
			"CHASING": {
				"enter": function() {
					this.SetMoveSpeed(this.GetRunSpeed());
					this.SelectAnimation("move");
					this.StartTimer(1000, 1000);
				},
				"leave": function() {
					this.SetMoveSpeed(this.GetWalkSpeed());
					this.SetDefaultAnimationVariant();
					this.StopTimer();
				},
				"HealthChanged": function() {
					this.SetMoveSpeed(this.GetRunSpeed());
				},
				"Timer": function(msg) {
					if (this.ShouldAbandonChase(this.order.data.target, this.order.data.force, IID_Attack, this.order.data.attackType))
					{
						this.StopMoving();
						this.FinishOrder();
						// Return to our original position
						if (this.GetStance().respondHoldGround)
							this.WalkToHeldPosition();
					}
				},
				"MoveCompleted": function() {
					this.SetNextState("ATTACKING");
				},
			}, // COMBAT.CHASING
		}, // COMBAT
		"FLEEING": {
			"enter": function() {
				this.SetMoveSpeed(this.GetRunSpeed());
				this.SelectAnimation("move");
				return false;
			},
			"HealthChanged": function() {
				this.SetMoveSpeed(this.GetRunSpeed());
			},
			"leave": function() {
				this.SetMoveSpeed(this.GetWalkSpeed());
			},
			"MoveCompleted": function() {
				this.FinishOrder();
			}
		}, // FLEEING
	}, // ANIMAL
}; // FSM
AnimalAI.prototype.Init = function()
{
	this.orderQueue = []; // current order is at the front of the list
	this.order = undefined; // always == this.orderQueue[0]
	this.formationController = INVALID_ENTITY; // entity with IID_Formation that we belong to
	this.isGarrisoned = false;
	this.isIdle = false;
	this.finishedOrder = false; // used to find if all formation members finished the order

	this.heldPosition = undefined;

	// Queue of remembered works
	this.workOrders = [];

	this.isGuardOf = undefined;

	// For preventing increased action rate due to Stop orders or target death.
	this.lastAttacked = undefined;
	this.lastHealed = undefined;

	this.SetStance(this.template.DefaultStance);

}
AnimalAI.prototype.IsTurret = function()
{
	if (!this.IsGarrisoned())
		return false;
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	return cmpPosition && cmpPosition.GetTurretParent() != INVALID_ENTITY;
};
AnimalAI.prototype.SetNextState = function(state)
{
	this.UnitFsm.SetNextState(this, state);
};
AnimalAI.prototype.SetNextStateAlwaysEntering = function(state)
{
	this.UnitFsm.SetNextStateAlwaysEntering(this, state);
};
AnimalAI.prototype.DeferMessage = function(msg)
{
	this.UnitFsm.DeferMessage(this, msg);
};
AnimalAI.prototype.GetCurrentState = function()
{
	return this.UnitFsm.GetCurrentState(this);
};
AnimalAI.prototype.HasFinishedOrder = function()
{
	return this.finishedOrder;
};
AnimalAI.prototype.IsAnimal = function()
{
	return true;
}
AnimalAI.prototype.ResetFinishOrder = function()
{
	this.finishedOrder = false;
};
AnimalAI.prototype.IsDangerousAnimal = function()
{
	return (this.template.NaturalBehaviour == "violent" ||
			this.template.NaturalBehaviour == "aggressive");
};
AnimalAI.prototype.IsIdle = function()
{
	return this.isIdle;
};
AnimalAI.prototype.IsFleeing = function()
{
	return (this.GetCurrentState().split(".").pop() == "FLEEING");
};
AnimalAI.prototype.IsWalking = function()
{
	return (this.GetCurrentState().split(".").pop() == "WALKING");
};
AnimalAI.prototype.IsWalkingAndFighting = function()
{
	return this.orderQueue.length > 0 && (this.orderQueue[0].type == "WalkAndFight" || this.orderQueue[0].type == "Patrol");
};
AnimalAI.prototype.IsDomestic = function()
{
	let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);
	return cmpIdentity && cmpIdentity.HasClass("Domestic");
};
AnimalAI.prototype.OnCreate = function()
{
	this.UnitFsm.Init(this, "ANIMAL.FEEDING");
	this.isIdle = true;
};
AnimalAI.prototype.OnDiplomacyChanged = function(msg)
{
	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	if (cmpOwnership && cmpOwnership.GetOwner() == msg.player)
		this.SetupRangeQueries();
};
AnimalAI.prototype.OnOwnershipChanged = function(msg)
{
	this.SetupRangeQueries();

	if (this.isGuardOf && (msg.to == INVALID_PLAYER || !IsOwnedByMutualAllyOfEntity(this.entity, this.isGuardOf)))
		this.RemoveGuard();

	// If the unit isn't being created or dying, reset stance and clear orders
	if (msg.to != INVALID_PLAYER && msg.from != INVALID_PLAYER)
	{
		// Switch to a virgin state to let states execute their leave handlers.
		// except if garrisoned or cheering or (un)packing, in which case we only clear the order queue
		if (this.isGarrisoned || this.orderQueue[0] && this.orderQueue[0].type == "Cheering")
		{
			this.orderQueue.length = Math.min(this.orderQueue.length, 1);
			Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
		}
		else
		{
			let index = this.GetCurrentState().indexOf(".");
			if (index != -1)
				this.UnitFsm.SwitchToNextState(this, this.GetCurrentState().slice(0,index));
			this.Stop(false);
		}

		this.workOrders = [];

		this.SetStance(this.template.DefaultStance);
	}
};
AnimalAI.prototype.OnDestroy = function()
{
	// Switch to an empty state to let states execute their leave handlers.
	this.UnitFsm.SwitchToNextState(this, "");

	// Clean up range queries
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	if (this.losRangeQuery)
		cmpRangeManager.DestroyActiveQuery(this.losRangeQuery);
};
AnimalAI.prototype.OnVisionRangeChanged = function(msg)
{
	// Update range queries
	if (this.entity == msg.entity)
		this.SetupRangeQuery();
};
AnimalAI.prototype.UpdateRangeQueries = function()
{
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	if (this.losRangeQuery)
		this.SetupRangeQuery(cmpRangeManager.IsActiveQueryEnabled(this.losRangeQuery));
};
AnimalAI.prototype.SetupRangeQueries = function()
{
	this.SetupRangeQuery();
}
AnimalAI.prototype.SetupRangeQuery = function(enable = true)
{
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);

	if (this.losRangeQuery)
	{
		cmpRangeManager.DestroyActiveQuery(this.losRangeQuery);
		this.losRangeQuery = undefined;
	}

	let cmpPlayer = QueryOwnerInterface(this.entity);
	// If we are being destructed (owner -1), creating a range query is pointless
	if (!cmpPlayer)
		return;

	// Exclude allies, and self
	// TODO: How to handle neutral players - Special query to attack military only?
	let players = cmpPlayer.GetEnemies();
	let range = this.GetQueryRange(IID_Attack);

	this.losRangeQuery = cmpRangeManager.CreateActiveQuery(this.entity, range.min, range.max, players, IID_DamageReceiver, cmpRangeManager.GetEntityFlagMask("normal"));

	if (enable)
		cmpRangeManager.EnableActiveQuery(this.losRangeQuery);
};
AnimalAI.prototype.FsmStateNameChanged = function(state)
{
	Engine.PostMessage(this.entity, MT_UnitAIStateChanged, { "to": state });
};
AnimalAI.prototype.FinishOrder = function()
{
	if (!this.orderQueue.length)
	{
		let stack = new Error().stack.trimRight().replace(/^/mg, '  '); // indent each line
		let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
		let template = cmpTemplateManager.GetCurrentTemplateName(this.entity);
		error("FinishOrder called for entity " + this.entity + " (" + template + ") when order queue is empty\n" + stack);
	}

	this.orderQueue.shift();
	this.order = this.orderQueue[0];

	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (this.orderQueue.length && (this.IsGarrisoned() || cmpPosition && cmpPosition.IsInWorld()))
	{
		let ret = this.UnitFsm.ProcessMessage(this,
			{ "type": "Order."+this.order.type, "data": this.order.data }
		);

		Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });

		// If the order was rejected then immediately take it off
		// and process the remaining queue
		if (ret && ret.discardOrder)
			return this.FinishOrder();

		// Otherwise we've successfully processed a new order
		return true;
	}

	this.orderQueue = [];
	this.order = undefined;
	this.SetNextState("IDLE");

	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });

	return false;
};
AnimalAI.prototype.PushOrder = function(type, data)
{
	let order = { "type": type, "data": data };
	this.orderQueue.push(order);

	// If we didn't already have an order, then process this new one
	if (this.orderQueue.length == 1)
	{
		this.order = order;
		let ret = this.UnitFsm.ProcessMessage(this,
			{ "type": "Order."+this.order.type, "data": this.order.data }
		);

		// If the order was rejected then immediately take it off
		// and process the remaining queue
		if (ret && ret.discardOrder)
			this.FinishOrder();
	}

	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
};
AnimalAI.prototype.PushOrderFront = function(type, data)
{
	let order = { "type": type, "data": data };
	// If current order is cheering then add new order after it
	// same thing if current order if packing/unpacking
	if (this.order && this.order.type == "Cheering")
	{
		let cheeringOrder = this.orderQueue.shift();
		this.orderQueue.unshift(cheeringOrder, order);
	}
	else
	{
		this.orderQueue.unshift(order);
		this.order = order;
		let ret = this.UnitFsm.ProcessMessage(this,
			{ "type": "Order."+this.order.type, "data": this.order.data }
		);

		// If the order was rejected then immediately take it off again;
		// assume the previous active order is still valid (the short-lived
		// new order hasn't changed state or anything) so we can carry on
		// as if nothing had happened
		if (ret && ret.discardOrder)
		{
			this.orderQueue.shift();
			this.order = this.orderQueue[0];
		}
	}

	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });

};
AnimalAI.prototype.PushOrderAfterForced = function(type, data)
{
	if (!this.order || ((!this.order.data || !this.order.data.force) && this.order.type != type))
		this.PushOrderFront(type, data);
	else
	{
		for (let i = 1; i < this.orderQueue.length; ++i)
		{
			if (this.orderQueue[i].data && this.orderQueue[i].data.force)
				continue;
			if (this.orderQueue[i].type == type)
				continue;
			this.orderQueue.splice(i, 0, {"type": type, "data": data});
			Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
			return;
		}
		this.PushOrder(type, data);
	}

	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
};
AnimalAI.prototype.ReplaceOrder = function(type, data)
{
	// Remember the previous work orders to be able to go back to them later if required
	if (data && data.force)
		this.UpdateWorkOrders(type);

	let garrisonHolder = this.IsGarrisoned() && type != "Ungarrison" ? this.GetGarrisonHolder() : null;

	// Special cases of orders that shouldn't be replaced:
	// 1. Cheering - we're invulnerable, add order after we finish
	// 2. Packing/unpacking - we're immobile, add order after we finish (unless it's cancel)
	// TODO: maybe a better way of doing this would be to use priority levels
	if (this.order && this.order.type == "Cheering")
	{
		let order = { "type": type, "data": data };
		let cheeringOrder = this.orderQueue.shift();
		this.orderQueue = [cheeringOrder, order];
	}
	else
	{
		this.orderQueue = [];
		this.PushOrder(type, data);
	}

	if (garrisonHolder)
		this.PushOrder("Garrison", { "target": garrisonHolder });

	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
};
AnimalAI.prototype.GetOrders = function()
{
	return this.orderQueue.slice();
};
AnimalAI.prototype.AddOrders = function(orders)
{
	orders.forEach(order => this.PushOrder(order.type, order.data));
};
AnimalAI.prototype.GetOrderData = function()
{
	let orders = [];
	for (let order of this.orderQueue)
		if (order.data)
			orders.push(clone(order.data));

	return orders;
};
AnimalAI.prototype.UpdateWorkOrders = function(type)
{
	let isWorkType = type => type == "Gather" || type == "Trade" || type == "Repair" || type == "ReturnResource";

	// If we are being re-affected to a work order, forget the previous ones
	if (isWorkType(type))
	{
		this.workOrders = [];
		return;
	}

	// Then if we already have work orders, keep them
	if (this.workOrders.length)
		return;

	// If nothing found, take the unit orders
	for (let i = 0; i < this.orderQueue.length; ++i)
	{
		if (isWorkType(this.orderQueue[i].type))
		{
			this.workOrders = this.orderQueue.slice(i);
			return;
		}
	}
};
AnimalAI.prototype.BackToWork = function()
{
	if (this.workOrders.length == 0)
		return false;

	if (this.IsGarrisoned())
	{
		let cmpGarrisonHolder = Engine.QueryInterface(this.GetGarrisonHolder(), IID_GarrisonHolder);
		if (!cmpGarrisonHolder || !cmpGarrisonHolder.PerformEject([this.entity], false))
			return false;
	}

	// Clear the order queue considering special orders not to avoid
	if (this.order && this.order.type == "Cheering")
	{
		let cheeringOrder = this.orderQueue.shift();
		this.orderQueue = [cheeringOrder];
	}
	else
		this.orderQueue = [];

	this.AddOrders(this.workOrders);
	Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });

	this.workOrders = [];
	return true;
};

AnimalAI.prototype.HasWorkOrders = function()
{
	return this.workOrders.length > 0;
};
AnimalAI.prototype.GetWorkOrders = function()
{
	return this.workOrders;
};
AnimalAI.prototype.SetWorkOrders = function(orders)
{
	this.workOrders = orders;
};
AnimalAI.prototype.TimerHandler = function(data, lateness)
{
	// Reset the timer
	if (data.timerRepeat === undefined)
		this.timer = undefined;

	this.UnitFsm.ProcessMessage(this, {"type": "Timer", "data": data, "lateness": lateness});
};
AnimalAI.prototype.StartTimer = function(offset, repeat)
{
	if (this.timer)
		error("Called StartTimer when there's already an active timer");

	let data = { "timerRepeat": repeat };

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	if (repeat === undefined)
		this.timer = cmpTimer.SetTimeout(this.entity, IID_UnitAI, "TimerHandler", offset, data);
	else
		this.timer = cmpTimer.SetInterval(this.entity, IID_UnitAI, "TimerHandler", offset, repeat, data);
};
AnimalAI.prototype.StopTimer = function()
{
	if (!this.timer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	cmpTimer.CancelTimer(this.timer);
	this.timer = undefined;
};
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// -------------------------MESSAGES -----------------------------
// ---------------------------------------------------------------
// ---------------------------------------------------------------
AnimalAI.prototype.OnMotionChanged = function(msg)
{
	if (msg.starting && !msg.error)
		this.UnitFsm.ProcessMessage(this, {"type": "MoveStarted", "data": msg});
	else if (!msg.starting || msg.error)
		this.UnitFsm.ProcessMessage(this, {"type": "MoveCompleted", "data": msg});
};
AnimalAI.prototype.OnGlobalEntityRenamed = function(msg)
{
	let changed = false;
	for (let order of this.orderQueue)
	{
		if (order.data && order.data.target && order.data.target == msg.entity)
		{
			changed = true;
			order.data.target = msg.newentity;
		}
		if (order.data && order.data.formationTarget && order.data.formationTarget == msg.entity)
		{
			changed = true;
			order.data.formationTarget = msg.newentity;
		}
	}
	if (changed)
		Engine.PostMessage(this.entity, MT_UnitAIOrderDataChanged, { "to": this.GetOrderData() });
};
AnimalAI.prototype.OnAttacked = function(msg)
{
	this.UnitFsm.ProcessMessage(this, {"type": "Attacked", "data": msg});
	this.WarnNearbyUnitsOfAttack(msg.attacker);
};
AnimalAI.prototype.OnGuardedAttacked = function(msg)
{
	this.UnitFsm.ProcessMessage(this, {"type": "GuardedAttacked", "data": msg.data});
};
AnimalAI.prototype.OnHealthChanged = function(msg)
{
	this.UnitFsm.ProcessMessage(this, {"type": "HealthChanged", "from": msg.from, "to": msg.to});
};
AnimalAI.prototype.OnNearbyUnitAttacked = function(msg)
{
	this.UnitFsm.ProcessMessage(this, {"type": "NearbyAttacked", "data": msg});
}
AnimalAI.prototype.OnRangeUpdate = function(msg)
{
	if (msg.tag == this.losRangeQuery)
		this.UnitFsm.ProcessMessage(this, {"type": "LosRangeUpdate", "data": msg});
};
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// -------------------------FUNCTIONS-----------------------------
// ---------------------------------------------------------------
// ---------------------------------------------------------------
AnimalAI.prototype.WarnNearbyUnitsOfAttack = function(attacker)
{
	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	if (!cmpOwnership)
		return;
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	let player = [cmpOwnership.GetOwner()];
	let range = 20;
	let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
	if (cmpVision)
		range = Math.max(range, cmpVision.GetRange());
	let nearby = cmpRangeManager.ExecuteQuery(this.entity, 0, range, player, IID_UnitAI);
	for (let ent of nearby)
		 Engine.PostMessage(ent, MT_NearbyUnitAttacked, { "attacker": attacker, "target": this.entity });
};
AnimalAI.prototype.GetWalkSpeed = function()
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	let walkSpeed = cmpUnitMotion.GetWalkSpeed();
	let health = 1.0;
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (cmpHealth)
		health = cmpHealth.GetHitpoints()/cmpHealth.GetMaxHitpoints();
	let ws = cmpUnitMotion.GetWalkSpeed();
	return (walkSpeed/2.0) + (walkSpeed/2.0)*health;
};
AnimalAI.prototype.GetRunSpeed = function()
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	let runSpeed = cmpUnitMotion.GetRunSpeed();
	let walkSpeed = cmpUnitMotion.GetWalkSpeed();
	if (runSpeed <= walkSpeed)
		return runSpeed;
	let cmpHealth = Engine.QueryInterface(this.entity, IID_Health);
	let health = cmpHealth.GetHitpoints()/cmpHealth.GetMaxHitpoints();
	return (health*runSpeed + (1-health)*walkSpeed);
};
AnimalAI.prototype.TargetIsAlive = function(ent)
{
	let cmpHealth = QueryMiragedInterface(ent, IID_Health);
	return cmpHealth && cmpHealth.GetHitpoints() != 0;
};
AnimalAI.prototype.StopMoving = function()
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (cmpUnitMotion)
		cmpUnitMotion.StopMoving();
};
AnimalAI.prototype.SetAnimationVariant = function(type)
{
	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (!cmpVisual)
		return;

	cmpVisual.SetVariant("animationVariant", type);
};
AnimalAI.prototype.SetDefaultAnimationVariant = function()
{
	this.SetAnimationVariant("");
};
AnimalAI.prototype.SelectAnimation = function(name, once = false, speed = 1.0)
{
	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (!cmpVisual)
		return;
	if (name == "move")
		cmpVisual.SelectMovementAnimation((this.GetWalkSpeed() + this.GetRunSpeed()) / 2);
	else
		cmpVisual.SelectAnimation(name, once, speed);
};
AnimalAI.prototype.SetAnimationSync = function(actiontime, repeattime)
{
	let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
	if (!cmpVisual)
		return;
	cmpVisual.SetAnimationSyncRepeat(repeattime);
	cmpVisual.SetAnimationSyncOffset(actiontime);
};
AnimalAI.prototype.MoveToPoint = function(x, z)
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.MoveToPointRange(x, z, 0, 0);
};
AnimalAI.prototype.MoveToPointRange = function(x, z, rangeMin, rangeMax)
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.MoveToPointRange(x, z, rangeMin, rangeMax);
};
AnimalAI.prototype.MoveToTarget = function(target)
{
	if (!this.CheckTargetVisible(target))
		return false;
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.MoveToTargetRange(target, 0, 0);
};
AnimalAI.prototype.MoveToTargetRange = function(target, iid, type)
{
	if (this.IsTurret() && !this.CheckTargetVisible(target))
		return false;
	let cmpRanged = Engine.QueryInterface(this.entity, iid);
	if (!cmpRanged)
		return false;
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;	
	let range = cmpRanged.GetRange(type);
	return cmpUnitMotion.MoveToTargetRange(target, range.min, range.max);
};
AnimalAI.prototype.MoveToTargetAttackRange = function(target, type)
{
	if (!this.CheckTargetVisible(target))
		return false;
	if (type != "Ranged")
		return this.MoveToTargetRange(target, IID_Attack, type);

	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return false;

	let targetCmpPosition = Engine.QueryInterface(target, IID_Position);
	if (!targetCmpPosition.IsInWorld())
		return false;
	
	let thisCmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!thisCmpPosition.IsInWorld())
		return false;
	
	let s = thisCmpPosition.GetPosition();
	let t = targetCmpPosition.GetPosition();
	let range = cmpAttack.GetRange(type);
	// h is positive when I'm higher than the target
	let h = s.y-t.y+range.elevationBonus;

	let parabolicMaxRange = 0;
	// No negative roots please
	if (h>-range.max/2)
		parabolicMaxRange = Math.sqrt(Math.square(range.max) + 2 * range.max * h);

	// the parabole changes while walking, take something in the middle
	let guessedMaxRange = (range.max + parabolicMaxRange)/2;

	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	
	if (cmpUnitMotion.MoveToTargetRange(target, range.min, guessedMaxRange))
		return true;

	// if that failed, try closer
	return cmpUnitMotion.MoveToTargetRange(target, range.min, Math.min(range.max, parabolicMaxRange));
};
AnimalAI.prototype.MoveToTargetRangeExplicit = function(target, min, max)
{
	if (!this.CheckTargetVisible(target))
		return false;
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.MoveToTargetRange(target, min, max);
};
AnimalAI.prototype.CheckPointRangeExplicit = function(x, z, min, max)
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.IsInPointRange(x, z, min, max);
};
AnimalAI.prototype.CheckTargetRange = function(target, iid, type)
{
	let cmpRanged = Engine.QueryInterface(this.entity, iid);
	if (!cmpRanged)
		return false;
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	let range = cmpRanged.GetRange(type);
	return cmpUnitMotion.IsInTargetRange(target, range.min, range.max);
};
AnimalAI.prototype.CheckTargetAttackRange = function(target, type)
{
	if (type != "Ranged")
		return this.CheckTargetRange(target, IID_Attack, type);

	let targetCmpPosition = Engine.QueryInterface(target, IID_Position);
	if (!targetCmpPosition || !targetCmpPosition.IsInWorld())
		return false;
	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return false;
	let thisCmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!thisCmpPosition.IsInWorld())
		return false;

	let s = thisCmpPosition.GetPosition();
	let t = targetCmpPosition.GetPosition();
	let range = cmpAttack.GetRange(type);
	let h = s.y-t.y+range.elevationBonus;
	let maxRangeSq = 2*range.max*(h + range.max/2);

	if (maxRangeSq < 0)
		return false;

	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.IsInTargetRange(target, range.min, Math.sqrt(maxRangeSq));
};
AnimalAI.prototype.CheckTargetRangeExplicit = function(target, min, max)
{
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpUnitMotion)
		return false;
	return cmpUnitMotion.IsInTargetRange(target, min, max);
};
AnimalAI.prototype.CheckTargetVisible = function(target)
{
	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	if (!cmpOwnership)
		return false;

	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	if (!cmpRangeManager)
		return false;

	// Entities that are hidden and miraged are considered visible
	let cmpFogging = Engine.QueryInterface(target, IID_Fogging);
	if (cmpFogging && cmpFogging.IsMiraged(cmpOwnership.GetOwner()))
		return true;

	if (cmpRangeManager.GetLosVisibility(target, cmpOwnership.GetOwner()) == "hidden")
		return false;

	// Either visible directly, or visible in fog
	return true;
};
AnimalAI.prototype.FaceTowardsTarget = function(target)
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return;
	let cmpTargetPosition = Engine.QueryInterface(target, IID_Position);
	if (!cmpTargetPosition || !cmpTargetPosition.IsInWorld())
		return;
	let targetpos = cmpTargetPosition.GetPosition2D();
	let angle = cmpPosition.GetPosition2D().angleTo(targetpos);
	let rot = cmpPosition.GetRotation();
	let delta = (rot.y - angle + Math.PI) % (2 * Math.PI) - Math.PI;
	if (Math.abs(delta) > 0.2)
	{
		let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
		if (cmpUnitMotion)
			cmpUnitMotion.FaceTowardsPoint(targetpos.x, targetpos.y);
	}
};
AnimalAI.prototype.CheckTargetDistanceFromHeldPosition = function(target, iid, type)
{
	let cmpRanged = Engine.QueryInterface(this.entity, iid);
	let range = iid !== IID_Attack ? cmpRanged.GetRange() : cmpRanged.GetRange(type);

	let cmpPosition = Engine.QueryInterface(target, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return false;

	let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
	if (!cmpVision)
		return false;
	let halfvision = cmpVision.GetRange() / 2;

	let pos = cmpPosition.GetPosition();
	let heldPosition = this.heldPosition;
	if (heldPosition === undefined)
		heldPosition = { "x": pos.x, "z": pos.z };

	return Math.euclidDistance2D(pos.x, pos.z, heldPosition.x, heldPosition.z) < halfvision + range.max;
};
AnimalAI.prototype.CheckTargetIsInVisionRange = function(target)
{
	let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
	if (!cmpVision)
		return false;
	let range = cmpVision.GetRange();
	let distance = DistanceBetweenEntities(this.entity, target);
	return distance < range;
};
AnimalAI.prototype.GetBestAttackAgainst = function(target, allowCapture)
{
	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return undefined;
	return cmpAttack.GetBestAttackAgainst(target, allowCapture);
};
AnimalAI.prototype.AttackVisibleEntity = function(ents)
{
	let target = ents.find(target => this.CanAttack(target));
	if (!target)
		return false;
	this.PushOrderFront("Attack", { "target": target, "force": false, "allowCapture": true });
	return true;
};
AnimalAI.prototype.AttackEntityInZone = function(ents)
{
	let target = ents.find(target =>
		this.CanAttack(target)
		&& this.CheckTargetDistanceFromHeldPosition(target, IID_Attack, this.GetBestAttackAgainst(target, true))
		&& (this.GetStance().respondChaseBeyondVision || this.CheckTargetIsInVisionRange(target))
	);
	if (!target)
		return false;

	this.PushOrderFront("Attack", { "target": target, "force": false, "allowCapture": true });
	return true;
};
AnimalAI.prototype.RespondToTargetedEntities = function(ents)
{
	if (!ents.length)
		return false;

	if (this.GetStance().respondChase)
		return this.AttackVisibleEntity(ents);

	if (this.GetStance().respondStandGround)
		return this.AttackVisibleEntity(ents);

	if (this.GetStance().respondHoldGround)
		return this.AttackEntityInZone(ents);

	if (this.GetStance().respondFlee)
	{
		this.PushOrderFront("Flee", { "target": ents[0], "force": false });
		return true;
	}

	return false;
};
AnimalAI.prototype.ShouldAbandonChase = function(target, force, iid, type)
{
	// Forced orders shouldn't be interrupted.
	if (force)
		return false;

	// If we are guarding/escorting, don't abandon as long as the guarded unit is in target range of the attacker
	if (this.isGuardOf)
	{
		let cmpAnimalAI =  Engine.QueryInterface(target, IID_UnitAI);
		let cmpAttack = Engine.QueryInterface(target, IID_Attack);
		if (cmpAnimalAI && cmpAttack &&
		    cmpAttack.GetAttackTypes().some(type => cmpAnimalAI.CheckTargetAttackRange(this.isGuardOf, type)))
				return false;
	}

	// Stop if we're in hold-ground mode and it's too far from the holding point
	if (this.GetStance().respondHoldGround)
		if (!this.CheckTargetDistanceFromHeldPosition(target, iid, type))
			return true;

	// Stop if it's left our vision range, unless we're especially persistent
	if (!this.GetStance().respondChaseBeyondVision)
		if (!this.CheckTargetIsInVisionRange(target))
			return true;

	// (Note that CCmpUnitMotion will detect if the target is lost in FoW,
	// and will continue moving to its last seen position and then stop)
	return false;
};
AnimalAI.prototype.ShouldChaseTargetedEntity = function(target, force)
{
	if (this.IsTurret())
		return false;

	if (force || this.GetStance().respondChase)
		return true;

	// If we are guarding/escorting, chase at least as long as the guarded unit is in target range of the attacker
	if (this.isGuardOf)
	{
		let cmpAnimalAI =  Engine.QueryInterface(target, IID_UnitAI);
		let cmpAttack = Engine.QueryInterface(target, IID_Attack);
		if (cmpAnimalAI && cmpAttack &&
		    cmpAttack.GetAttackTypes().some(type => cmpAnimalAI.CheckTargetAttackRange(this.isGuardOf, type)))
			return true;
	}

	return false;
};

// --------------------------------------------------
// --------------------------------------------------
// --------------Extentions--------------------------
// --------------------------------------------------
// --------------------------------------------------
AnimalAI.prototype.AddOrder = function(type, data, queued)
{
	if (this.expectedRoute)
		this.expectedRoute = undefined;

	if (queued)
		this.PushOrder(type, data);
	else
	{
		// May happen if an order arrives on the same turn the unit is garrisoned
		// in that case, just forget the order as this will lead to an infinite loop
		if (this.IsGarrisoned() && !this.IsTurret() && type != "Ungarrison")
			return;
		this.ReplaceOrder(type, data);
	}
};
AnimalAI.prototype.Walk = function(x, z, queued)
{
	if (this.expectedRoute && queued)
		this.expectedRoute.push({ "x": x, "z": z });
	else
		this.AddOrder("Walk", { "x": x, "z": z, "force": true }, queued);
};
AnimalAI.prototype.WalkToPointRange = function(x, z, min, max, queued)
{
	this.AddOrder("Walk", { "x": x, "z": z, "min": min, "max": max, "force": true }, queued);
};
AnimalAI.prototype.Stop = function(queued)
{
	this.AddOrder("Stop", { "force": true }, queued);
};
AnimalAI.prototype.WalkToTarget = function(target, queued)
{
	this.AddOrder("WalkToTarget", { "target": target, "force": true }, queued);
};
AnimalAI.prototype.WalkAndFight = function(x, z, targetClasses, allowCapture = true, queued = false)
{
	this.AddOrder("WalkAndFight", { "x": x, "z": z, "targetClasses": targetClasses, "allowCapture": allowCapture, "force": true }, queued);
};
AnimalAI.prototype.LeaveFoundation = function(target)
{
	if (this.order && (this.order.type == "LeaveFoundation" || (this.order.type == "Flee" && this.order.data.target == target)))
		return;

	this.PushOrderFront("LeaveFoundation", { "target": target, "force": true });
};
AnimalAI.prototype.Attack = function(target, allowCapture = true, queued = false)
{
	if (!this.CanAttack(target))
	{
		// We don't want to let healers walk to the target unit so they can be easily killed.
		// Instead we just let them get into healing range.
		this.WalkToTarget(target, queued);
		return;
	}
	this.AddOrder("Attack", { "target": target, "force": true, "allowCapture": allowCapture}, queued);
};
AnimalAI.prototype.Rotate = function(target, queued = false)
{
	this.AddOrder("Rotate", {"position": target, "force": true}, queued);
}
AnimalAI.prototype.Flee = function(target, queued)
{
	this.AddOrder("Flee", { "target": target, "force": false }, queued);
};
AnimalAI.prototype.SetStance = function(stance)
{
	if (g_Stances[stance])
	{
		this.stance = stance;
		this.SetDefaultAnimationVariant();
		Engine.PostMessage(this.entity, MT_UnitStanceChanged, { "to": this.stance });
	}
	else
		error("AnimalAI: Setting to invalid stance '"+stance+"'");
};
AnimalAI.prototype.SwitchToStance = function(stance)
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return;
	let pos = cmpPosition.GetPosition();
	this.SetHeldPosition(pos.x, pos.z);

	this.SetStance(stance);
	// Stop moving if switching to stand ground
	// TODO: Also stop existing orders in a sensible way
	if (stance == "standground")
		this.StopMoving();

	// Reset the range queries, since the range depends on stance.
	this.SetupRangeQueries();
};
AnimalAI.prototype.FindNewTargets = function()
{
	if (!this.losRangeQuery)
		return false;

	if (!this.GetStance().targetVisibleEnemies)
		return false;

	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	return this.AttackEntitiesByPreference(cmpRangeManager.ResetActiveQuery(this.losRangeQuery));
};
AnimalAI.prototype.GetTargetsFromUnit = function()
{
	if (!this.losRangeQuery)
		return [];

	if (!this.GetStance().targetVisibleEnemies)
		return [];

	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return [];

	let attackfilter = function(e) {
		let cmpOwnership = Engine.QueryInterface(e, IID_Ownership);
		if (cmpOwnership && cmpOwnership.GetOwner() > 0)
			return true;
		let cmpUnitAI = Engine.QueryInterface(e, IID_UnitAI);
		return cmpUnitAI && (!cmpUnitAI.IsAnimal() || cmpUnitAI.IsDangerousAnimal());
	};

	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	let entities = cmpRangeManager.ResetActiveQuery(this.losRangeQuery);
	let targets = entities.filter(function(v) { return  attackfilter(v) && cmpAttack.CanAttack(v); })
		.sort(function(a, b) { return cmpAttack.CompareEntitiesByPreference(a, b); });

	return targets;
};
AnimalAI.prototype.FindWalkAndFightTargets = function()
{
	let targets = this.GetTargetsFromUnit();
	for (let targ of targets)
	{
		if (this.order.data.targetClasses)
		{
			let cmpIdentity = Engine.QueryInterface(targ, IID_Identity);
			if (!cmpIdentity)
				continue;
			let targetClasses = this.order.data.targetClasses;
			let cl = cmpIdentity.GetClassesList();
			if (targetClasses.attack && !MatchesClassList(cl, targetClasses.attack))
				continue;
			if (targetClasses.avoid && MatchesClassList(cl, targetClasses.avoid))
				continue;
			// Only used by the AIs to prevent some choices of targets
			if (targetClasses.vetoEntities && targetClasses.vetoEntities[targ])
				continue;
		}
		this.PushOrderFront("Attack", { "target": targ, "force": false, "allowCapture": this.order.data.allowCapture });
		return true;
	}
	return false;
};
AnimalAI.prototype.GetQueryRange = function(iid)
{
	let ret = { "min": 0, "max": 0 };
	if (this.GetStance().respondStandGround)
	{
		let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
		if (!cmpVision)
			return ret;
		let cmpRanged = Engine.QueryInterface(this.entity, iid);
		if (!cmpRanged)
			return ret;
		let range = iid !== IID_Attack ? cmpRanged.GetRange() : cmpRanged.GetFullAttackRange();
		ret.min = range.min;
		ret.max = Math.min(range.max, cmpVision.GetRange());
	}
	else if (this.GetStance().respondChase)
	{
		let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
		if (!cmpVision)
			return ret;
		ret.max = cmpVision.GetRange();
	}
	else if (this.GetStance().respondHoldGround)
	{
		let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
		if (!cmpVision)
			return ret;
		let cmpRanged = Engine.QueryInterface(this.entity, iid);
		if (!cmpRanged)
			return ret;
		let range = iid !== IID_Attack ? cmpRanged.GetRange() : cmpRanged.GetFullAttackRange();
		let vision = cmpVision.GetRange();
		ret.max = Math.min(range.max + vision / 2, vision);
	}
	// We probably have stance 'passive' and we wouldn't have a range,
	// but as it is the default for healers we need to set it to something sane.
	else if (iid === IID_Heal)
	{
		let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
		if (!cmpVision)
			return ret;
		ret.max = cmpVision.GetRange();
	}
	return ret;
};
AnimalAI.prototype.GetStance = function()
{
	return g_Stances[this.stance];
};
AnimalAI.prototype.GetSelectableStances = function()
{
	if (this.IsTurret())
		return [];
	return Object.keys(g_Stances).filter(key => g_Stances[key].selectable);
};
AnimalAI.prototype.GetStanceName = function()
{
	return this.stance;
};
AnimalAI.prototype.SetMoveSpeed = function(speed)
{
	let cmpMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (cmpMotion)
		cmpMotion.SetSpeed(speed);
};
AnimalAI.prototype.SetHeldPosition = function(x, z)
{
	this.heldPosition = {"x": x, "z": z};
};
AnimalAI.prototype.WalkToHeldPosition = function()
{
	if (!this.heldPosition)
		return false;
	
	this.AddOrder("Walk", { "x": this.heldPosition.x, "z": this.heldPosition.z, "force": false }, false);
	return true;
};
// ----------------------------------------------------
// ----------------------------------------------------
// --------Helper functions ---------------------------
// ----------------------------------------------------
// ----------------------------------------------------
AnimalAI.prototype.CanAttack = function(target)
{
	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	return cmpAttack && cmpAttack.CanAttack(target);
};
AnimalAI.prototype.MoveRandomly = function(distance)
{
	// To minimize drift all across the map, animals describe circles
	// approximated by polygons.
	// And to avoid getting stuck in obstacles or narrow spaces, each side
	// of the polygon is obtained by trying to go away from a point situated
	// half a meter backwards of the current position, after rotation.
	// We also add a fluctuation on the length of each side of the polygon (dist)
	// which, in addition to making the move more random, helps escaping narrow spaces
	// with bigger values of dist.

	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	let cmpUnitMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (!cmpPosition || !cmpUnitMotion || !cmpPosition.IsInWorld())
		return;

	let pos = cmpPosition.GetPosition();
	let ang = cmpPosition.GetRotation().y;

	if (!this.roamAngle)
	{
		this.roamAngle = (randBool() ? 1 : -1) * Math.PI / 6;
		ang -= this.roamAngle / 2;
		this.startAngle = ang;
	}
	else if (Math.abs((ang - this.startAngle + Math.PI) % (2 * Math.PI) - Math.PI) < Math.abs(this.roamAngle / 2))
		this.roamAngle *= randBool() ? 1 : -1;

	let halfDelta = randFloat(this.roamAngle / 4, this.roamAngle * 3 / 4);
	// First half rotation to decrease the impression of immediate rotation
	ang += halfDelta;
	cmpUnitMotion.FaceTowardsPoint(pos.x + 0.5 * Math.sin(ang), pos.z + 0.5 * Math.cos(ang));
	// Then second half of the rotation
	ang += halfDelta;
	let dist = randFloat(0.5, 1.5) * distance;
	cmpUnitMotion.MoveToPointRange(pos.x - 0.5 * Math.sin(ang), pos.z - 0.5 * Math.cos(ang), dist, dist);
};
AnimalAI.prototype.SetFacePointAfterMove = function(val)
{
	let cmpMotion = Engine.QueryInterface(this.entity, IID_UnitMotion);
	if (cmpMotion)
		cmpMotion.SetFacePointAfterMove(val);
};
AnimalAI.prototype.AttackEntitiesByPreference = function(ents)
{
	if (!ents.length)
		return false;

	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return false;

	let attackfilter = function(e) {
		let cmpOwnership = Engine.QueryInterface(e, IID_Ownership);
		if (cmpOwnership && cmpOwnership.GetOwner() > 0)
			return true;
		let cmpUnitAI = Engine.QueryInterface(e, IID_UnitAI);
		return cmpUnitAI && (!cmpUnitAI.IsAnimal() || cmpUnitAI.IsDangerousAnimal());
	};

	let entsByPreferences = {};
	let preferences = [];
	let entsWithoutPref = [];
	for (let ent of ents)
	{
		if (!attackfilter(ent))
			continue;
		let pref = cmpAttack.GetPreference(ent);
		if (pref === null || pref === undefined)
			entsWithoutPref.push(ent);
		else if (!entsByPreferences[pref])
		{
			preferences.push(pref);
			entsByPreferences[pref] = [ent];
		}
		else
			entsByPreferences[pref].push(ent);
	}

	if (preferences.length)
	{
		preferences.sort((a, b) => a - b);
		for (let pref of preferences)
			if (this.RespondToTargetedEntities(entsByPreferences[pref]))
				return true;
	}

	return this.RespondToTargetedEntities(entsWithoutPref);
};

// Something to silently ignore
AnimalAI.prototype.GetFormationController = function()
{
	return undefined;
}
AnimalAI.prototype.SetFormationController = function(entity)
{}
AnimalAI.prototype.CanGuard = function()
{
	return false;
}
AnimalAI.prototype.IsGuardOf = function()
{
	return undefined;
}
AnimalAI.prototype.CanPatrol = function()
{
	return false;
}
AnimalAI.prototype.IsGarrisoned = function()
{
	return false;
}
AnimalAI.prototype.IsFormationController = function()
{
	return false;
}
AnimalAI.prototype.IsFormationMember = function()
{
	return false;
}
AnimalAI.prototype.Run = function()
{
	// TODO
}
AnimalAI.prototype.GetFormationTemplate = function()
{
	return "special/formations/null";
}
AnimalAI.prototype.UnitFsm = new FSM(AnimalAI.prototype.UnitFsmSpec);

Engine.RegisterComponentType(IID_UnitAI, "AnimalAI", AnimalAI);

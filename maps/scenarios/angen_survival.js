var survival_rank = "Elite";

var scaleByTime = (minCurrent, min0, min60) => min0 + (min60 - min0) * Math.min(1, minCurrent / 60);

var scaleByWawe = (n, min, max, step) => min + Math.min(max, n*step);

var survival_maxPop = 80;

var survival_attackerGroup_triggerPointPatrol = "A";

var survival_templateClasses = deepfreeze({
	"heroes": "Hero",
	"champions": "Champion+!Elephant",
	"elephants": "Champion+Elephant",
	"champion_infantry": "Champion+Infantry",
	"champion_infantry_melee": "Champion+Infantry+Melee",
	"champion_infantry_ranged": "Champion+Infantry+Ranged",
	"champion_infantry_archer": "Champion+Infantry+Archer",
	"champion_cavalry": "Champion+Cavalry",
	"champion_cavalry_melee": "Champion+Cavalry+Melee",
	"citizenSoldiers": "CitizenSoldier",
	"infantry_archer": "Infantry+Archer+!Champion",
	"infantry_slinger": "Infantry+Sling+!Champion",
	"infantry_spearman": "Infantry+Spear+!Champion",
	"infantry_hoplite": "Infantry+Hoplite+!Champion",
	"infantry_swordman": "Infantry+Sword+!Champion",
	"infantry": "CitizenSoldier+Infantry",
	"infantry_melee": "CitizenSoldier+Infantry+Melee",
	"infantry_ranged": "CitizenSoldier+Infantry+Ranged",
	"cavalry": "CitizenSoldier+Cavalry",
	"cavalry_melee": "CitizenSoldier+Cavalry+Melee",
	"siege": "Siege+Ranged",
	"healers": "Healer",
	"citizen": "Citizen",
	"females": "FemaleCitizen"
});

var survival_templates = deepfreeze(
	Object.keys(survival_templateClasses).reduce(
		(templates, name) => {
			templates[name] = TriggerHelper.GetTemplateNamesByClasses(
				survival_templateClasses[name],
				"athen",
				undefined,
				survival_rank,
				true
			);
			return templates;
		},
		{}
	)
);

var survival_playerID = 2;

var survival_buildingGarrison = [
	{
		"buildingClasses": ["Outpost"],
		"unitTemplates": survival_templates.infantry_archer,
		"capacityRatio": 1
	},
	{
		"buildingClasses": ["StoneTower"],
		"unitTemplates": survival_templates.infantry_archer,
		"capacityRatio": 1
	},
	{
		"buildingClasses": ["WallTower"],
		"unitTemplates": survival_templates.infantry_archer,
		"capacityRatio": 1
	},
	{
		"buildingClasses": ["PalisadeTower"],
		"unitTemplates": survival_templates.infantry_archer,
		"capacityRatio": 1
	},
	{
		"buildingClasses": ["Fortress"],
		"unitTemplates": survival_templates.infantry_archer,
		"capacityRatio": 1
	},
	{
		"buildingClasses": ["CivilCentre"],
		"unitTemplates": survival_templates.females,
		"capacityRatio": 0.1
	},
	
];

var survival_attackerGroup_balancing = [
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 0,
		"stopAfterWawe": 1,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 5, 10, 5),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.infantry_slinger,
						"frequency": 1
					}
				],
				"targetClasses": () => "Citizen"	
			}
		],		
	},
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 1,
		"stopAfterWawe": 3,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 10, 20, 5),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.cavalry,
						"frequency": 1
					}
				],
				"targetClasses": () => "Citizen"	
			}
		],		
	},
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 3,
		"stopAfterWawe": 6,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 20, 30, 6),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.infantry_archer,
						"frequency": 3
					},
					{
						"templates": survival_templates.infantry_hoplite,
						"frequency": 1
					},
					{
						"templates": survival_templates.infantry_swordman,
						"frequency": 1
					}
				],
				"targetClasses": () => "Unit"
			}
		]
	},
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 6,
		"stopAfterWawe": 8,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 20, 45, 10),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.infantry_archer,
						"frequency": 2
					},
					{
						"templates": survival_templates.infantry_spearman,
						"frequency": 1
					},
					{
						"templates": survival_templates.infantry_melee,
						"frequency": 2
					},
					{
						"templates": survival_templates.cavalry_melee,
						"frequency": 2
					}
				],
				"targetClasses": () => "Unit"
			}
		]
	},
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 8,
		"stopAfterWawe": 10,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 40, 70, 10),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.infantry_archer,
						"frequency": 1
					},
					{
						"templates": survival_templates.champion_infantry_archer,
						"frequency": 2
					},
					{
						"templates": survival_templates.champion_infantry,
						"frequency": 1
					},
					{
						"templates": survival_templates.cavalry_melee,
						"frequency": 2
					},
					{
						"templates": survival_templates.cavalry,
						"frequency": 1
					}
				],
				"targetClasses": () => "Unit"
			}
		]
	},
	{
		"buildingClasses": ["Fortress"],
		"startAtWawe": 7,
		"stopAfterWawe": -1,
		"wawe": [
			{
				"unitCount": time => scaleByWawe(time, 60, 80, 10),
				"unitComposition": (time) => [
					{
						"templates": survival_templates.champion_infantry_archer,
						"frequency": 1
					},
					{
						"templates": survival_templates.champion_infantry,
						"frequency": 1
					},
				],
				"targetClasses": () => "Unit"
			},
		],
	}
];

Trigger.prototype.Survival_Init = function()
{
	this.wawe = 0;
	this.RegisterTrigger("OnOwnershipChanged", "Survival_OwnershipChange", { "enabled": true });

	this.Survival_GarrisonBuildings();
	this.Survival_TrackUnits();
	
	this.Survival_StartAttackTimer(5);

}
Trigger.prototype.Survival_GarrisonBuildings = function()
{
	for (let buildingGarrison of survival_buildingGarrison)
		TriggerHelper.SpawnAndGarrisonAtClasses(survival_playerID, buildingGarrison.buildingClasses, buildingGarrison.unitTemplates, buildingGarrison.capacityRatio);
}

Trigger.prototype.Survival_DisableComp = function(ent)
{
	let cmpConsume = Engine.QueryInterface(ent, IID_Consumer);
	if (cmpConsume)
		cmpConsume.Disable();
	let cmpPay = Engine.QueryInterface(ent, IID_Payed);
	if (cmpPay)
		cmpPay.Disable();
}

Trigger.prototype.Survival_TrackUnits = function()
{
	this.survival_attackerUnits = [];
	
	this.survival_attackerGroupSpawnPoints = TriggerHelper.GetPlayerEntitiesByClass(
		survival_playerID,
		survival_attackerGroup_balancing.reduce(
			(classes, attackerSpawning) => classes.concat(
				attackerSpawning.buildingClasses
			),
			[]
		)
	);
	
	// Disable survival components
	let units = TriggerHelper.GetPlayerEntitiesByClass(survival_playerID, "Unit");
	for (let ent of units)
		this.Survival_DisableComp(ent);
	
	this.numInitialSpawnPoints = this.survival_attackerGroupSpawnPoints.length;
}
Trigger.prototype.Survival_SpawnTemplates = function(spawnEnt, templateCounts)
{
	let groupEntities = [];
	for (let templateName in templateCounts)
	{
		let ents = TriggerHelper.SpawnUnits(spawnEnt, templateName, templateCounts[templateName], survival_playerID);
		for (let ent of ents) {
			this.Survival_DisableComp(ent);
			let cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
			if (cmpUnitAI)
				cmpUnitAI.SetStance("aggressive");
		}
		groupEntities = groupEntities.concat(ents);
	}

	return groupEntities;
}
Trigger.prototype.Survival_SpawnAttackerGroups = function()
{
	if (!this.survival_attackerGroupSpawnPoints)
		return;
	
	let time = TriggerHelper.GetMinutes();
	this.Survival_StartAttackTimer(10);
	
	let activePlayers = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager).GetActivePlayers();
	activePlayers = activePlayers.filter((player) => {return player != survival_playerID});
	let playerEntities = activePlayers.map(playerID =>
		TriggerHelper.GetEntitiesByPlayer(playerID).filter(TriggerHelper.IsInWorld));

	let patrolPoints = this.GetTriggerPoints(survival_attackerGroup_triggerPointPatrol);
	let groupSizeFactor = 1;
	
	let totalSpawnCount = 0;
	
	for (let spawnPointBalancing of survival_attackerGroup_balancing)
	{
		if (spawnPointBalancing.startAtWawe > this.wawe)
			continue;
		if (spawnPointBalancing.stopAfterWawe > -1 && spawnPointBalancing.stopAfterWawe < this.wawe)
			continue;
		let w = this.wawe - spawnPointBalancing.startAtWawe;
		if (w > spawnPointBalancing.wawe.length - 1)
			w = spawnPointBalancing.wawe.length - 1;
				
		let targets = playerEntities.reduce((allTargets, playerEnts) =>
			allTargets.concat(shuffleArray(TriggerHelper.MatchEntitiesByClass(playerEnts, spawnPointBalancing.wawe[w].targetClasses())).slice(0, 10)), []);

		if (!targets.length) {
			warn("no targets");
			continue;
		}

		for (let spawnEnt of TriggerHelper.MatchEntitiesByClass(this.survival_attackerGroupSpawnPoints, spawnPointBalancing.buildingClasses))
		{
			let unitCount = groupSizeFactor * spawnPointBalancing.wawe[w].unitCount(w);
			
			unitCount = Math.min(unitCount, survival_maxPop - this.survival_attackerUnits.length);
			if (unitCount <= 0) {
				warn("pop " + this.survival_attackerUnits.length);
				continue;
			}
			
			totalSpawnCount += unitCount;
			
			let uc = spawnPointBalancing.wawe[w].unitComposition(w);
			let templateCounts = TriggerHelper.BalancedTemplateComposition(uc, unitCount); 
			
			let spawnedEntities = this.Survival_SpawnTemplates(spawnEnt, templateCounts);
			
			this.survival_attackerUnits = this.survival_attackerUnits.concat(spawnedEntities);
			
			let entityGroups = [spawnedEntities];
			for (let entities of entityGroups) {
				let pos = TriggerHelper.GetEntityPosition2D(pickRandom(targets));
				ProcessCommand(survival_playerID, {
					"type": "patrol",
					"entities": entities,
					"x": pos.x,
					"z": pos.y,
					"targetClasses": {
						"attack": spawnPointBalancing.wawe[w].targetClasses()
					},
					"queued": true,
					"allowCapture": false
				});
			}
		}
	}
	
	this.wawe++;
	
	if (totalSpawnCount)
		Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface).PushNotification({
			"message": markForTranslation("Wawe: "+this.wawe+" "),
			"translateMessage": true
		});
}

Trigger.prototype.Survival_StartAttackTimer = function(delay)
{
	let nextAttack = (1 + delay) * 60 * 1000;
	Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface).AddTimeNotification({
		"message": markForTranslation("Kiara will attack in %(time)s!"),
		"players": [-1, 0, survival_playerID],
		"translateMessage": true
	}, nextAttack);
	this.DoAfterDelay(nextAttack, "Survival_SpawnAttackerGroups", {});
}

Trigger.prototype.Survival_OwnershipChange = function(data)
{
	if (data.from != survival_playerID)
		return;
	
	let track = [
		this.survival_attackerUnits,
		this.survival_attackerGroupSpawnPoints,
	];
	
	for (let array of track) {
		let idx = array.indexOf(data.entity);
		if (idx != -1)
			array.splice(idx, 1);
	}
}

{
	Engine.QueryInterface(SYSTEM_ENTITY, IID_Trigger).RegisterTrigger("OnInitGame", "Survival_Init", { "enabled": true });
}

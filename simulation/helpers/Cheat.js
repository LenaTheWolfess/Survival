function Cheat(input)
{
	let cmpPlayerManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager);
	if (!cmpPlayerManager || input.player < 0)
		return;
	let playerEnt = cmpPlayerManager.GetPlayerByID(input.player);
	if (playerEnt == INVALID_ENTITY)
		return;
	let cmpPlayer = Engine.QueryInterface(playerEnt, IID_Player);
	if (!cmpPlayer)
		return;

	let cmpGuiInterface = Engine.QueryInterface(SYSTEM_ENTITY, IID_GuiInterface);
	if (!cmpPlayer.GetCheatsEnabled())
		return;

	switch(input.action)
	{
	case "addresource":
		cmpPlayer.AddResource(input.text, input.parameter);
		return;
	case "revealmap":
		let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
		cmpRangeManager.SetLosRevealAll(-1, true);
		return;
	case "maxpopulation":
		cmpPlayer.SetPopulationBonuses(500);
		return;
	case "changemaxpopulation":
		cmpPlayer.SetMaxPopulation(500);
		return;
	case "convertunit":
		for (let ent of input.selected)
		{
			let cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
			if (cmpOwnership)
				cmpOwnership.SetOwner(cmpPlayer.GetPlayerID());
		}
		return;
	case "killunits":
		for (let ent of input.selected)
		{
			let cmpHealth = Engine.QueryInterface(ent, IID_Health);
			if (cmpHealth)
				cmpHealth.Kill();
			else
				Engine.DestroyEntity(ent);
		}
		return;
	case "defeatplayer":
		cmpPlayer = QueryPlayerIDInterface(input.parameter);
		if (cmpPlayer)
			cmpPlayer.SetState("defeated", markForTranslation("%(player)s has been defeated (cheat)."));
		return;
	case "createunits":
		let cmpProductionQueue = input.selected.length && Engine.QueryInterface(input.selected[0], IID_ProductionQueue);
		if (!cmpProductionQueue)
		{
			cmpGuiInterface.PushNotification({
				"type": "text",
				"players": [input.player],
				"message": markForTranslation("You need to select a building that trains units."),
				"translateMessage": true
			});
			return;
		}

		for (let i = 0; i < Math.min(input.parameter, cmpPlayer.GetMaxPopulation() - cmpPlayer.GetPopulationCount()); ++i)
			cmpProductionQueue.SpawnUnits(input.templates[i % input.templates.length], 1, null);
		return;
	case "fastactions":
		cmpPlayer.SetCheatTimeMultiplier((cmpPlayer.GetCheatTimeMultiplier() == 1) ? 0.01 : 1);
		return;
	case "changespeed":
		cmpPlayer.SetCheatTimeMultiplier(input.parameter);
		return;
	case "changephase": {
		let cmpTechnologyManager = Engine.QueryInterface(playerEnt, IID_TechnologyManager);
		if (!cmpTechnologyManager)
			return;

		// store the phase we want in the next input parameter
		let parameter;
		if (!cmpTechnologyManager.IsTechnologyResearched("phase_town"))
			parameter = "phase_town";
		else if (!cmpTechnologyManager.IsTechnologyResearched("phase_city"))
			parameter = "phase_city";
		else if (!cmpTechnologyManager.IsTechnologyResearched("phase_empire"))
			parameter = "phase_empire";
		else
			return;

		if (TechnologyTemplates.Has(parameter + "_" + cmpPlayer.civ))
			parameter += "_" + cmpPlayer.civ;
		else
			parameter += "_generic";

		Cheat({ "player": input.player, "action": "researchTechnology", "parameter": parameter, "selected": input.selected });
		return;
	}
	case "researchTechnology": 
	{		if (!input.parameter.length)
			return;

		let techname = input.parameter;
		let cmpTechnologyManager = Engine.QueryInterface(playerEnt, IID_TechnologyManager);
		if (!cmpTechnologyManager)
			return;

		// check, if building is selected
		if (input.selected[0])
		{
			let cmpProductionQueue = Engine.QueryInterface(input.selected[0], IID_ProductionQueue);
			if (cmpProductionQueue)
			{
				// try to spilt the input
				let tmp = input.parameter.split(/\s+/);
				let number = +tmp[0];
				let pair = tmp.length > 1 && (tmp[1] == "top" || tmp[1] == "bottom") ? tmp[1] : "top"; // use top as default value

				// check, if valid number was parsed.
				if (number || number === 0)
				{
					// get name of tech
					let techs = cmpProductionQueue.GetTechnologiesList();
					if (number > 0 && number <= techs.length)
					{
						let tech = techs[number-1];
						if (!tech)
							return;

						// get name of tech
						if (tech.pair)
							techname = tech[pair];
						else
							techname = tech;
					}
					else
						return;
				}
			}
		}

		if (TechnologyTemplates.Has(techname) &&
		    !cmpTechnologyManager.IsTechnologyResearched(techname))
			cmpTechnologyManager.ResearchTechnology(techname);
		return;
	}
	case "metaCheat":
		for (let resource of Resources.GetCodes())
			Cheat({ "player": input.player, "action": "addresource", "text": resource, "parameter": input.parameter });
		Cheat({ "player": input.player, "action": "maxpopulation" });
		Cheat({ "player": input.player, "action": "changemaxpopulation" });
		Cheat({ "player": input.player, "action": "fastactions" });
		for (let i=0; i<3; ++i)
			Cheat({ "player": input.player, "action": "changephase", "selected": input.selected });
		return;
	case "playRetro":
		let play = input.parameter.toLowerCase() != "off";
		cmpGuiInterface.PushNotification({
			"type": "play-tracks",
			"tracks": play && input.parameter.split(" "),
			"lock": play,
			"players": [input.player]
		});
		return;

	default:
		warn("Cheat '" + input.action + "' is not implemented");
		return;
	}
}

Engine.RegisterGlobal("Cheat", Cheat);

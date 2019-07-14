/**
 * Array of structure template names when given a civ and a phase name.
 */
var g_TechList = {};
var g_StartingTechs = {};
var g_SelectedTech = "phase_village";
var g_SelectedBuilding = "structures";

/**
 * Callback function name on closing gui via Engine.PopGuiPage().
 */
var g_Callback = "";

function switchToCivInfoPage()
{
	Engine.PopGuiPage();
	Engine.PushGuiPage("page_civinfo.xml", { "civ": g_SelectedCiv, "callback": g_Callback });
}

function switchToStructPage()
{
	Engine.PopGuiPage();
	Engine.PushGuiPage("page_structree.xml", { "civ": g_SelectedCiv, "callback": g_Callback });
}

/**
 * Initialize the page
 *
 * @param {object} data - Parameters passed from the code that calls this page into existence.
 */
function init(data = {})
{
	if (data.callback)
		g_Callback = data.callback;

	let civList = Object.keys(g_CivData).map(civ => ({
		"name": g_CivData[civ].Name,
		"code": civ,
	})).sort(sortNameIgnoreCase);

	if (!civList.length)
	{
		closePage();
		return;
	}

	g_ParsedData = {
		"units": {},
		"structures": {},
		"techs": {},
		"phases": {}
	};

	let civSelection = Engine.GetGUIObjectByName("civSelection");
	civSelection.list = civList.map(c => c.name);
	civSelection.list_data = civList.map(c => c.code);
	civSelection.selected = data.civ ? civSelection.list_data.indexOf(data.civ) : 0;

	Engine.GetGUIObjectByName("close").tooltip = colorizeHotkey(translate("%(hotkey)s: Close Structure Tree."), "cancel");
}

function close()
{
	if (g_Callback)
		Engine.PopGuiPageCB({ "civ": g_SelectedCiv, "page": "page_techtree.xml" });
	else
		Engine.PopGuiPage();
}

function selectTech(techCode)
{
	if (g_TechList[g_SelectedCiv] && g_TechList[g_SelectedCiv][techCode]) {
		g_SelectedTech = techCode;
	}
}

function selectStruct(structCode)
{
	g_SelectedBuilding = structCode;
	g_SelectedTech = "";
	if (g_StartingTechs[g_SelectedCiv] && g_StartingTechs[g_SelectedCiv][g_SelectedBuilding]) {
		selectTech(g_StartingTechs[g_SelectedCiv][g_SelectedBuilding][0]);
	}
}

/**
 * @param {string} civCode
 */
function selectCiv(civCode)
{
	if (civCode === g_SelectedCiv || !g_CivData[civCode])
		return;

	g_SelectedCiv = civCode;

	g_CurrentModifiers = deriveModifications(g_AutoResearchTechList);

	// If a buildList already exists, then this civ has already been parsed
	if (g_TechList[g_SelectedCiv])
	{
		draw();
		return;
	}

	let templateLists = compileTemplateLists(civCode);

	for (let u of templateLists.units.keys())
		if (!g_ParsedData.units[u])
			g_ParsedData.units[u] = loadEntityTemplate(u);

	
	for (let s of templateLists.structures.keys()) {
		if (!g_ParsedData.structures[s])
			g_ParsedData.structures[s] = loadEntityTemplate(s);
	}

	// Load technologies
	g_ParsedData.techs[civCode] = {};
	for (let techcode of templateLists.techs.keys())
		if (basename(techcode).startsWith("phase"))
			g_ParsedData.phases[techcode] = loadPhase(techcode);
		else
			g_ParsedData.techs[civCode][techcode] = loadTechnology(techcode);

	// Establish phase order
	g_ParsedData.phaseList = UnravelPhases(g_ParsedData.phases);

	// Load any required generic phases that aren't already loaded
	for (let phasecode of g_ParsedData.phaseList)
		if (!g_ParsedData.phases[phasecode])
			g_ParsedData.phases[phasecode] = loadPhase(phasecode);

	let techList = {};
	let startList = {};
	// Get all technologies for selected civ
	for (let structCode of templateLists.structures.keys())
	{
		let structInfo = g_ParsedData.structures[structCode];
		// Add technologies
		for (let prod of structInfo.production.techs)
		{
			if (basename(prod).startsWith("phase"))
				continue;
			let same = false;
			if (!(prod in techList)) {
				techList[prod] = {"require": [], "unlocks": [], "buildings": [], "units": [], "phase": getPhaseOfTemplate(structInfo)};
			}
			let reqs = GetTechSupersedes(prod);
			if (reqs === false)
				continue;
			let pName = getPhaseOfTemplate(structInfo);
			let ptName = getPhaseOfTechnology(prod);
			let pId =  g_ParsedData.phaseList.indexOf(pName);
			// loop through all buildings and return minimum phase
			for (let b of techList[prod].buildings) {
				let bs = g_ParsedData.structures[b];
				pId = Math.min(pId, g_ParsedData.phaseList.indexOf(getPhaseOfTemplate(bs)));
			}
			pId = Math.max(pId, g_ParsedData.phaseList.indexOf(ptName));
			techList[prod].phase = g_ParsedData.phaseList[pId];
		//	warn(prod + " " + "(" + pId + ") "  + techList[prod].phase + " phase of template " + g_ParsedData.phaseList.indexOf(pName) );
			for (let req in reqs) {
				if (basename(reqs[req]).startsWith("phase"))
					continue;
				if (!(reqs[req] in techList)) {
					techList[reqs[req]] = {"require": [], "unlocks": [], "buildings": [], "units": [], "phase": "phase_village"};
				}
				if (techList[reqs[req]].unlocks.indexOf(prod) == -1)
					techList[reqs[req]].unlocks.push(prod);
				if (techList[prod].require.indexOf(reqs[req]) == -1)
					techList[prod].require.push(reqs[req]);
				// do not add to structure root technology if has requirement
				// from the same building
				if (structInfo.production.techs.indexOf(reqs[req]) != -1)
					same = true;
			}	
			if (techList[prod].buildings.indexOf(structCode) == -1)
				techList[prod].buildings.push(structCode);
			if (techList[prod].require.length == 0 || !same) {
				if (!(structCode in startList)) {
					startList[structCode] = [];
				}
				if (startList[structCode].indexOf(prod) == -1)
					startList[structCode].push(prod);
				g_SelectedBuilding = structCode;
				g_SelectedTech = prod;
			}
		}
		// Add units to technologies
		for (let prod of structInfo.production.units)
		{
			let template = g_ParsedData.units[prod];
			if (!template)
				continue;
			let tech = template.requiredTechnology;
			if (tech) {
				if (!(tech in techList)) {
					techList[tech] ={"require": [], "unlocks": [], "buildings": [], "units": [], "phase": "phase_village"};
				}
				if (techList[tech].units.indexOf(prod) == -1)
					techList[tech].units.push(prod);
			}
		}
	}	
	
	g_TechList[g_SelectedCiv] = techList;
	g_StartingTechs[g_SelectedCiv] = startList;
	selectStruct(Object.keys(startList)[0]);
	draw();
}

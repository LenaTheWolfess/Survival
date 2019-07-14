/**
 * Functions used to collate the contents of a tooltip.
 */
var g_StructreeTooltipFunctions = [
	getEntityNamesFormatted,
	getEntityCostTooltip,
	getEntityTooltip,
	getAurasTooltip
].concat(g_StatsFunctions);

/**
 * Draw the techtree
 *
 * (Actually resizes and changes visibility of elements, and populates text)
 */
function draw()
{
	// Set basic state (positioning of elements mainly), but only once
	if (!Object.keys(g_DrawLimits).length)
		predraw();

	let leftMargin = Engine.GetGUIObjectByName("tree_display").size.left;

	let phaseList = g_ParsedData.phaseList;

	Engine.GetGUIObjectByName("civEmblem").sprite = "stretched:" + g_CivData[g_SelectedCiv].Emblem;
	Engine.GetGUIObjectByName("civName").caption = g_CivData[g_SelectedCiv].Name;
	Engine.GetGUIObjectByName("civHistory").caption = g_CivData[g_SelectedCiv].History;Engine.GetGUIObjectByName("root_caption").caption = "";
	Engine.GetGUIObjectByName("pair_caption").caption = "";
	
	let i = 0;
	for (let sc in g_StartingTechs[g_SelectedCiv])
	{
		let structCode = sc;
		let thisEle = Engine.GetGUIObjectByName("struct["+i+"]_icon");
		if (thisEle === undefined)
		{
			error("\""+g_SelectedCiv+"\" has more starting buildings than can be supported by the current GUI layout");
			break;
		}
		let struct = g_ParsedData.structures[structCode];
		if (!struct) {
			warn("structure " + structCode + " is not in parsed data");
			continue;
		}
		let grayscale = g_SelectedBuilding == sc ? "" : "grayscale:";
		thisEle.sprite = "stretched:"+grayscale+"session/portraits/"+struct.icon;
		thisEle.tooltip =  '[font="sans-bold-16"]' + struct.name.generic + '[/font]\n(' + struct.name.specific+")";
		thisEle.onPress = function() {
			selectStruct(structCode);
			draw();
		}
		++i;
	}
	i = 0;
	if (g_StartingTechs[g_SelectedCiv] && g_StartingTechs[g_SelectedCiv][g_SelectedBuilding])
	{
		for (let techCode of g_StartingTechs[g_SelectedCiv][g_SelectedBuilding])
		{
			let thisEle = Engine.GetGUIObjectByName("tech["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more starting techs than can be supported by the current GUI layout");
				break;
			}
			let tech = g_ParsedData.techs[g_SelectedCiv][techCode];
			if (techCode.startsWith("phase")) {
				tech = g_ParsedData.phases[techCode];
			}
			let startTechIcon = Engine.GetGUIObjectByName("tech["+i+"]_icon");
			
			let grayscale = g_SelectedTech == techCode ? "" : "grayscale:";
			startTechIcon.sprite = "stretched:"+grayscale+"session/portraits/"+tech.icon;			startTechIcon.tooltip = '[font="sans-bold-16"]' + tech.name.generic+ '[/font]\n'+ tech.description;
			startTechIcon.onPress = function() {
				selectTech(tech.name.internal);
				draw();
			}
			++i;
	}
	}
	// Draw requirements
	i = 0;
	if (g_TechList[g_SelectedCiv][g_SelectedTech]) {
		for (let struct of g_TechList[g_SelectedCiv][g_SelectedTech].buildings)
		{
			let thisEle = Engine.GetGUIObjectByName("req_struct");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more techs in phase " +
					  pha + " than can be supported by the current GUI layout");
				break;
			}
			let child = g_ParsedData.structures[struct];
			
			thisEle.sprite =	"stretched:session/portraits/"+child.icon;
			thisEle.tooltip = '[font="sans-bold-16"]' + child.name.generic + '[/font]\n(' + child.name.specific+")";
			thisEle.onPress = function() {
				selectStruct(struct);
				draw();
			}
			thisEle.hidden = false;
			break;
		}
		for (let tech of g_TechList[g_SelectedCiv][g_SelectedTech].require)
		{
			let thisEle = Engine.GetGUIObjectByName("req["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more techs in phase " +
					  pha + " than can be supported by the current GUI layout");
				break;
			}
			let child = g_ParsedData.techs[g_SelectedCiv][tech];
			if (!child) {
				warn("Technology not parsed for " + tech);
				continue;
			}
			thisEle.sprite =	"stretched:session/portraits/"+child.icon;
			thisEle.tooltip = '[font="sans-bold-16"]' +  child.name.generic + '[/font]\n' + child.description;
			thisEle.onPress = function() {
				selectTech(child.name.internal);
				draw();
			}
			thisEle.hidden = false;

			++i;
		}
	}
	
	let rootIcon = Engine.GetGUIObjectByName("root");
	let pairIcon = Engine.GetGUIObjectByName("pair");
	let rootTech = g_ParsedData.techs[g_SelectedCiv][g_SelectedTech];

	if (rootTech) {
		let pairedTech;
		let pair = rootTech.paired;
		if (pair)
			pairedTech = g_ParsedData.techs[g_SelectedCiv][pair];
		pairIcon.hidden = true;
		if (pairedTech) {
			pairIcon.sprite = "stretched:session/portraits/"+pairedTech.icon;
			pairIcon.tooltip = '[font="sans-bold-16"]' + pairedTech.name.generic + '[/font]\n' + pairedTech.description;
			Engine.GetGUIObjectByName("pair_caption").caption = "Paired with";
			pairIcon.onPress = function() {
				selectTech(pairedTech.name.internal);
				draw();
			}
			pairIcon.hidden = false;
		}
		rootIcon.sprite = "stretched:session/portraits/"+rootTech.icon;
		rootIcon.tooltip = rootTech.name.generic + "\n" + rootTech.description;
		Engine.GetGUIObjectByName("root_caption").caption = rootTech.name.generic;
		rootIcon.hidden = false;
	} else {
		rootIcon.hidden = true;
		pairIcon.hidden = true;
	}
	
	// Draw unlocks
	if (g_TechList[g_SelectedCiv][g_SelectedTech]) {
		i = 0;	
		Engine.GetGUIObjectByName("unlock_caption").hidden = !g_TechList[g_SelectedCiv][g_SelectedTech].unlocks.length;
		for (let tech of g_TechList[g_SelectedCiv][g_SelectedTech].unlocks)
		{
			let thisEle = Engine.GetGUIObjectByName("unlock["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more techs in phase " +
					  pha + " than can be supported by the current GUI layout");
				break;
			}
			let child = g_ParsedData.techs[g_SelectedCiv][tech];
			
			thisEle.sprite =	"stretched:session/portraits/"+child.icon;
			thisEle.tooltip = '[font="sans-bold-16"]' +  child.name.generic + '[/font]\n' + child.description;
			thisEle.onPress = function() {
				selectTech(child.name.internal);
				draw();
			}
			thisEle.hidden = false;

			++i;
		}
		i = 0;
		Engine.GetGUIObjectByName("unlock_unit_caption").hidden = !g_TechList[g_SelectedCiv][g_SelectedTech].units.length;
		for (let unit of g_TechList[g_SelectedCiv][g_SelectedTech].units)
		{
			let thisEle = Engine.GetGUIObjectByName("unlock_unit["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more techs in phase " +
					  pha + " than can be supported by the current GUI layout");
				break;
			}
			let child = g_ParsedData.units[unit];
			
			thisEle.sprite =	"stretched:session/portraits/"+child.icon;
			thisEle.tooltip = '[font="sans-bold-16"]' +  child.name.generic + '[/font]\n(' + child.name.specific+")";
			setViewerOnPress("unlock_unit["+i+"]_icon", unit);
			thisEle.hidden = false;
			++i;
		}
	}
	let size = Engine.GetGUIObjectByName("display_tree").size;
	size.right = -4;
	Engine.GetGUIObjectByName("display_tree").size = size;
}

function compileTooltip(template)
{
	return buildText(template, g_StructreeTooltipFunctions) + "\n" + showTemplateViewerOnClickTooltip();
}


/**
 * Positions certain elements that only need to be positioned once
 * (as <repeat> does not position automatically).
 *
 * Also detects limits on what the GUI can display by iterating through the set
 * elements of the GUI. These limits are then used by draw().
 */
function predraw()
{
	let phaseList = g_ParsedData.phaseList;
	let scale = 35;
	let initIconSize = {"left": 0, "right": scale, "top": 0, "bottom": scale};

	let phaseCount = phaseList.length;
	let i = 0;
	let row = 0;
	let rowSize = initIconSize.top - initIconSize.bottom;
	let spasing = 8;
	let shift = 0;
	
	let root;
	let size;
	
	let selectedTech = g_TechList[g_SelectedCiv][g_SelectedTech];
	let selectedTemplate = g_ParsedData.techs[g_SelectedCiv][g_SelectedTech];
	
	let pSelectedTech;
	let pSelectedTemplate;
	
	Engine.GetGUIObjectByName("req_caption").caption = "Requirements";
	Engine.GetGUIObjectByName("unlock_caption").caption = "Unlocks Technologies";
	Engine.GetGUIObjectByName("unlock_unit_caption").caption = "Unlocks Units";
	
	if (selectedTemplate) {
		if (selectedTemplate.paired) {
			pSelectedTech = g_TechList[g_SelectedCiv][selectedTemplate.paired];
			pSelectedTemplate = g_ParsedData.techs[g_SelectedCiv][selectedTemplate.paired];
		}
	}
	
	// Draw buildings
	shift = 0;
	for (let sc in g_StartingTechs[g_SelectedCiv])
		shift++;
	shift = shift/2;
	for (let sc in g_StartingTechs[g_SelectedCiv])
	{
		let thisEle = Engine.GetGUIObjectByName("struct["+i+"]_icon");
		if (thisEle === undefined)
		{
			error("\""+g_SelectedCiv+"\" has more starting buildings than can be supported by the current GUI layout");
			break;
		}
		// Set start tech icon
		let phaseSize = thisEle.size;
		phaseSize.left = (initIconSize.right)*(i-shift) + 4;
		phaseSize.right = (initIconSize.right)*(i+1-shift);
		phaseSize.bottom = (initIconSize.bottom)- (row*rowSize) + spasing;
		phaseSize.top = (initIconSize.top) - (row*rowSize) + spasing;
		thisEle.size = phaseSize;
		thisEle.hidden = false;
		++i;
	}
	Engine.GetGUIObjectByName("struct_row").size = "0 0 100% "+(initIconSize.bottom-(row*rowSize) + 2*spasing);
	for (let x = i; x < 30; ++x) {
		Engine.GetGUIObjectByName("struct["+x+"]_icon").hidden = true;
	}
	row++;
	i = 0;
	// Draw starting technlogies
	if (g_StartingTechs[g_SelectedCiv][g_SelectedBuilding]) {
		shift = g_StartingTechs[g_SelectedCiv][g_SelectedBuilding].length/2;
		for (let tech of g_StartingTechs[g_SelectedCiv][g_SelectedBuilding])
		{
			let thisEle = Engine.GetGUIObjectByName("tech["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more starting techs than can be supported by the current GUI layout");
				break;
			}
			// Align the phase row
			Engine.GetGUIObjectByName("tech["+i+"]_icon").hidden = false;
			// Set start tech icon
			let phaseIcon = Engine.GetGUIObjectByName("tech["+i+"]_icon");
			let phaseSize = phaseIcon.size;
			phaseSize.left = (initIconSize.right)*(i-shift) + 4;
			phaseSize.right = (initIconSize.right)*(i+1-shift);
			phaseSize.bottom = (initIconSize.bottom) - ((row-1)*rowSize) + spasing;
			phaseSize.top = (initIconSize.top) - ((row-1)*rowSize) + spasing;
			phaseIcon.size = phaseSize;
			++i;
		}
	}
	for (let x = i; x < 30; ++x) {
		Engine.GetGUIObjectByName("tech["+x+"]_icon").hidden = true;
	}
	Engine.GetGUIObjectByName("start_row").size = "0 "+((initIconSize.top) - (row*rowSize) + 2*spasing)+" 100% "+(initIconSize.bottom-(row*rowSize) + 4*spasing);
	
	let leftRows = row+2;
	row = 0;
	spasing = 0;
	
	root = Engine.GetGUIObjectByName("tSection");
	root.size =  "30% "+((initIconSize.top) - (leftRows*rowSize))+" 70% 98%";

	root = Engine.GetGUIObjectByName("sSection");
	root.size = "0 "+((initIconSize.top) - (leftRows*rowSize))+" 30% 98%";
	root = Engine.GetGUIObjectByName("sGenericName");
	root.hidden = true;
	if (selectedTemplate) {
		root.caption = selectedTemplate.name.generic;
		root.hidden = false;
	}
	root = Engine.GetGUIObjectByName("sIcon");
	root.hidden = true;
	if (selectedTemplate) {
		root.sprite = "stretched:session/portraits/"+selectedTemplate.icon;
		root.hidden = false;
	}
	root = Engine.GetGUIObjectByName("sDescription");
	root.hidden = true;
	if (selectedTemplate) {
		if (selectedTemplate.tooltip)
			root.caption = selectedTemplate.tooltip;
		else
			root.caption = selectedTemplate.description;
		root.hidden = false;
	}
	root = Engine.GetGUIObjectByName("sPhase");
	if (selectedTech && selectedTech.phase) {
		root.hidden = false;
		root = Engine.GetGUIObjectByName("sPhaseGenericName");
		root.caption = g_ParsedData.phases[selectedTech.phase].name.generic;
		root.hidden = false;
		root = Engine.GetGUIObjectByName("sPhaseIcon");
		root.sprite = "stretched:session/portraits/"+g_ParsedData.phases[selectedTech.phase].icon;
		root.hidden = false;
	} else {
		root.hidden = true;
		Engine.GetGUIObjectByName("sPhaseGenericName").hidden = true;
		Engine.GetGUIObjectByName("sPhaseIcon").hidden = true;
	}
	root = Engine.GetGUIObjectByName("sCost");
	let caption = "";
	let cc = 0;
	root.hidden = true;
	if (selectedTemplate) {
		for (let key in selectedTemplate.cost) {
			if (selectedTemplate.cost[key]){
				caption =  caption + '[icon="icon_'+ key +'"] ' + selectedTemplate.cost[key] +" ";
				cc++;
			}
		}
		if (!cc)
			caption = "Cost free";
		root.caption = caption;
		root.hidden = false;
	}
		
	// Paired
	if (pSelectedTemplate) {
		root = Engine.GetGUIObjectByName("pSection");
		root.size =  "70% "+((initIconSize.top) - (leftRows*rowSize))+" 100% 98%";
		root.hidden = false;
		root = Engine.GetGUIObjectByName("pGenericName");
		root.caption = pSelectedTemplate.name.generic;
		root.hidden = false;
		root = Engine.GetGUIObjectByName("pIcon");
		root.sprite = "stretched:session/portraits/"+pSelectedTemplate.icon;
		root.hidden = false;
		root = Engine.GetGUIObjectByName("pDescription");
		if (pSelectedTemplate.tooltip)
			root.caption = pSelectedTemplate.tooltip;
		else
			root.caption = pSelectedTemplate.description;
		root.hidden = false;
		
		root = Engine.GetGUIObjectByName("pPhase");
		if (pSelectedTech && pSelectedTech.phase) {
			root.hidden = false;
			root = Engine.GetGUIObjectByName("pPhaseGenericName");
			root.caption = g_ParsedData.phases[pSelectedTech.phase].name.generic;
			root.hidden = false;
			root = Engine.GetGUIObjectByName("pPhaseIcon");
			root.sprite = "stretched:session/portraits/"+g_ParsedData.phases[pSelectedTech.phase].icon;
			root.hidden = false;
		} else {
			root.hidden = true;
			Engine.GetGUIObjectByName("pPhaseGenericName").hidden = true;
			Engine.GetGUIObjectByName("pPhaseIcon").hidden = true;
		}
		
		root = Engine.GetGUIObjectByName("pCost");
		caption = "";
		cc = 0;
		for (let key in pSelectedTemplate.cost) {
			if (pSelectedTemplate.cost[key]) {
				caption =  caption + '[icon="icon_'+ key +'"] ' + pSelectedTemplate.cost[key] +" ";
				cc++;
			}
		}
		if (!cc)
			caption = "Cost free";
		root.caption = caption;
		root.hidden = false;
	} else {
		Engine.GetGUIObjectByName("pSection").hidden = true;
		Engine.GetGUIObjectByName("pGenericName").hidden = true;
		Engine.GetGUIObjectByName("pIcon").hidden = true;
		Engine.GetGUIObjectByName("pDescription").hidden = true;
		Engine.GetGUIObjectByName("pCost").hidden = true;
	}
	row += 2;
	i = 0;
	root = Engine.GetGUIObjectByName("req_caption");
	size = root.size;
	size.bottom = (initIconSize.bottom) - row*rowSize + spasing;
	size.top =  (initIconSize.top) - row*rowSize + spasing;
	spasing += ((size.bottom - size.top)/2);
	root.size = size;
	let b = 0;
	// Draw req
	if (selectedTech) {
		let sb = selectedTech.buildings.length > 0 ? 1 : 0;
		shift = (sb + selectedTech.require.length)/2;
		for (let struct of selectedTech.buildings) {
			let thisEle = Engine.GetGUIObjectByName("req_struct");
			let phaseSize = thisEle.size;
			phaseSize.left = (initIconSize.right)*(i-shift) + 4;
			phaseSize.right = (initIconSize.right)*(i-shift+1);
			phaseSize.bottom = (initIconSize.bottom)- (row*rowSize) + spasing;
			phaseSize.top = (initIconSize.top) - (row*rowSize) + spasing;
			thisEle.size = phaseSize;
			thisEle.hidden = false;
			b++;
			break;
		}
		for (let tech of selectedTech.require) {
			let thisEle = Engine.GetGUIObjectByName("req["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more starting techs than can be supported by the current GUI layout");
				break;
			}
			// Set start tech icon
			let phaseSize = thisEle.size;
			phaseSize.left = (initIconSize.right)*(i+1-shift) + 4;
			phaseSize.right = (initIconSize.right)*(i+2-shift);
			phaseSize.bottom = (initIconSize.bottom)- (row*rowSize) + spasing;
			phaseSize.top = (initIconSize.top) - (row*rowSize) + spasing;
			thisEle.size = phaseSize;
			thisEle.hidden = false;
			++i;
		}
	}
	for (let x = i; x < 30; ++x) {
		Engine.GetGUIObjectByName("req["+x+"]_icon").hidden = true;
	}
	if (!b) {
		Engine.GetGUIObjectByName("req_struct").hidden = true;
	}
	row++;
	
	root = Engine.GetGUIObjectByName("pair_caption");
	size = root.size;
	size.left = 2.5*(initIconSize.right);
	size.right = 2.5*(initIconSize.right)+50;
	size.bottom = (initIconSize.bottom) - row*rowSize + spasing;
	size.top =  (initIconSize.top) - row*rowSize + spasing;
	root.size = size;
	
	root = Engine.GetGUIObjectByName("root_caption");
	size = root.size;
	size.left = -100;
	size.right = 100;
	size.bottom = (initIconSize.bottom) - row*rowSize + spasing;
	size.top =  (initIconSize.top) - row*rowSize + spasing;
	spasing += ((size.bottom - size.top)/1.5);
	root.size = size;
	root.hidden = false;
	
	// Draw root of tree
	root = Engine.GetGUIObjectByName("root");
	size = root.size;
	size.left = -0.5*initIconSize.right;
	size.right = 0.5*(initIconSize.right);
	size.bottom = initIconSize.bottom - (row*rowSize) + spasing;
	size.top = initIconSize.top - (row*rowSize) + spasing;
	root.size = size;
	root.hidden = false;
	
	// Draw pair of tree
	root = Engine.GetGUIObjectByName("pair");
	size = root.size;
	size.left = 2.5*(initIconSize.right);
	size.right = 3.5*(initIconSize.right);
	size.bottom = initIconSize.bottom - (row*rowSize) + spasing;
	size.top = initIconSize.top - (row*rowSize) + spasing;
	root.size = size;
	root.hidden = true;
	
	row++;
	i = 0;
	root = Engine.GetGUIObjectByName("unlock_caption");
	size = root.size;
	size.bottom = (initIconSize.bottom) - row*rowSize + spasing;
	size.top =  (initIconSize.top) - row*rowSize + spasing;
	spasing += ((size.bottom - size.top)/2);
	root.size = size;
	// Draw unlocks
	if (selectedTech) {
		shift = selectedTech.unlocks.length/2;
		for (let tech of selectedTech.unlocks) {
			let thisEle = Engine.GetGUIObjectByName("unlock["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more starting techs than can be supported by the current GUI layout");
				break;
			}
			// Set start tech icon
			let phaseSize = thisEle.size;
			phaseSize.left = (initIconSize.right)*(i-shift)+4;
			phaseSize.right = (initIconSize.right)*(i+1-shift);
			phaseSize.bottom = (initIconSize.bottom)- (row*rowSize) + spasing;
			phaseSize.top = (initIconSize.top) - (row*rowSize) + spasing;
			thisEle.size = phaseSize;
			thisEle.hidden = false;
			++i;
		}
		if (i)
			row++;
	}
	for (let x = i; x < 30; ++x) {
		Engine.GetGUIObjectByName("unlock["+x+"]_icon").hidden = true;
	}
	i=0;
	root = Engine.GetGUIObjectByName("unlock_unit_caption");
	size = root.size;
	size.bottom = (initIconSize.bottom) - row*rowSize + spasing;
	size.top =  (initIconSize.top) - row*rowSize + spasing;
	spasing += ((size.bottom - size.top)/2);
	root.size = size;
	if (selectedTech) {
		shift = selectedTech.units.length/2;
		for (let tech of selectedTech.units) {
			let thisEle = Engine.GetGUIObjectByName("unlock_unit["+i+"]_icon");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more starting techs than can be supported by the current GUI layout");
				break;
			}
			// Set start tech icon
			let phaseSize = thisEle.size;
			phaseSize.left = (initIconSize.right)*(i-shift)+4;
			phaseSize.right = (initIconSize.right)*(i+1-shift);
			phaseSize.bottom = (initIconSize.bottom)- (row*rowSize) + spasing;
			phaseSize.top = (initIconSize.top) - (row*rowSize) + spasing;
			thisEle.size = phaseSize;
			thisEle.hidden = false;
			++i;
		}
	}
	for (let x = i; x < 30; ++x) {
		Engine.GetGUIObjectByName("unlock_unit["+x+"]_icon").hidden = true;
	}
//	hideRemaining("phase_rows", i);
}

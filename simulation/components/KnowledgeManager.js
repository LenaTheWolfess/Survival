function KnowledgeManager() {}

KnowledgeManager.prototype.Schema =
	"<empty/>";

KnowledgeManager.prototype.Init = function()
{
	this.inProgress = {};
	
	let all = KnowledgeTemplates.GetAll();
	for (let t in all) {
		let tt = all[t];
		let action = tt.action;
		if (this.inProgress[action] === undefined)
			this.inProgress[action] = {};
		let type = tt.type;
		if (this.inProgress[action][type] == undefined)
			this.inProgress[action][type] = {"adds": 0, "goal": 0, "has": 0};
		
		this.inProgress[action][type].adds = +tt.adds;
		this.inProgress[action][type].goal = +tt.count;
		this.inProgress[action][type].finished = false;
		this.inProgress[action][type].once = tt.once;
	}
}


KnowledgeManager.prototype.AddPoints = function(action, type, points)
{
	if (!this.inProgress[action])
		return;
	if (!this.inProgress[action][type])
		return;
	if (this.inProgress[action][type].finished)
		return;
	this.inProgress[action][type].has += points;
	if (this.inProgress[action][type].has >= this.inProgress[action][type].goal) {
		this.inProgress[action][type].finished = true;
		let amount = this.inProgress[action][type].adds;
		let cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
		if (cmpPlayer)
			cmpPlayer.AddResource("rp", amount);
		
		let cmpStatisticsTracker = QueryOwnerInterface(this.entity, IID_StatisticsTracker);
		if (cmpStatisticsTracker)
			cmpStatisticsTracker.IncreaseResourceGatheredCounter("rp", amount, undefined);
		
		// Reset if we can repeat
		if (!this.inProgress[action][type].once) {
			this.inProgress[action][type].finished = false;
			this.inProgress[action][type].has = 0;
		}
	}
}


Engine.RegisterComponentType(IID_KnowledgeManager, "KnowledgeManager", KnowledgeManager);
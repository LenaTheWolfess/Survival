function ResourceDropsite() {}

ResourceDropsite.prototype.Schema =
	"<element name='Types'>" +
		"<list>" +
			"<zeroOrMore>" +
				Resources.BuildChoicesSchema() +
			"</zeroOrMore>" +
		"</list>" +
	"</element>" +
	"<optional>"+
		"<element name = 'Mobile'>"+
			"<data type= 'boolean' />"+
		"</element>"+
	"</optional>"+
	"<element name='Sharable' a:help='Allows allies to use this entity.'>" +
		"<data type='boolean'/>" +
	"</element>";

ResourceDropsite.prototype.Init = function()
{
	this.sharable = this.template.Sharable == "true";
	this.shared = this.sharable;
	this.locked = false;
	this.isMobile = this.template.Mobile && this.template.Mobile == "true";
};

ResourceDropsite.prototype.IsMobile = function()
{
	return this.isMobile;
}

ResourceDropsite.prototype.Lock = function()
{
	this.locked = true;
}

ResourceDropsite.prototype.Unlock = function()
{
	this.locked = false;
}

/**
 * Returns the list of resource types accepted by this dropsite,
 * as defined by it being referred to in the template and the resource being enabled.
 */
ResourceDropsite.prototype.GetTypes = function()
{
	if (!this.template.Types)
		return [];
	let types = ApplyValueModificationsToEntity("ResourceDropsite/Types", this.template.Types, this.entity);
	return types.split(/\s+/);
};

/**
 * Returns whether this dropsite accepts the given generic type of resource.
 */
ResourceDropsite.prototype.AcceptsType = function(type)
{
	if (this.locked)
		return false;
	
	return this.GetTypes().indexOf(type) != -1;
};

ResourceDropsite.prototype.IsSharable = function()
{
	return this.sharable;
};

ResourceDropsite.prototype.IsShared = function()
{
	return this.shared;
};

ResourceDropsite.prototype.SetSharing = function(value)
{
	if (!this.sharable)
		return;
	this.shared = value;
	Engine.PostMessage(this.entity, MT_DropsiteSharingChanged, { "shared": this.shared });
};

Engine.RegisterComponentType(IID_ResourceDropsite, "ResourceDropsite", ResourceDropsite);

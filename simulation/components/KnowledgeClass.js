function KnowledgeClass() {}

KnowledgeClass.prototype.Schema =
	"<element name='Class'>" +
		"<text/>" +
	"</element>";

KnowledgeClass.prototype.GetClass = function()
{
	return this.template.Class;
}	

Engine.RegisterComponentType(IID_KnowledgeClass, "KnowledgeClass", KnowledgeClass);

Engine.RegisterInterface("Morale");

/**
 * Message of the form { "from": number, "to": number }
 * sent from Morale component whenever experience changes.
 */
Engine.RegisterMessageType("MoraleChanged");
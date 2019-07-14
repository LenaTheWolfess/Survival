Engine.RegisterInterface("Energy");

/**
 * Message of the form { "from": number, "to": number }
 * sent from Energy component whenever energy changes.
 */
Engine.RegisterMessageType("EnergyChanged");

// Telemetry must be initialized before any server load functions run.
// This import triggers side-effect initialization of the TracerProvider.
import './lib/server/telemetry/init.js';

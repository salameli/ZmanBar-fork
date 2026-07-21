import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DateMenuController } from "./src/dateMenuController.js";
import { GeoclueClient } from "./src/geoclueClient.js";
import { HebrewDateService } from "./src/hebrewDateService.js";
import { bindLoggingSetting, log } from "./src/logging.js";
import { ReverseGeocoder } from "./src/reverseGeocoder.js";
import { UpdateScheduler } from "./src/updateScheduler.js";
import { ZmanimMenuButton } from "./src/zmanimMenuButton.js";

// Import for side-effect: The UMD bundle does not have modern ES6 exports,
// so we execute the script to have it attach its main object to the global scope.
import "./src/kosher-zmanim.js";

const KosherZmanim = globalThis.KosherZmanim;
const AUTOMATIC_LOCATION_SOURCE = "Automatic Location";
const AUTO_LOCATION_UNAVAILABLE =
	"Location services are disabled or unavailable";
const DETECTING_LOCATION = "Detecting location...";

export default class HebrewDateDisplayExtension extends Extension {
	constructor(metadata) {
		super(metadata);
		this._dateMenu = Main.panel.statusArea.dateMenu;
		this._settings = null;
		this._location = null;
		this._autoLocationStatus = null;
		this._zmanimItems = [];
		this._dateState = {
			shortDate: "",
			fullDate: "",
			shkiah: null,
		};
		this._suppressLocationSettingChanged = false;
	}

	enable() {
		this._settings = this.getSettings();
		this._loggingSettingsSignal = bindLoggingSetting(this._settings);
		log("Enabling ZmanBar extension.");
		log("KosherZmanim library loaded successfully.");

		this._hebrewDateService = new HebrewDateService(KosherZmanim);
		this._reverseGeocoder = new ReverseGeocoder(this.metadata);
		this._geoclueClient = new GeoclueClient({
			desktopId: "ZmanBar",
			onLocation: ({ latitude, longitude }) =>
				this._useAutomaticLocation(latitude, longitude),
			onUnavailable: () => this._setAutoLocationUnavailable(),
		});
		this._updateScheduler = new UpdateScheduler(() =>
			this._updateAndCacheValues(),
		);
		this._dateMenuController = new DateMenuController(this._dateMenu);
		this._zmanimMenuButton = new ZmanimMenuButton(this.metadata.uuid, () =>
			this._resetLocation(),
		);

		this._connectSettings();
		this._dateMenuController.connect();
		this._useSavedLocation();
		this._updateAndCacheValues();

		log("ZmanBar extension enabled successfully.");
	}

	disable() {
		log("Disabling ZmanBar extension.");

		this._updateScheduler?.destroy();
		this._geoclueClient?.destroy();
		this._reverseGeocoder?.destroy();
		this._dateMenuController?.destroy();
		this._zmanimMenuButton?.destroy();
		this._disconnectSettings();

		this._updateScheduler = null;
		this._geoclueClient = null;
		this._reverseGeocoder = null;
		this._dateMenuController = null;
		this._zmanimMenuButton = null;
		this._hebrewDateService = null;
		this._settings = null;
		this._location = null;
		this._autoLocationStatus = null;
		this._zmanimItems = [];

		log("ZmanBar extension disabled.");
	}

	_connectSettings() {
		this._settingsChangedIdLat = this._settings.connect(
			"changed::latitude",
			this._onLocationSettingChanged.bind(this),
		);
		this._settingsChangedIdLon = this._settings.connect(
			"changed::longitude",
			this._onLocationSettingChanged.bind(this),
		);
		this._settingsChangedIdName = this._settings.connect(
			"changed::location-name",
			this._onLocationSettingChanged.bind(this),
		);
	}

	_disconnectSettings() {
		if (!this._settings) {
			return;
		}

		if (this._settingsChangedIdLat)
			this._settings.disconnect(this._settingsChangedIdLat);
		if (this._settingsChangedIdLon)
			this._settings.disconnect(this._settingsChangedIdLon);
		if (this._settingsChangedIdName)
			this._settings.disconnect(this._settingsChangedIdName);
		if (this._loggingSettingsSignal)
			this._settings.disconnect(this._loggingSettingsSignal);

		this._settingsChangedIdLat = null;
		this._settingsChangedIdLon = null;
		this._settingsChangedIdName = null;
		this._loggingSettingsSignal = null;
	}

	_useSavedLocation() {
		log("Attempting to use saved location from settings.");
		const latitude = this._settings.get_double("latitude");
		const longitude = this._settings.get_double("longitude");

		if (latitude === 0.0 && longitude === 0.0) {
			log("No saved location found. Attempting automatic location detection.");
			this._location = null;
			this._startAutomaticLocationLookup();
			return;
		}

		this._geoclueClient?.stop();
		this._applyLocation(
			this._settings.get_string("location-name"),
			latitude,
			longitude,
			"Saved Settings",
		);
		log(`Using saved location: Lat ${latitude}, Lon ${longitude}`);
	}

	_startAutomaticLocationLookup() {
		if (this._autoLocationStatus === DETECTING_LOCATION) {
			return;
		}

		this._autoLocationStatus = DETECTING_LOCATION;
		this._updateZmanimMenu();
		this._geoclueClient?.start();
	}

	_setAutoLocationUnavailable() {
		if (this._location) {
			return;
		}

		this._autoLocationStatus = AUTO_LOCATION_UNAVAILABLE;
		this._updateZmanimMenu();
	}

	_applyLocation(name, latitude, longitude, source) {
		this._location = this._hebrewDateService.createLocation(
			name,
			latitude,
			longitude,
			source,
		);
		this._autoLocationStatus = null;
	}

	_useAutomaticLocation(latitude, longitude) {
		const coordinates = this._formatCoordinates(latitude, longitude);
		this._applyLocation(
			`Current Location (automatic): ${coordinates}`,
			latitude,
			longitude,
			AUTOMATIC_LOCATION_SOURCE,
		);
		log(`Using automatic location: Lat ${latitude}, Lon ${longitude}`);
		this._updateAndCacheValues();

		this._reverseGeocoder?.lookup(latitude, longitude, (locationName) => {
			if (locationName) {
				this._setAutomaticLocationName(latitude, longitude, locationName);
			}
		});
	}

	_formatCoordinates(latitude, longitude) {
		return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
	}

	_setAutomaticLocationName(latitude, longitude, name) {
		if (
			!this._location ||
			this._location.source !== AUTOMATIC_LOCATION_SOURCE
		) {
			return;
		}

		if (
			this._location.latitude !== latitude ||
			this._location.longitude !== longitude
		) {
			return;
		}

		this._location.name = `Current Location (automatic): ${name}`;
		this._hebrewDateService.setLocation(this._location);
		this._updateZmanimMenu();
	}

	_onLocationSettingChanged() {
		if (this._suppressLocationSettingChanged) {
			return;
		}

		log("Manual location setting changed. Re-evaluating location.");
		this._useSavedLocation();
		this._updateAndCacheValues();
	}

	_resetLocation() {
		log("Resetting location settings and restarting automatic detection.");
		this._suppressLocationSettingChanged = true;
		this._settings.set_string("location-name", "");
		this._settings.set_double("latitude", 0.0);
		this._settings.set_double("longitude", 0.0);
		this._suppressLocationSettingChanged = false;

		this._geoclueClient?.stop();
		this._location = null;
		this._zmanimItems = [];
		this._autoLocationStatus = null;
		this._useSavedLocation();
		this._updateAndCacheValues();
	}

	_updateAndCacheValues() {
		const dateState = this._hebrewDateService.calculate(this._location);
		this._dateState = dateState;
		this._zmanimItems = dateState.zmanimItems;

		this._dateMenuController.setHebrewDate(
			dateState.shortDate,
			dateState.fullDate,
		);
		this._updateZmanimMenu();
		this._updateScheduler.schedule(dateState.shkiah);
	}

	_updateZmanimMenu() {
		this._zmanimMenuButton?.update({
			location: this._location,
			zmanimItems: this._zmanimItems,
			status: this._autoLocationStatus,
		});
	}
}

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { bindLoggingSetting, log, logError } from './src/logging.js';
import { ReverseGeocoder } from './src/reverseGeocoder.js';
import { ZmanimMenuButton } from './src/zmanimMenuButton.js';

// Import for side-effect: The UMD bundle does not have modern ES6 exports,
// so we execute the script to have it attach its main object to the global scope.
import './src/kosher-zmanim.js';
const KosherZmanim = globalThis.KosherZmanim;
const GEOCLUE_BUS_NAME = 'org.freedesktop.GeoClue2';
const GEOCLUE_MANAGER_PATH = '/org/freedesktop/GeoClue2/Manager';
const GEOCLUE_MANAGER_IFACE = 'org.freedesktop.GeoClue2.Manager';
const GEOCLUE_CLIENT_IFACE = 'org.freedesktop.GeoClue2.Client';
const GEOCLUE_LOCATION_IFACE = 'org.freedesktop.GeoClue2.Location';
const DBUS_PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';

function findActorByClassName(actor, className) {
    if (!actor) {
        return null;
    }
    if (actor.get_style_class_name) {
        const styleClassName = actor.get_style_class_name();
        if (styleClassName && styleClassName.includes(className)) {
            return actor;
        }
    }
    if (actor.get_children) {
        for (const child of actor.get_children()) {
            const found = findActorByClassName(child, className);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

export default class HebrewDateDisplayExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._dateMenu = Main.panel.statusArea.dateMenu;
        this._clockDisplay = this._dateMenu._clockDisplay;
        this._location = null;
        this._shkiah = null;
        this._hebrewDateString = '';
        this._hebrewDateStringWithYear = '';
        this._zmanimItems = [];
        this._zmanimCalendar = new KosherZmanim.ComplexZmanimCalendar();
        this._hebrewDateFormatter = new KosherZmanim.HebrewDateFormatter();
        this._hebrewDateFormatter.setHebrewFormat(true);
        this._clockUpdateTimeout = null;
        this._zmanimMenuButton = null;
        this._autoLocationStatus = null;
        this._geoclueClientProxy = null;
        this._geoclueLocationSignalId = null;
        this._reverseGeocoder = null;
        // Note: Can't log here until settings are loaded in enable()
    }

    _createZmanimMenuButton() {
        this._zmanimMenuButton = new ZmanimMenuButton(this.metadata.uuid);
    }

    _getZmanimDefinitions() {
        return [
            { label: 'Alot Hashachar', method: 'getAlosHashachar' },
            { label: 'Netz Hachama', method: 'getSunrise' },
            { label: 'Sof Zman Shema GRA', method: 'getSofZmanShmaGRA' },
            { label: 'Sof Zman Tefila GRA', method: 'getSofZmanTfilaGRA' },
            { label: 'Chatzot', method: 'getChatzos' },
            { label: 'Mincha Gedola', method: 'getMinchaGedola' },
            { label: 'Mincha Ketana', method: 'getMinchaKetana' },
            { label: 'Plag Hamincha', method: 'getPlagHamincha' },
            { label: 'Shkiah', method: 'getSunset' },
            { label: 'Tzait Hakochavim', method: 'getTzais' },
        ];
    }

    _toJSDate(zman) {
        if (!zman) {
            return null;
        }
        if (zman instanceof Date) {
            return zman;
        }
        if (typeof zman.toJSDate === 'function') {
            return zman.toJSDate();
        }
        return null;
    }

    _formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _calculateZmanim() {
        if (!this._location || !this._zmanimCalendar) {
            this._zmanimItems = [];
            return;
        }

        this._zmanimItems = this._getZmanimDefinitions().map(({ label, method }) => {
            try {
                const date = this._toJSDate(this._zmanimCalendar[method]());
                return {
                    label,
                    time: date ? this._formatTime(date) : 'Unavailable',
                };
            } catch (e) {
                logError(e, `Failed to calculate ${label}.`);
                return { label, time: 'Unavailable' };
            }
        });
    }

    _updateZmanimMenu() {
        if (!this._zmanimMenuButton) {
            return;
        }

        this._zmanimMenuButton.update({
            location: this._location,
            zmanimItems: this._zmanimItems,
            status: this._autoLocationStatus,
        });
    }

    _createSystemProxy(objectPath, interfaceName, callback) {
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            GEOCLUE_BUS_NAME,
            objectPath,
            interfaceName,
            null,
            (source, result) => {
                if (!this._settings) {
                    return;
                }

                try {
                    callback(Gio.DBusProxy.new_for_bus_finish(result));
                } catch (e) {
                    logError(e, `Failed to create D-Bus proxy for ${interfaceName}.`);
                    this._setAutoLocationUnavailable();
                }
            }
        );
    }

    _callDBus(proxy, methodName, parameters, callback) {
        proxy.call(methodName, parameters, Gio.DBusCallFlags.NONE, -1, null, (source, result) => {
            if (!this._settings) {
                return;
            }

            try {
                callback(source.call_finish(result));
            } catch (e) {
                logError(e, `D-Bus method ${methodName} failed.`);
                this._setAutoLocationUnavailable();
            }
        });
    }

    _setDBusProperty(proxy, interfaceName, propertyName, value, callback) {
        this._callDBus(
            proxy,
            'Set',
            new GLib.Variant('(ssv)', [interfaceName, propertyName, value]),
            callback
        );
    }

    _setAutoLocationUnavailable() {
        if (this._location) {
            return;
        }

        this._autoLocationStatus = 'Location services are disabled or unavailable';
        this._updateZmanimMenu();
    }

    _applyLocation(name, latitude, longitude, source) {
        const timezone = GLib.TimeZone.new_local().get_identifier();
        this._location = { name, latitude, longitude, timezone, source };
        const geoLocation = new KosherZmanim.GeoLocation(name, latitude, longitude, 0, timezone);
        this._zmanimCalendar.setGeoLocation(geoLocation);
        this._autoLocationStatus = null;
    }

    _formatCoordinates(latitude, longitude) {
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    _setAutomaticLocationName(latitude, longitude, name) {
        if (!this._location || this._location.source !== 'Automatic Location') {
            return;
        }

        if (this._location.latitude !== latitude || this._location.longitude !== longitude) {
            return;
        }

        this._location.name = `Current Location (automatic): ${name}`;
        this._updateZmanimMenu();
    }

    _useAutomaticLocation(latitude, longitude) {
        const coordinates = this._formatCoordinates(latitude, longitude);
        this._applyLocation(`Current Location (automatic): ${coordinates}`, latitude, longitude, 'Automatic Location');
        log(`Using automatic location: Lat ${latitude}, Lon ${longitude}`);
        this._updateAndCacheValues();

        this._reverseGeocoder?.lookup(latitude, longitude, locationName => {
            if (locationName) {
                this._setAutomaticLocationName(latitude, longitude, locationName);
            }
        });
    }

    _readGeoclueLocation() {
        if (!this._geoclueClientProxy) {
            return;
        }

        const locationVariant = this._geoclueClientProxy.get_cached_property('Location');
        const locationPath = locationVariant?.deep_unpack();
        if (!locationPath || locationPath === '/') {
            return;
        }

        this._createSystemProxy(locationPath, GEOCLUE_LOCATION_IFACE, locationProxy => {
            const latitude = locationProxy.get_cached_property('Latitude')?.deep_unpack();
            const longitude = locationProxy.get_cached_property('Longitude')?.deep_unpack();

            if (typeof latitude === 'number' && typeof longitude === 'number') {
                this._useAutomaticLocation(latitude, longitude);
            } else {
                this._setAutoLocationUnavailable();
            }
        });
    }

    _startAutomaticLocationLookup() {
        if (this._geoclueClientProxy || this._autoLocationStatus === 'Detecting location...') {
            return;
        }

        this._autoLocationStatus = 'Detecting location...';
        this._updateZmanimMenu();

        this._createSystemProxy(GEOCLUE_MANAGER_PATH, GEOCLUE_MANAGER_IFACE, managerProxy => {
            this._callDBus(managerProxy, 'CreateClient', null, result => {
                const [clientPath] = result.deep_unpack();
                this._createSystemProxy(clientPath, GEOCLUE_CLIENT_IFACE, clientProxy => {
                    this._geoclueClientProxy = clientProxy;
                    this._geoclueLocationSignalId = clientProxy.connect('g-properties-changed', () => {
                        this._readGeoclueLocation();
                    });

                    this._createSystemProxy(clientPath, DBUS_PROPERTIES_IFACE, propertiesProxy => {
                        this._setDBusProperty(propertiesProxy, GEOCLUE_CLIENT_IFACE, 'DesktopId', new GLib.Variant('s', 'ZmanBar'), () => {
                            this._setDBusProperty(propertiesProxy, GEOCLUE_CLIENT_IFACE, 'RequestedAccuracyLevel', new GLib.Variant('u', 6), () => {
                                this._callDBus(clientProxy, 'Start', null, () => {
                                    this._readGeoclueLocation();
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    _stopAutomaticLocationLookup() {
        if (!this._geoclueClientProxy) {
            return;
        }

        if (this._geoclueLocationSignalId) {
            this._geoclueClientProxy.disconnect(this._geoclueLocationSignalId);
            this._geoclueLocationSignalId = null;
        }

        this._geoclueClientProxy.call('Stop', null, Gio.DBusCallFlags.NONE, -1, null, null);
        this._geoclueClientProxy = null;
    }

    _useSavedLocation() {
        log('Attempting to use saved location from settings.');
        const settings = this.getSettings();
        const latitude = settings.get_double('latitude');
        const longitude = settings.get_double('longitude');

        if (latitude === 0.0 && longitude === 0.0) {
            log('No saved location found. Attempting automatic location detection.');
            this._location = null;
            this._startAutomaticLocationLookup();
        } else {
            this._stopAutomaticLocationLookup();
            this._applyLocation(settings.get_string('location-name'), latitude, longitude, 'Saved Settings');
            log(`Using saved location: Lat ${latitude}, Lon ${longitude}`);
        }
    }

    _onLocationSettingChanged() {
        log('Manual location setting changed. Re-evaluating location.');
        this._useSavedLocation();
        this._updateAndCacheValues();
    }

    _formatHebrewDate(jewishCalendar, withYear) {
        const day = this._hebrewDateFormatter.formatHebrewNumber(jewishCalendar.getJewishDayOfMonth());
        const month = this._hebrewDateFormatter.formatMonth(jewishCalendar);
        if (withYear) {
            const year = this._hebrewDateFormatter.formatHebrewNumber(jewishCalendar.getJewishYear());
            return `${day} ${month} ${year}`;
        }
        return `${day} ${month}`;
    }

    _updateAndCacheValues() {
        const now = new Date();
        log(`Recalculating shkiah and Hebrew date for ${now.toLocaleString()}`);

        if (this._location && this._zmanimCalendar) {
            try {
                this._zmanimCalendar.setDate(now);
                this._shkiah = this._zmanimCalendar.getSunset()?.toJSDate();
                if (!this._shkiah) {
                    logError(new Error('Failed to calculate shkiah (sunset) for the given location. The value was null.'));
                    this._shkiah = null; // Ensure it's null on failure
                }
            } catch (e) {
                logError(e, 'An unexpected error occurred during shkiah (sunset) calculation.');
                this._shkiah = null;
            }
        } else {
            this._shkiah = null;
        }

        let dateForHebrewCalc = now;
        if (this._shkiah && now >= this._shkiah) {
            log(`Current time is after shkiah (${this._shkiah.toLocaleTimeString()}). Using tomorrow's date for display.`);
            const tomorrow = new Date(now.getTime() + 86400000);
            dateForHebrewCalc = tomorrow;
        }

        try {
            const jewishDate = new KosherZmanim.JewishCalendar(dateForHebrewCalc);
            this._hebrewDateString = this._formatHebrewDate(jewishDate, false);
            this._hebrewDateStringWithYear = this._formatHebrewDate(jewishDate, true);
        } catch (e) {
            logError(e, 'An unexpected error occurred during Hebrew date calculation.');
            this._hebrewDateString = 'Error';
            this._hebrewDateStringWithYear = 'Error calculating date';
        }

        log(`Cached new Hebrew date: ${this._hebrewDateString}`);
        this._calculateZmanim();
        this._updateZmanimMenu();

        // Update the display immediately after caching new values
        this._updateClockDisplay();
        this._scheduleUpdate();
    }

    _scheduleUpdate() {
        if (this._updateTimeout) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = null;
        }

        const now = new Date();
        let nextUpdate;

        if (this._shkiah && now < this._shkiah) {
            nextUpdate = this._shkiah;
            log(`Scheduling next update for shkiah at ${nextUpdate.toLocaleTimeString()}`);
        } else {
            // Schedule for midnight of the next day
            nextUpdate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            log(`Scheduling next update for midnight at ${nextUpdate.toLocaleTimeString()}`);
        }

        const secondsToNextUpdate = Math.max(1, Math.floor((nextUpdate.getTime() - now.getTime()) / 1000));
        this._updateTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secondsToNextUpdate, () => {
            this._updateAndCacheValues(); // This will recalculate, update display, and reschedule
            return GLib.SOURCE_REMOVE; // The timeout runs only once
        });
    }

    _updateClockDisplay() {
        const clockText = this._dateMenu._clock.clock;
        this._clockDisplay.set_text(`${clockText}  ${this._hebrewDateString}`);
    }

    _onMenuOpened() {
        log('Executing _onMenuOpened to update notification center date.');
        const dateLabel = findActorByClassName(this._dateMenu.menu.box, 'date-label');
        if (!dateLabel) {
            logError(new Error('Could not find dateLabel actor in notification center.'));
            return;
        }
        log('Found dateLabel actor.');

        this._dateLabel = dateLabel;
        this._originalDateText = this._dateLabel.get_text();
        log(`Original date text in notification center: "${this._originalDateText}"`);

        // Use the cached full date string
        const newText = `${this._originalDateText}\n${this._hebrewDateStringWithYear}`;
        log(`Setting new text for notification center: "${newText.replace(/\n/g, '\\n')}"`);
        
        try {
            this._dateLabel.set_text(newText);
            log('Successfully set new date text in notification center.');
        } catch (e) {
            logError(e, 'Failed to set text on dateLabel.');
        }
    }

    _onMenuClosed() {
        log('Executing _onMenuClosed.');
        if (this._dateLabel && this._originalDateText) {
            log(`Restoring original date text: "${this._originalDateText}"`);
            this._dateLabel.set_text(this._originalDateText);
        } else {
            log('No original date text to restore.');
        }
        this._dateLabel = null;
    }

    _onMenuStateChanged(menu, isOpen) {
        log(`Date menu state changed. Is open: ${isOpen}`);
        if (isOpen) {
            this._onMenuOpened();
        } else {
            this._onMenuClosed();
        }
    }

    enable() {
        this._settings = this.getSettings();
        this._reverseGeocoder = new ReverseGeocoder(this.metadata);
        this._loggingSettingsSignal = bindLoggingSetting(this._settings);
        log('Enabling ZmanBar extension.');
        log('KosherZmanim library loaded successfully.');

        this._settingsChangedIdLat = this._settings.connect('changed::latitude', this._onLocationSettingChanged.bind(this));
        this._settingsChangedIdLon = this._settings.connect('changed::longitude', this._onLocationSettingChanged.bind(this));
        this._settingsChangedIdName = this._settings.connect('changed::location-name', this._onLocationSettingChanged.bind(this));

        this._menuStateSignal = this._dateMenu.menu.connect('open-state-changed', this._onMenuStateChanged.bind(this));
        this._createZmanimMenuButton();

        this._useSavedLocation();
        this._updateAndCacheValues(); // Initial update

        // Start a recurring update every second to keep our date visible
        this._clockUpdateTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateClockDisplay();
            return GLib.SOURCE_CONTINUE; // Keep the timeout running
        });

        log('ZmanBar extension enabled successfully.');
    }

    disable() {
        log('Disabling ZmanBar extension.');

        if (this._clockUpdateTimeout) {
            GLib.source_remove(this._clockUpdateTimeout);
            this._clockUpdateTimeout = null;
        }

        if (this._updateTimeout) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = null;
        }

        this._stopAutomaticLocationLookup();
        if (this._reverseGeocoder) {
            this._reverseGeocoder.destroy();
            this._reverseGeocoder = null;
        }

        if (this._settingsChangedIdLat) this._settings.disconnect(this._settingsChangedIdLat);
        if (this._settingsChangedIdLon) this._settings.disconnect(this._settingsChangedIdLon);
        if (this._settingsChangedIdName) this._settings.disconnect(this._settingsChangedIdName);
        if (this._loggingSettingsSignal) this._settings.disconnect(this._loggingSettingsSignal);
        if (this._menuStateSignal) this._dateMenu.menu.disconnect(this._menuStateSignal);

        this._onMenuClosed();
        this._clockDisplay.set_text(this._dateMenu._clock.clock);

        if (this._zmanimMenuButton) {
            this._zmanimMenuButton.destroy();
            this._zmanimMenuButton = null;
        }

        this._settings = null;
        this._location = null;
        this._shkiah = null;
        this._zmanimItems = [];
        this._autoLocationStatus = null;
        
        log('ZmanBar extension disabled.');
    }
}

import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { logError } from "./logging.js";

const GEOCLUE_BUS_NAME = "org.freedesktop.GeoClue2";
const GEOCLUE_MANAGER_PATH = "/org/freedesktop/GeoClue2/Manager";
const GEOCLUE_MANAGER_IFACE = "org.freedesktop.GeoClue2.Manager";
const GEOCLUE_CLIENT_IFACE = "org.freedesktop.GeoClue2.Client";
const GEOCLUE_LOCATION_IFACE = "org.freedesktop.GeoClue2.Location";
const DBUS_PROPERTIES_IFACE = "org.freedesktop.DBus.Properties";

export class GeoclueClient {
	constructor({ desktopId, onLocation, onUnavailable }) {
		this._desktopId = desktopId;
		this._onLocation = onLocation;
		this._onUnavailable = onUnavailable;
		this._clientProxy = null;
		this._locationSignalId = null;
		this._destroyed = false;
		this._starting = false;
		this._requestId = 0;
	}

	start() {
		if (this._clientProxy || this._starting) {
			return;
		}

		this._starting = true;
		const requestId = ++this._requestId;
		this._createSystemProxy(
			GEOCLUE_MANAGER_PATH,
			GEOCLUE_MANAGER_IFACE,
			requestId,
			(managerProxy) => {
				this._callDBus(
					managerProxy,
					"CreateClient",
					null,
					requestId,
					(result) => {
						const [clientPath] = result.deep_unpack();
						this._createSystemProxy(
							clientPath,
							GEOCLUE_CLIENT_IFACE,
							requestId,
							(clientProxy) => {
								this._clientProxy = clientProxy;
								this._locationSignalId = clientProxy.connect(
									"g-properties-changed",
									() => {
										this._readLocation(requestId);
									},
								);

								this._createSystemProxy(
									clientPath,
									DBUS_PROPERTIES_IFACE,
									requestId,
									(propertiesProxy) => {
										this._setDBusProperty(
											propertiesProxy,
											GEOCLUE_CLIENT_IFACE,
											"DesktopId",
											new GLib.Variant("s", this._desktopId),
											requestId,
											() => {
												this._setDBusProperty(
													propertiesProxy,
													GEOCLUE_CLIENT_IFACE,
													"RequestedAccuracyLevel",
													new GLib.Variant("u", 6),
													requestId,
													() => {
														this._callDBus(
															clientProxy,
															"Start",
															null,
															requestId,
															() => {
																this._starting = false;
																this._readLocation(requestId);
															},
														);
													},
												);
											},
										);
									},
								);
							},
						);
					},
				);
			},
		);
	}

	stop() {
		this._starting = false;
		this._requestId++;

		if (!this._clientProxy) {
			return;
		}

		if (this._locationSignalId) {
			this._clientProxy.disconnect(this._locationSignalId);
			this._locationSignalId = null;
		}

		this._clientProxy.call(
			"Stop",
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null,
		);
		this._clientProxy = null;
	}

	destroy() {
		this._destroyed = true;
		this.stop();
	}

	_createSystemProxy(objectPath, interfaceName, requestId, callback) {
		Gio.DBusProxy.new_for_bus(
			Gio.BusType.SYSTEM,
			Gio.DBusProxyFlags.NONE,
			null,
			GEOCLUE_BUS_NAME,
			objectPath,
			interfaceName,
			null,
			(source, result) => {
				if (!this._isCurrentRequest(requestId)) {
					return;
				}

				try {
					callback(Gio.DBusProxy.new_for_bus_finish(result));
				} catch (e) {
					this._fail(e, `Failed to create D-Bus proxy for ${interfaceName}.`);
				}
			},
		);
	}

	_callDBus(proxy, methodName, parameters, requestId, callback) {
		proxy.call(
			methodName,
			parameters,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			(source, result) => {
				if (!this._isCurrentRequest(requestId)) {
					return;
				}

				try {
					callback(source.call_finish(result));
				} catch (e) {
					this._fail(e, `D-Bus method ${methodName} failed.`);
				}
			},
		);
	}

	_setDBusProperty(
		proxy,
		interfaceName,
		propertyName,
		value,
		requestId,
		callback,
	) {
		this._callDBus(
			proxy,
			"Set",
			new GLib.Variant("(ssv)", [interfaceName, propertyName, value]),
			requestId,
			callback,
		);
	}

	_readLocation(requestId) {
		if (!this._clientProxy || !this._isCurrentRequest(requestId)) {
			return;
		}

		const locationVariant = this._clientProxy.get_cached_property("Location");
		const locationPath = locationVariant?.deep_unpack();
		if (!locationPath || locationPath === "/") {
			return;
		}

		this._createSystemProxy(
			locationPath,
			GEOCLUE_LOCATION_IFACE,
			requestId,
			(locationProxy) => {
				const latitude = locationProxy
					.get_cached_property("Latitude")
					?.deep_unpack();
				const longitude = locationProxy
					.get_cached_property("Longitude")
					?.deep_unpack();

				if (typeof latitude === "number" && typeof longitude === "number") {
					this._onLocation?.({ latitude, longitude });
				} else {
					this._onUnavailable?.();
				}
			},
		);
	}

	_isCurrentRequest(requestId) {
		return !this._destroyed && requestId === this._requestId;
	}

	_fail(error, message) {
		this._starting = false;
		logError(error, message);
		this._onUnavailable?.();
	}
}

import GLib from "gi://GLib";

import { log, logError } from "./logging.js";

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

export class DateMenuController {
	constructor(dateMenu, onClockChanged) {
		this._dateMenu = dateMenu;
		this._onClockChanged = onClockChanged;
		this._hebrewDateString = "";
		this._hebrewDateStringWithYear = "";
		this._clockNotifyId = null;
		this._clockIdleId = null;
		this._menuStateSignal = null;
		this._dateLabel = null;
		this._originalDateText = null;
	}

	connect() {
		this._menuStateSignal = this._dateMenu.menu.connect(
			"open-state-changed",
			this._onMenuStateChanged.bind(this),
		);
		this._clockNotifyId = this._dateMenu._clock.connect("notify::clock", () => {
			if (this._clockIdleId) {
				return;
			}

			this._clockIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
				this._clockIdleId = null;
				this._onClockChanged?.();
				this.updateClockDisplay();
				return GLib.SOURCE_REMOVE;
			});
		});
	}

	setHebrewDate(shortDate, fullDate) {
		this._hebrewDateString = shortDate;
		this._hebrewDateStringWithYear = fullDate;
		this.updateClockDisplay();
	}

	updateClockDisplay() {
		const clockText = this._dateMenu._clock.clock;
		this._dateMenu._clockDisplay.set_text(
			`${clockText}  ${this._hebrewDateString}`,
		);
	}

	destroy() {
		if (this._menuStateSignal) {
			this._dateMenu.menu.disconnect(this._menuStateSignal);
			this._menuStateSignal = null;
		}

		if (this._clockNotifyId) {
			this._dateMenu._clock.disconnect(this._clockNotifyId);
			this._clockNotifyId = null;
		}

		if (this._clockIdleId) {
			GLib.source_remove(this._clockIdleId);
			this._clockIdleId = null;
		}

		this._onMenuClosed();
		this._dateMenu._clockDisplay.set_text(this._dateMenu._clock.clock);
	}

	_onMenuOpened() {
		log("Executing _onMenuOpened to update notification center date.");
		const dateLabel = findActorByClassName(
			this._dateMenu.menu.box,
			"date-label",
		);
		if (!dateLabel) {
			logError(
				new Error("Could not find dateLabel actor in notification center."),
			);
			return;
		}

		this._dateLabel = dateLabel;
		this._originalDateText = this._dateLabel.get_text();
		const newText = `${this._originalDateText}\n${this._hebrewDateStringWithYear}`;

		try {
			this._dateLabel.set_text(newText);
		} catch (e) {
			logError(e, "Failed to set text on dateLabel.");
		}
	}

	_onMenuClosed() {
		log("Executing _onMenuClosed.");
		if (this._dateLabel && this._originalDateText) {
			this._dateLabel.set_text(this._originalDateText);
		}
		this._dateLabel = null;
		this._originalDateText = null;
	}

	_onMenuStateChanged(menu, isOpen) {
		log(`Date menu state changed. Is open: ${isOpen}`);
		if (isOpen) {
			this._onMenuOpened();
		} else {
			this._onMenuClosed();
		}
	}
}

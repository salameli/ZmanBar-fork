import GLib from "gi://GLib";

import { log, logError } from "./logging.js";
import { calculateZmanim, toJSDate } from "./zmanimCalculator.js";

export class HebrewDateService {
	constructor(KosherZmanim) {
		this._KosherZmanim = KosherZmanim;
		this._zmanimCalendar = new KosherZmanim.ComplexZmanimCalendar();
		this._hebrewDateFormatter = new KosherZmanim.HebrewDateFormatter();
		this._hebrewDateFormatter.setHebrewFormat(true);
	}

	setLocation(location) {
		if (!location) {
			return;
		}

		const geoLocation = new this._KosherZmanim.GeoLocation(
			location.name,
			location.latitude,
			location.longitude,
			0,
			location.timezone,
		);
		this._zmanimCalendar.setGeoLocation(geoLocation);
	}

	calculate(location, now = new Date()) {
		log(`Recalculating shkiah and Hebrew date for ${now.toLocaleString()}`);

		const shkiah = this._calculateShkiah(location, now);
		let dateForHebrewCalc = now;
		if (shkiah && now >= shkiah) {
			log(
				`Current time is after shkiah (${shkiah.toLocaleTimeString()}). Using tomorrow's date for display.`,
			);
			dateForHebrewCalc = new Date(now.getTime() + 86400000);
		}

		const hebrewDate = this._calculateHebrewDate(dateForHebrewCalc);
		const zmanimItems = location ? calculateZmanim(this._zmanimCalendar) : [];

		log(`Cached new Hebrew date: ${hebrewDate.shortDate}`);
		return {
			...hebrewDate,
			shkiah,
			zmanimItems,
		};
	}

	createLocation(name, latitude, longitude, source) {
		const timezone = GLib.TimeZone.new_local().get_identifier();
		const location = { name, latitude, longitude, timezone, source };
		this.setLocation(location);
		return location;
	}

	_calculateShkiah(location, now) {
		if (!location) {
			return null;
		}

		try {
			this._zmanimCalendar.setDate(now);
			const shkiah = toJSDate(this._zmanimCalendar.getSunset());
			if (!shkiah) {
				logError(
					new Error(
						"Failed to calculate shkiah (sunset) for the given location. The value was null.",
					),
				);
				return null;
			}
			return shkiah;
		} catch (e) {
			logError(
				e,
				"An unexpected error occurred during shkiah (sunset) calculation.",
			);
			return null;
		}
	}

	_calculateHebrewDate(date) {
		try {
			const jewishDate = new this._KosherZmanim.JewishCalendar(date);
			return {
				shortDate: this._formatHebrewDate(jewishDate, false),
				fullDate: this._formatHebrewDate(jewishDate, true),
			};
		} catch (e) {
			logError(
				e,
				"An unexpected error occurred during Hebrew date calculation.",
			);
			return {
				shortDate: "Error",
				fullDate: "Error calculating date",
			};
		}
	}

	_formatHebrewDate(jewishCalendar, withYear) {
		const day = this._hebrewDateFormatter.formatHebrewNumber(
			jewishCalendar.getJewishDayOfMonth(),
		);
		const month = this._hebrewDateFormatter.formatMonth(jewishCalendar);
		if (withYear) {
			const year = this._hebrewDateFormatter.formatHebrewNumber(
				jewishCalendar.getJewishYear(),
			);
			return `${day} ${month} ${year}`;
		}
		return `${day} ${month}`;
	}
}

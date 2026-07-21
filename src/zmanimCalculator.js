import { logError } from "./logging.js";

const ZMANIM_DEFINITIONS = [
	{ label: "Alot Hashachar", method: "getAlosHashachar" },
	{ label: "Netz Hachama", method: "getSunrise" },
	{ label: "Sof Zman Keriat Shema MA", method: "getSofZmanShmaMGA" },
	{ label: "Sof Zman Keriat Shema GRA", method: "getSofZmanShmaGRA" },
	{ label: "Sof Zman Tefila MA", method: "getSofZmanTfilaMGA" },
	{ label: "Sof Zman Tefila GRA", method: "getSofZmanTfilaGRA" },
	{ label: "Chatzot", method: "getChatzos" },
	{ label: "Mincha Gedola", method: "getMinchaGedola" },
	{ label: "Mincha Ketana", method: "getMinchaKetana" },
	{ label: "Plag Hamincha", method: "getPlagHamincha" },
	{ label: "Shekia", method: "getSunset" },
	{ label: "Tzet Hakochavim", method: "getTzais" },
];

export function calculateZmanim(calendar) {
	if (!calendar) {
		return [];
	}

	return ZMANIM_DEFINITIONS.map(({ label, method }) => {
		try {
			const date = toJSDate(calendar[method]());
			return {
				label,
				date,
				time: date ? formatTime(date) : "Unavailable",
			};
		} catch (e) {
			logError(e, `Failed to calculate ${label}.`);
			return { label, date: null, time: "Unavailable" };
		}
	})
		.sort(compareZmanim)
		.map(({ label, time }) => ({ label, time }));
}

export function toJSDate(zman) {
	if (!zman) {
		return null;
	}
	if (zman instanceof Date) {
		return zman;
	}
	if (typeof zman.toJSDate === "function") {
		return zman.toJSDate();
	}
	return null;
}

function compareZmanim(a, b) {
	if (a.date && b.date) {
		return a.date.getTime() - b.date.getTime();
	}
	if (a.date) {
		return -1;
	}
	if (b.date) {
		return 1;
	}
	return 0;
}

function formatTime(date) {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

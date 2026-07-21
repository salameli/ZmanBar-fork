import GLib from "gi://GLib";

import { log } from "./logging.js";

export class UpdateScheduler {
	constructor(callback) {
		this._callback = callback;
		this._timeoutId = null;
	}

	schedule(shkiah) {
		this.clear();

		const now = new Date();
		let nextUpdate;

		if (shkiah && now < shkiah) {
			nextUpdate = shkiah;
			log(
				`Scheduling next update for shkiah at ${nextUpdate.toLocaleTimeString()}`,
			);
		} else {
			nextUpdate = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() + 1,
			);
			log(
				`Scheduling next update for midnight at ${nextUpdate.toLocaleTimeString()}`,
			);
		}

		const secondsToNextUpdate = Math.max(
			1,
			Math.floor((nextUpdate.getTime() - now.getTime()) / 1000),
		);
		this._timeoutId = GLib.timeout_add_seconds(
			GLib.PRIORITY_DEFAULT,
			secondsToNextUpdate,
			() => {
				this._callback?.();
				return GLib.SOURCE_REMOVE;
			},
		);
	}

	clear() {
		if (this._timeoutId) {
			GLib.source_remove(this._timeoutId);
			this._timeoutId = null;
		}
	}

	destroy() {
		this.clear();
		this._callback = null;
	}
}

import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

export class ZmanimMenuButton {
	constructor(uuid, onResetLocation) {
		this._onResetLocation = onResetLocation;
		this._button = new PanelMenu.Button(0.0, "Zmanim");
		this._button.add_child(
			new St.Label({
				text: "Zmanim",
				y_align: Clutter.ActorAlign.CENTER,
			}),
		);

		Main.panel.addToStatusArea(`${uuid}-zmanim`, this._button);
	}

	_createResetLocationIcon() {
		const icon = new St.Widget({
			layout_manager: new Clutter.BinLayout(),
			width: 18,
			height: 18,
		});

		icon.add_child(
			new St.Icon({
				icon_name: "view-refresh-symbolic",
				icon_size: 18,
				x_expand: true,
				y_expand: true,
				x_align: Clutter.ActorAlign.CENTER,
				y_align: Clutter.ActorAlign.CENTER,
			}),
		);
		icon.add_child(
			new St.Icon({
				icon_name: "mark-location-symbolic",
				icon_size: 10,
				x_expand: true,
				y_expand: true,
				x_align: Clutter.ActorAlign.CENTER,
				y_align: Clutter.ActorAlign.CENTER,
				translation_x: -1,
				translation_y: 1,
			}),
		);

		return icon;
	}

	_createResetLocationItem() {
		const item = new PopupMenu.PopupBaseMenuItem();
		item.add_child(this._createResetLocationIcon());
		item.add_child(
			new St.Label({
				text: "Reset Location",
				y_align: Clutter.ActorAlign.CENTER,
			}),
		);
		item.connect("activate", () => {
			this._onResetLocation?.();
		});

		return item;
	}

	update({ location, zmanimItems, status }) {
		this._button.menu.removeAll();

		this._button.menu.addMenuItem(this._createResetLocationItem());
		this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		if (!location) {
			this._button.menu.addMenuItem(
				new PopupMenu.PopupMenuItem(status || "Set a location to view zmanim", {
					reactive: false,
				}),
			);
			return;
		}

		this._button.menu.addMenuItem(
			new PopupMenu.PopupMenuItem(location.name || location.source, {
				reactive: false,
			}),
		);
		this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		for (const zman of zmanimItems) {
			this._button.menu.addMenuItem(
				new PopupMenu.PopupMenuItem(`${zman.label}: ${zman.time}`, {
					reactive: false,
				}),
			);
		}
	}

	destroy() {
		this._button.destroy();
		this._button = null;
	}
}

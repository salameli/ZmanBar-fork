import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

export class ZmanimMenuButton {
    constructor(uuid) {
        this._button = new PanelMenu.Button(0.0, 'Zmanim');
        this._button.add_child(new St.Label({
            text: 'Zmanim',
            y_align: Clutter.ActorAlign.CENTER,
        }));

        Main.panel.addToStatusArea(`${uuid}-zmanim`, this._button);
    }

    update({ location, zmanimItems, status }) {
        this._button.menu.removeAll();

        if (!location) {
            this._button.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                status || 'Set a location to view zmanim',
                { reactive: false }
            ));
            return;
        }

        this._button.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            location.name || location.source,
            { reactive: false }
        ));
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const zman of zmanimItems) {
            this._button.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                `${zman.label}: ${zman.time}`,
                { reactive: false }
            ));
        }
    }

    destroy() {
        this._button.destroy();
        this._button = null;
    }
}

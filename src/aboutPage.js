import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { connectToLogs, getLogs, log } from "./logging.js";

export const createAboutPage = (metadata, settings) => {
	const aboutPage = new Adw.PreferencesPage({
		title: _("About"),
		iconName: "info-symbolic",
	});

	const group = new Adw.PreferencesGroup();
	aboutPage.add(group);

	const clamp = new Adw.Clamp({
		maximum_size: 450,
		margin_top: 24,
		margin_bottom: 24,
	});
	group.add(clamp);

	const box = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
	});
	clamp.set_child(box);

	if (metadata.icon) {
		const icon = new Gtk.Image({
			icon_name: metadata.icon,
			pixel_size: 64,
			margin_bottom: 12,
		});
		box.append(icon);
	}
	const nameLabel = new Gtk.Label({
		use_markup: true,
		label: `<span size="xx-large" weight="bold">${metadata.name}</span>`,
		justify: Gtk.Justification.CENTER,
		margin_bottom: 12,
	});
	box.append(nameLabel);

	const hebrewDateLabel = new Gtk.Label({
		use_markup: true,
		label: `<span size="large" weight="bold">${_("Hebrew Date for GNOME")}</span>`,
		justify: Gtk.Justification.CENTER,
		margin_bottom: 12,
	});
	box.append(hebrewDateLabel);

	const infoGroup = new Adw.PreferencesGroup();
	box.append(infoGroup);

	const versionRow = new Adw.ActionRow({
		title: _("Version"),
		subtitle: "1.0.0",
		icon_name: "info-symbolic",
		activatable: true,
	});
	infoGroup.add(versionRow);

	const developerGroup = new Adw.PreferencesGroup({
		title: _("Developer Settings"),
		visible: false,
	});
	box.append(developerGroup);

	const loggingRow = new Adw.SwitchRow({
		title: _("Enable Logging"),
		subtitle: _("Enable verbose logging for debugging."),
	});
	developerGroup.add(loggingRow);

	const logView = new Gtk.TextView({
		editable: false,
		cursor_visible: true,
		monospace: true,
		wrap_mode: Gtk.WrapMode.WORD_CHAR,
		vexpand: true,
	});

	const scrolledWindow = new Gtk.ScrolledWindow({
		hscrollbar_policy: Gtk.PolicyType.NEVER,
		vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
		child: logView,
		min_content_height: 200,
	});

	developerGroup.add(scrolledWindow);

	const copyButton = new Gtk.Button({
		label: _("Copy"),
		halign: Gtk.Align.END,
		margin_top: 6,
	});
	developerGroup.add(copyButton);

	copyButton.connect("clicked", () => {
		const buffer = logView.get_buffer();
		const [start, end] = buffer.get_bounds();
		const text = buffer.get_text(start, end, false);

		log("Copying logs to clipboard.");
		Gdk.Display.get_default().get_clipboard().set(text);
	});

	settings.bind(
		"enable-logging",
		loggingRow,
		"active",
		Gio.SettingsBindFlags.DEFAULT,
	);

	let clickCount = 0;
	let logsConnected = false;
	const versionClick = new Gtk.GestureClick();
	versionClick.connect("released", () => {
		clickCount++;
		if (clickCount >= 5) {
			developerGroup.set_visible(true);
			if (logsConnected) {
				return;
			}
			logsConnected = true;

			const buffer = logView.get_buffer();

			const logs = getLogs();
			const existingLogText = logs
				.map(
					(log) =>
						`[${log.timestamp.toLocaleTimeString()}] [${log.level}] ${log.message}`,
				)
				.join("\n");
			buffer.set_text(`${existingLogText}\n`, -1);

			connectToLogs((logEntry) => {
				const newLogText = `[${logEntry.timestamp.toLocaleTimeString()}] [${logEntry.level}] ${logEntry.message}\n`;
				buffer.insert_at_cursor(newLogText, -1);
				const adj = scrolledWindow.get_vadjustment();
				adj.set_value(adj.get_upper() - adj.get_page_size());
			});
		}
	});
	versionRow.add_controller(versionClick);

	const githubRow = new Adw.ActionRow({
		title: _("GitHub"),
		subtitle: metadata.url,
		activatable: true,
	});
	const githubIcon = new Gtk.Image({
		icon_name: "web-browser-symbolic",
	});
	githubRow.add_prefix(githubIcon);
	githubRow.connect("activated", () => {
		Gio.AppInfo.launch_default_for_uri(metadata.url, null);
	});

	infoGroup.add(githubRow);

	const devInfoGroup = new Adw.PreferencesGroup({
		margin_bottom: 0,
	});
	box.append(devInfoGroup);

	const originalProjectRow = new Adw.ActionRow({
		title: _("Original project"),
		subtitle: "https://github.com/Dev-in-the-BM/ZmanBar",
		activatable: true,
	});
	const originalProjectIcon = new Gtk.Image({
		icon_name: "web-browser-symbolic",
	});
	originalProjectRow.add_prefix(originalProjectIcon);
	originalProjectRow.connect("activated", () => {
		Gio.AppInfo.launch_default_for_uri(
			"https://github.com/Dev-in-the-BM/ZmanBar",
			null,
		);
	});
	devInfoGroup.add(originalProjectRow);

	return aboutPage;
};

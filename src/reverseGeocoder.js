import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

import { log, logError } from './logging.js';

export class ReverseGeocoder {
    constructor(metadata) {
        this._metadata = metadata;
        this._httpSession = Soup.Session.new();
        this._destroyed = false;
    }

    lookup(latitude, longitude, callback) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        const message = Soup.Message.new('GET', url);
        message.request_headers.append('User-Agent', `GNOME Shell Extension ZmanBar/${this._metadata.version} (${this._metadata.url})`);

        this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            if (this._destroyed) {
                return;
            }

            try {
                const bytes = session.send_and_read_finish(result);
                const response = new TextDecoder().decode(bytes.get_data());
                const data = JSON.parse(response);
                callback(this._formatLocation(data));
            } catch (e) {
                logError(e, 'Failed to reverse geocode automatic location.');
                callback(null);
            }
        });
    }

    destroy() {
        this._destroyed = true;
        this._httpSession.abort();
    }

    _formatLocation(data) {
        const address = data?.address;
        if (!address) {
            return data?.display_name || null;
        }

        const city = address.city || address.town || address.village || address.municipality || address.county;
        const region = address.state || address.region;
        const country = address.country;
        const parts = [city, region, country].filter(Boolean);

        if (parts.length > 0) {
            return parts.join(', ');
        }

        log('Reverse geocoding response did not include address parts.');
        return data?.display_name || null;
    }
}

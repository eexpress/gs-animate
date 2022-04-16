const { GObject, St, Clutter, Gdk, GLib, Gio, GdkPixbuf } = imports.gi;
const Cairo = imports.cairo;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const _ = ExtensionUtils.gettext;
//~ User
const monitor = Main.layoutManager.primaryMonitor;
const _domain = Me.metadata['gettext-domain'];
function lg(s) { log("===" + _domain + "===>" + s); }
const xw = 60;
const xh = 70;
let xFloat;
let timeout;

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			this.resource = Gio.Resource.load(Me.path + '/res.gresource');
			this.resource._register();
			this.loop = 0;
			//~ lg("start");

			this.add_child(new St.Icon({
				gicon : Gio.icon_new_for_string("resource:///img/1.gif"),
				style_class : 'system-status-icon',
			}));

			this.pb = GdkPixbuf.Pixbuf.new_from_resource("/img/sort.png");
			xFloat = new Clutter.Actor({
				name : 'xFloat',
				reactive : true,
				width : xw,
				height : xh,
			});
			this._canvas = new Clutter.Canvas();
			this._canvas.connect('draw', this.on_draw.bind(this));
			this._canvas.set_size(xw, xh);
			xFloat.set_content(this._canvas);
			xFloat.set_position(0, this.randomY());
			timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
				this.loop = (this.loop + 1) % 6;	// 6个动作一组
				this._canvas.invalidate();
				return GLib.SOURCE_CONTINUE;
			});
			xFloat.connect("button-press-event", (a) => {
				if (a.get_position()[0] == 0) {
					this.horizontalMove(a);
				}
				return Clutter.EVENT_STOP;
			});
		}

		on_draw(canvas, ctx, width, height) {
			const xx = 0 + this.loop * xw;
			lg(xx);
			const yy = 0;
			ctx.setOperator(Cairo.Operator.CLEAR);
			ctx.paint();
			ctx.setOperator(Cairo.Operator.SOURCE);
			Gdk.cairo_set_source_pixbuf(ctx, this.pb, -xx, -yy);
			ctx.paint();
		};

		horizontalMove(a) {
			let [xPos, yPos] = a.get_position();
			let newX = monitor.width;

			a.ease({
				x : newX,
				duration : 30000,
				mode : Clutter.AnimationMode.LINEAR,
				onComplete : () => {
					a.set_position(0, this.randomY());
				}
			});
		};

		randomY() {
			let Y = Math.ceil(Math.random() * monitor.height);
			if (Y > monitor.height - xh) { Y = monitor.height - xh; }
			return Y;
		};
	});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;

		ExtensionUtils.initTranslations();
	}

	enable() {
		this._indicator = new Indicator();
		Main.panel.addToStatusArea(this._uuid, this._indicator);
		Main.layoutManager.addChrome(xFloat, {});
	}

	disable() {
		if (timeout) {
			GLib.source_remove(timeout);
			timeout = null;
		}
		Main.layoutManager.removeChrome(xFloat);
		xFloat = null;
		this._indicator.destroy();
		this._indicator = null;
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}

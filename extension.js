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

let xFloat;
let timeout;

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			// 使用 png 通用格式，内部为方块横向排列，按照图片高度，确定动作帧数。
			this.colPNG = 0;
			this.fn = 1;

			this.add_child(new St.Icon({
				gicon : Gio.icon_new_for_string(Me.path + "/img/0.gif"),
				style_class : 'system-status-icon',
			}));
			this.connect("button-press-event", (actor, event) => {
				xFloat.visible = !xFloat.visible;
			});
			this.connect("scroll-event", (actor, event) => {	//滚轮切换动作
				const max = 4;	//只认4个动作
				switch (event.get_scroll_direction()) {
				case Clutter.ScrollDirection.DOWN:
					this.fn++;
					if (this.fn > max) { this.fn = 1; }
					break;
				case Clutter.ScrollDirection.UP:
					this.fn--;
					if (this.fn < 1) { this.fn = max; }
					break;
				}
				this.reload(this.fn);
			});

			xFloat = new Clutter.Actor({
				name : 'xFloat',
				reactive : true,
			});
			this._canvas = new Clutter.Canvas();
			this._canvas.connect('draw', this.on_draw.bind(this));
			xFloat.set_content(this._canvas);
			this.reload(this.fn);
			timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
				this.colPNG = (this.colPNG + 1) % this.cnt;
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

		reload(fn) {
			this.pb = GdkPixbuf.Pixbuf.new_from_file(`${Me.path}/img/${fn.toString()}.png`);
			if (this.pb == null) return;
			this.XY = this.pb.height;
			this.cnt = Math.round(this.pb.width / this.XY);
			xFloat.width = this.XY;
			xFloat.height = this.XY;
			this._canvas.set_size(this.XY, this.XY);
			xFloat.set_position(0, this.randomY());
		};

		on_draw(canvas, ctx, width, height) {
			ctx.setOperator(Cairo.Operator.CLEAR);
			ctx.paint();
			ctx.setOperator(Cairo.Operator.SOURCE);
			Gdk.cairo_set_source_pixbuf(ctx, this.pb, -this.colPNG * this.XY, 0);
			ctx.paint();
		};

		horizontalMove(a) {
			let newX = monitor.width;
			a.ease({
				x : newX,
				duration : 10000,
				mode : Clutter.AnimationMode.LINEAR,
				onComplete : () => {
					a.set_position(0, this.randomY());
				}
			});
		};

		randomY() {
			let Y = Math.ceil(Math.random() * monitor.height);
			if (Y > monitor.height - this.XY) { Y = monitor.height - this.XY; }
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

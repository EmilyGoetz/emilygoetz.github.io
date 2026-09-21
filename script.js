(function () {
	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Each window is declared in index.html and described with data attributes:
	     data-win        its id, used by the buttons that open, minimize and close it
	     data-icon       emoji shown in its title bar, taskbar button, Start entry and My Computer entry
	     data-name       file / program name (same places, plus the button labels)
	     data-title      title bar text, if it differs from the name
	     data-task-text  taskbar text, if it differs from the name
	     data-menu       comma-separated menu bar items
	     data-file       list it in My Computer
	     data-start      "menu" or "programs": list it in the Start menu
	   An element inside a window can carry data-autofocus to take focus whenever that window is opened or brought forward.
	   Whatever a window doesn't already contain (title bar, taskbar button) is built here. Everything visible on first
	   load is written out in the HTML, so the page looks the same before this script runs or without it. */
	function make(tag, props, kids) {
		var e = document.createElement(tag);
		Object.keys(props || {}).forEach(function (k) { if (k === 'text') e.textContent = props[k]; else e.setAttribute(k, props[k]); });
		(kids || []).forEach(function (c) { e.appendChild(c); });
		return e;
	}
	(function () {
		var startMenu = document.getElementById('start'), taskStrip = document.querySelector('.tasks');
		var programs = startMenu.querySelector('ul.sub'), programsItem = startMenu.querySelector('li.has-sub');
		var fileList = document.querySelector('.files'), fileCount = document.querySelector('[data-file-count]'), files = 0;
		document.querySelectorAll('.win').forEach(function (w) {
			var id = w.dataset.win, d = w.dataset;
			if (!w.querySelector('.titlebar')) {
				var bar = make('div', { 'class': 'titlebar' }, [
					document.createTextNode(d.icon + ' ' + (d.title || d.name)),
					make('span', { 'class': 'btns' }, [
						make('button', { 'class': 'tb', type: 'button', 'data-min': id, 'aria-label': 'Minimize ' + d.name, text: '_' }),
						make('span', { 'class': 'tb', 'aria-hidden': 'true', text: '□' }),
						make('button', { 'class': 'tb', type: 'button', 'data-close': id, 'aria-label': 'Close ' + d.name, text: '×' })
					])
				]);
				w.insertBefore(bar, w.firstChild);
				if (d.menu) {
					bar.after(make('div', { 'class': 'menubar' }, d.menu.split(',').map(function (m) { return make('span', { text: m }); })));
				}
			}
			if (!document.querySelector('[data-task="' + id + '"]')) {
				var task = make('button', { 'class': 'task', type: 'button', 'data-task': id, 'aria-label': d.name }, [
					make('span', { 'aria-hidden': 'true', text: d.icon }),
					make('span', { 'class': 'lb', 'aria-hidden': 'true', text: ' ' + (d.taskText || d.name) })
				]);
				if (w.classList.contains('is-gone')) task.hidden = true;
				taskStrip.appendChild(task);
			}
			if (d.start) {
				var entry = make('li', {}, [make('button', { type: 'button', 'data-open': id }, [make('span', { 'class': 'ico', text: d.icon }), document.createTextNode(d.name)])]);
				if (d.start === 'programs') programs.appendChild(entry); else programsItem.before(entry);
			}
			if ('file' in d && fileList) {
				fileList.appendChild(make('button', { 'class': 'file', type: 'button', 'data-open': id }, [make('b', { text: d.icon }), make('span', { text: d.name })]));
				files++;
			}
		});
		if (fileCount) fileCount.textContent = files + ' object(s)';
	})();

	var wins = {}, tasks = {}, z = 10, active = null;
	document.querySelectorAll('.win').forEach(function (w) { wins[w.dataset.win] = w; });
	document.querySelectorAll('[data-task]').forEach(function (t) { tasks[t.dataset.task] = t; });
	var ids = Object.keys(wins);
	var start = document.getElementById('start');
	var taskbar = document.querySelector('.taskbar');

	function gone(w) { return w.classList.contains('is-gone'); }
	function setActive(w) {
		active = w;
		ids.forEach(function (id) { tasks[id].classList.toggle('on', wins[id] === w); });
	}
	function raise(w) { if (+w.style.zIndex !== z) w.style.zIndex = ++z; setActive(w); } /* a window already on top isn't restyled again */
	function topVisible() {
		var best = null;
		ids.forEach(function (id) {
			var w = wins[id];
			if (gone(w)) return;
			if (!best || (+w.style.zIndex || 0) > (+best.style.zIndex || 0)) best = w;
		});
		return best;
	}
	function delta(w, id) {
		var r = w.getBoundingClientRect(), t = tasks[id].getBoundingClientRect();
		return [t.left + t.width / 2 - (r.left + r.width / 2), t.top + t.height / 2 - (r.top + r.height / 2)];
	}
	function play(w, cls, done) {
		var over = false;
		function end() {
			if (over) return;
			over = true;
			w.removeEventListener('animationend', onEnd);
			w.classList.remove(cls);
			if (done) done();
		}
		function onEnd(e) { if (e.target === w) end(); }
		w.addEventListener('animationend', onEnd);
		w.classList.add(cls);
		setTimeout(end, 700);
	}

	function hide(id, kind) {
		var w = wins[id];
		/* closing (unlike minimizing) removes the taskbar button, even for a window that's already minimized */
		if (kind === 'close' && !w.dataset.busy) tasks[id].hidden = true;
		if (gone(w) || w.dataset.busy) return;
		function finish() {
			w.classList.add('is-gone');
			if (kind === 'close') { w.style.removeProperty('--sy'); w.style.removeProperty('--vp'); }
			delete w.dataset.busy;
			if (active === w) { var n = topVisible(); if (n) raise(n); else setActive(null); }
		}
		if (reduce) { finish(); return; }
		w.dataset.busy = '1';
		if (kind === 'min') {
			var d = delta(w, id);
			w.style.setProperty('--mx', d[0] + 'px');
			w.style.setProperty('--my', d[1] + 'px');
		}
		play(w, kind === 'min' ? 'minimizing' : 'closing', finish);
	}

	/* on phones the windows stack down the page, so bring the tapped one into view */
	function reveal(w, smooth) {
		if (!mq.matches) return;
		w.scrollIntoView({ block: 'nearest', behavior: smooth && !reduce ? 'smooth' : 'auto' });
	}

	function focusIn(w) {
		var f = w.querySelector('[data-autofocus]');
		if (f) f.focus({ preventScroll: true }); /* the window is already brought into view by reveal() */
	}

	function show(id) {
		var w = wins[id];
		if (w.dataset.busy) return;
		/* a button coming back joins the end of the strip, like a newly opened window */
		var wasClosed = tasks[id].hidden;
		if (wasClosed) { tasks[id].hidden = false; tasks[id].parentNode.appendChild(tasks[id]); }
		if (!gone(w)) {
			raise(w);
			reveal(w, true);
			focusIn(w);
			if (!reduce) { w.classList.remove('bump'); void w.offsetWidth; play(w, 'bump'); }
			return;
		}
		if (wasClosed) { /* a window opened from closed starts fresh; a minimized one comes back just as it was */
			w.style.setProperty('--sy', window.scrollY + 'px'); /* floating windows open where you're looking */
			w.style.setProperty('--vp', window.innerHeight + 'px');
			resetPosition(w); /* wherever it was dragged to last time */
			w.dispatchEvent(new CustomEvent('coldopen')); /* lets a window clear whatever it was holding */
		}
		w.classList.remove('is-gone');
		reveal(w, false); /* jump first (not smooth) so the animation below measures the window where it will end up */
		raise(w);
		focusIn(w);
		if (reduce) return;
		var d = delta(w, id);
		w.style.setProperty('--mx', d[0] + 'px');
		w.style.setProperty('--my', d[1] + 'px');
		w.dataset.busy = '1';
		play(w, 'restoring', function () { delete w.dataset.busy; });
	}

	/* a light haptic tick on phones that support it (Android; iOS Safari has no vibration API) */
	function buzz() { if ('vibrate' in navigator && !reduce) navigator.vibrate(10); }

	/* buttons */
	document.querySelectorAll('[data-min]').forEach(function (b) { b.addEventListener('click', function () { buzz(); hide(b.dataset.min, 'min'); }); });
	document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { buzz(); hide(b.dataset.close, 'close'); }); });
	document.querySelectorAll('[data-open]').forEach(function (b) {
		b.addEventListener('click', function () { buzz(); start.open = false; show(b.dataset.open); });
	});
	ids.forEach(function (id) {
		tasks[id].addEventListener('click', function () {
			buzz();
			var w = wins[id];
			if (gone(w)) show(id);
			else if (w === active) hide(id, 'min');
			else { raise(w); reveal(w, true); }
		});
	});
	document.getElementById('shutdown').addEventListener('click', function () {
		buzz();
		start.open = false;
		ids.forEach(function (id, i) { setTimeout(function () { hide(id, 'close'); }, reduce ? 0 : i * 120); });
	});

	/* start menu: close on outside click / Escape */
	document.addEventListener('pointerdown', function (e) { if (!start.contains(e.target)) start.open = false; });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape') start.open = false; });
	start.querySelector('summary').addEventListener('click', buzz);

	/* windows come to the front when pressed anywhere. A finger that lands on one to scroll the page doesn't count: on
	   touch the window is raised when the finger lifts, and the browser cancels the touch instead when it becomes a
	   scroll. Title bars and the canvas never scroll, so they raise straight away (dragging needs that). */
	ids.forEach(function (id) {
		var w = wins[id], armed = null;
		w.addEventListener('pointerdown', function (e) {
			if (w.dataset.busy) return;
			if (e.pointerType === 'touch' && !e.target.closest('.titlebar, canvas')) { armed = e.pointerId; return; }
			raise(w);
		});
		w.addEventListener('pointerup', function (e) {
			if (armed !== e.pointerId) return;
			armed = null;
			if (!w.dataset.busy) raise(w);
		});
		w.addEventListener('pointercancel', function (e) { if (armed === e.pointerId) armed = null; });
	});

	/* dragging by the title bar */
	var drag = null;
	function onMove(e) {
		if (!drag || e.pointerId !== drag.pid) return;
		if (e.pointerType === 'mouse' && e.buttons === 0) { onEnd(e); return; }
		var r = drag.rect, tbH = 28, keep = 90;
		var left = r.left + (e.clientX - drag.sx), top = r.top + (e.clientY - drag.sy);
		var minTop = Math.min(0, r.top), maxTop = Math.max(window.innerHeight - taskbar.offsetHeight - tbH, r.top);
		var minLeft = Math.min(keep - r.width, r.left), maxLeft = Math.max(window.innerWidth - keep, r.left);
		left = Math.min(Math.max(left, minLeft), maxLeft);
		top = Math.min(Math.max(top, minTop), maxTop);
		var x = drag.ox + (left - r.left), y = drag.oy + (top - r.top);
		drag.w.dataset.x = x; drag.w.dataset.y = y;
		drag.w.style.translate = x + 'px ' + y + 'px';
	}
	function onEnd(e) {
		if (!drag || e.pointerId !== drag.pid) return;
		drag.w.classList.remove('dragging');
		document.body.classList.remove('is-dragging');
		drag = null;
	}
	document.querySelectorAll('.titlebar').forEach(function (bar) {
		bar.addEventListener('pointerdown', function (e) {
			if (e.button !== 0 || e.target.closest('button')) return;
			var w = bar.closest('.win');
			if (w.dataset.busy) return;
			/* preventDefault() below also stops the browser from moving focus off a text box, and a text box that keeps focus
			   brings the keyboard back up on phones, so let go of it here */
			var held = document.activeElement;
			if (held && held !== document.body && held.blur) held.blur();
			drag = { w: w, pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: +w.dataset.x || 0, oy: +w.dataset.y || 0, rect: w.getBoundingClientRect() };
			bar.setPointerCapture(e.pointerId);
			if (e.pointerType === 'touch') buzz();
			w.classList.add('dragging');
			document.body.classList.add('is-dragging');
			e.preventDefault();
		});
		bar.addEventListener('pointermove', onMove);
			bar.addEventListener('contextmenu', function (e) { if (drag) e.preventDefault(); }); /* a long press on a title bar shouldn't open the browser's menu */
		bar.addEventListener('pointerup', onEnd);
		bar.addEventListener('pointercancel', onEnd);
		bar.addEventListener('lostpointercapture', onEnd);
	});

	/* layout changes between desktop and phone: put the windows back where they started */
	var mq = window.matchMedia('(max-width: 760px)'); /* the phone breakpoint from style.css */
	function resetPosition(w) { w.style.translate = ''; delete w.dataset.x; delete w.dataset.y; }
	function resetPositions() { ids.forEach(function (id) { resetPosition(wins[id]); }); }
	if (mq.addEventListener) mq.addEventListener('change', resetPositions);

	raise(wins.about);

	/* start menu: Programs flyout (click for touch, hover/focus handled in CSS) */
	document.querySelectorAll('#start li.has-sub > button').forEach(function (b) {
		b.addEventListener('click', function () { buzz(); b.parentElement.classList.toggle('open'); });
	});
	start.addEventListener('toggle', function () {
		if (!start.open) start.querySelectorAll('li.has-sub.open').forEach(function (li) { li.classList.remove('open'); });
	});

	/* paint */
	(function () {
		var cv = document.getElementById('pCanvas'), ctx = cv.getContext('2d', { willReadFrequently: true }); /* undo reads the canvas back at the start of every stroke */
		var cur = document.getElementById('pCur'), pos = document.getElementById('pPos');
		var palette = [
			['#3a2f4a', 'ink'], ['#7a6d8c', 'grey'], ['#e0559f', 'hot pink'], ['#ff8fc8', 'pink'],
			['#d9622b', 'terracotta'], ['#ffc9a8', 'peach'], ['#f2b400', 'gold'], ['#fff3a8', 'butter'],
			['#4cc38a', 'green'], ['#b9e4c9', 'mint'], ['#3aa0e8', 'blue'], ['#a9d6ef', 'sky'],
			['#7b4fa3', 'purple'], ['#a98cf0', 'lavender'], ['#d9c7f5', 'lilac'], ['#ffffff', 'white']
		];
		var tool = 'pencil', color = '#3a2f4a', stamp = '', widths = { pencil: 2, brush: 8, eraser: 16 };
		var drawing = false, last = null, sprayTimer = 0, undo = [];

		ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);

		/* Paint's buttons act when the finger lifts on the same button rather than waiting for a click: on Android Chrome a
		   quick tap straight after a stroke is delivered as pointerdown + pointerup but never becomes a click. Clicks still
		   count (keyboard, assistive tech), and one that follows a tap already handled here is ignored. */
		function onTap(el, fn) {
			var downId = null, handledAt = 0;
			el.addEventListener('pointerdown', function (e) { downId = e.isPrimary && e.button === 0 ? e.pointerId : null; });
			el.addEventListener('pointerup', function (e) {
				if (downId !== e.pointerId) return;
				downId = null;
				var r = el.getBoundingClientRect();
				if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; /* the finger slid off */
				handledAt = e.timeStamp; buzz(); fn();
			});
			el.addEventListener('click', function (e) { if (e.timeStamp - handledAt > 500) { buzz(); fn(); } });
		}

		var sw = document.getElementById('pSwatches');
		palette.forEach(function (p, i) {
			var b = document.createElement('button');
			b.type = 'button'; b.className = 'sw' + (i === 0 ? ' on' : '');
			b.style.background = p[0]; b.setAttribute('aria-label', p[1]);
			onTap(b, function () {
				color = p[0]; cur.style.background = color;
				sw.querySelectorAll('.sw').forEach(function (s) { s.classList.toggle('on', s === b); });
				if (tool === 'eraser' || stamp) pick('pencil');
			});
			sw.appendChild(b);
		});
		cur.style.background = color;

		var toolBtns = document.querySelectorAll('.pnt-tools [data-tool], .pnt-tools [data-stamp]');
		function pick(t, s) {
			tool = t; stamp = s || '';
			toolBtns.forEach(function (b) {
				var on = s ? b.dataset.stamp === s : (b.dataset.tool === t);
				b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
			});
		}
		toolBtns.forEach(function (b) {
			onTap(b, function () { b.dataset.stamp ? pick('stamp', b.dataset.stamp) : pick(b.dataset.tool); });
		});

		function snapshot() { undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 20) undo.shift(); }
		onTap(document.getElementById('pUndo'), function () { if (undo.length) ctx.putImageData(undo.pop(), 0, 0); });
		onTap(document.getElementById('pClear'), function () {
			snapshot(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
		});

		function pt(e) {
			var r = cv.getBoundingClientRect();
			return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
		}
		function dot(p, w, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, 6.2832); ctx.fill(); }
		function line(a, b, w, c) {
			ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
			ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
		}
		function spray(p) {
			ctx.fillStyle = color;
			for (var i = 0; i < 16; i++) {
				var a = Math.random() * 6.2832, r = Math.random() * 13;
				ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 2, 2);
			}
		}

		cv.addEventListener('pointerdown', function (e) {
			if (e.button !== 0) return;
			e.preventDefault();
			cv.setPointerCapture(e.pointerId);
			snapshot();
			var p = pt(e);
			if (tool === 'stamp') {
				ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
				ctx.fillText(stamp, p.x, p.y);
				return;
			}
			drawing = true; last = p;
			if (tool === 'spray') { spray(p); sprayTimer = setInterval(function () { spray(last); }, 30); }
			else dot(p, widths[tool], tool === 'eraser' ? '#fff' : color);
		});
		cv.addEventListener('pointermove', function (e) {
			var p = pt(e);
			if (e.pointerType !== 'touch') pos.textContent = Math.round(p.x) + ', ' + Math.round(p.y); /* a finger has no hover position, so skip the layout work */
			if (!drawing) return;
			if (e.pointerType === 'mouse' && e.buttons === 0) { stop(); return; }
			if (tool === 'spray') { last = p; return; }
			line(last, p, widths[tool], tool === 'eraser' ? '#fff' : color);
			last = p;
		});
		function stop() { drawing = false; clearInterval(sprayTimer); }
		cv.addEventListener('pointerup', stop);
		cv.addEventListener('pointercancel', stop);
		cv.addEventListener('pointerleave', function () { pos.innerHTML = '&nbsp;'; });
	})();

	/* cool text generator */
	(function () {
		var input = document.getElementById('ctInput'), out = document.getElementById('ctOut'), count = document.getElementById('ctCount');
		var chars = function (s) { return Array.from(s); };
		function swap(map, s) { return chars(s).map(function (c) { return map[c] !== undefined ? map[c] : c; }).join(''); }
		function cp(n) { return String.fromCodePoint(n); }
		function letters(upper, lower) {
			var m = {}, i;
			for (i = 0; i < 26; i++) { m[cp(65 + i)] = cp(upper + i); m[cp(97 + i)] = cp(lower + i); }
			return m;
		}
		function math(upper, lower, digit, holes) {
			var m = letters(upper, lower), i;
			if (digit) for (i = 0; i < 10; i++) m[String(i)] = cp(digit + i);
			Object.keys(holes || {}).forEach(function (k) { m[k] = cp(holes[k]); });
			return m;
		}
		/* letters only: `from` and `to` line up one to one, and capitals reuse the lowercase forms */
		function pairs(from, to, capsToo) {
			var m = {}, f = chars(from), t = chars(to);
			f.forEach(function (c, i) { m[c] = t[i]; if (capsToo) m[c.toUpperCase()] = t[i]; });
			return m;
		}
		var abc = 'abcdefghijklmnopqrstuvwxyz', ABC = abc.toUpperCase(), nums = '0123456789';
		function circled(upper, lower, ones, zero) {
			var m = letters(upper, lower), i;
			for (i = 1; i < 10; i++) m[String(i)] = cp(ones + i - 1);
			m['0'] = cp(zero);
			return m;
		}

		var script = math(0x1D49C, 0x1D4B6, 0, { B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B, e: 0x212F, g: 0x210A, o: 0x2134 });
		var boldScript = math(0x1D4D0, 0x1D4EA, 0x1D7CE);
		var fraktur = math(0x1D504, 0x1D51E, 0, { C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 });
		var boldFraktur = math(0x1D56C, 0x1D586, 0x1D7CE);
		var doubleStruck = math(0x1D538, 0x1D552, 0x1D7D8, { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 });
		var smallCaps = pairs(abc, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ', true);
		var flip = pairs(ABC + abc + nums + ".,'!?()[]{}<>&_", '∀ᗺƆᗡƎℲ⅁HIſ⋊˥WNOԀΌᴚS⊥∩ΛMX⅄Z' + 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz' + '0ƖᄅƐㄣϛ9ㄥ86' + "˙',¡¿)(][}{><⅋‾");
		var tiny = Object.assign(pairs(abc, 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ', true), pairs(nums, '⁰¹²³⁴⁵⁶⁷⁸⁹'));
		var bubbles = circled(0x24B6, 0x24D0, 0x2460, 0x24EA);
		var darkBubbles = Object.assign(pairs(abc, '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩', true), pairs(nums, '⓿❶❷❸❹❺❻❼❽❾'));
		var squares = pairs(abc, '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉', true);
		var darkSquares = pairs(abc, '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉', true);
		var curvy = pairs(abc, 'ᗩᗷᑕᗪᗴᖴᘜᕼIᒍKᒪᗰᑎOᑭᑫᖇᏚTᑌᐯᗯ᙭Yᘔ', true);
		var squiggly = pairs(abc, 'ꪖ᥇ᥴᦔꫀᠻᧁꫝỉʝᛕꪶꪑꪀꪮρꪇɾ᥉ꪻꪊꪜ᭙᥊ꪗɀ', true);
		var mirror = pairs(ABC + abc + '3?()[]{}<>/\\', 'AᗺƆᗡƎꟻGHIႱꓘ⅃MИOꟼϘЯƧTUVWXYƸ' + 'ɒdɔbɘꟻϱʜiįʞlmᴎoqpɿƨƚuvwxyz' + 'Ɛ⸮)(][}{><\\/');

		function wide(s) {
			return chars(s).map(function (c) { var n = c.charCodeAt(0); return c === ' ' ? '　' : n > 32 && n < 127 ? cp(n + 0xFEE0) : c; }).join('');
		}
		function backwards(map, reverseLines) { /* flipping the letters and reading them backwards; upside down also reverses the lines, a mirror keeps their order */
			return function (s) {
				var lines = s.split('\n').map(function (l) { return chars(swap(map, l)).reverse().join(''); });
				return (reverseLines ? lines.reverse() : lines).join('\n');
			};
		}
		function combine(mark) { return function (s) { return chars(s).map(function (c) { return /\s/.test(c) ? c : c + mark; }).join(''); }; }
		function using(map) { return function (s) { return swap(map, s); }; }

		var styles = [
			['Script', using(script)],
			['Bold Script', using(boldScript)],
			['Gothic', using(fraktur)],
			['Bold Gothic', using(boldFraktur)],
			['Double-Struck', using(doubleStruck)],
			['Bubbles', using(bubbles)],
			['Dark Bubbles', using(darkBubbles)],
			['Squares', using(squares)],
			['Dark Squares', using(darkSquares)],
			['Curvy', using(curvy)],
			['Squiggly', using(squiggly)],
			['Bold', using(math(0x1D400, 0x1D41A, 0x1D7CE))],
			['Italic', using(math(0x1D434, 0x1D44E, 0, { h: 0x210E }))],
			['Bold Italic', using(math(0x1D468, 0x1D482, 0x1D7CE))],
			['Sans', using(math(0x1D5A0, 0x1D5BA, 0x1D7E2))],
			['Sans Bold', using(math(0x1D5D4, 0x1D5EE, 0x1D7EC))],
			['Sans Italic', using(math(0x1D608, 0x1D622, 0x1D7E2))],
			['Sans Bold Italic', using(math(0x1D63C, 0x1D656, 0x1D7EC))],
			['Monospace', using(math(0x1D670, 0x1D68A, 0x1D7F6))],
			['Wide', wide],
			['Small Caps', using(smallCaps)],
			['Tiny', using(tiny)],
			['Upside Down', backwards(flip, true)],
			['Mirror', backwards(mirror, false)],
			['Strikethrough', combine('̶')],
			['Underline', combine('̲')]
		];

		var rows = styles.map(function (st) {
			var text = make('span', { 'class': 'tx' }), cue = make('span', { 'class': 'cp', text: 'Copy' }), timer = 0;
			var b = make('button', { 'class': 'ctg-row', type: 'button' }, [make('small', {}, [make('span', { text: st[0] }), cue]), text]);
			b.addEventListener('click', function () {
				if (!navigator.clipboard) return;
				buzz();
				navigator.clipboard.writeText(text.textContent).then(function () {
					cue.textContent = 'Copied!';
					clearTimeout(timer);
					timer = setTimeout(function () { cue.textContent = 'Copy'; }, 1200);
				}, function () {});
			});
			out.appendChild(b);
			return text;
		});

		function render() {
			var s = input.value;
			count.textContent = s.length + ' / ' + input.maxLength;
			out.classList.toggle('empty', !s);
			if (s) styles.forEach(function (st, i) { rows[i].textContent = st[1](s); });
		}
		input.addEventListener('input', render);
		input.closest('.win').addEventListener('coldopen', function () { input.value = ''; out.scrollTop = 0; render(); }); /* reopened after closing: start over */
		render();
	})();

	/* taskbar buttons show their names while there's room for all of them, and fall back to just their icons when there isn't
	   (measured rather than tied to a screen width, since the number of open windows changes how much room they need) */
	var strip = document.querySelector('.tasks');
	function fitTasks() {
		strip.classList.remove('icons-only');
		if (strip.scrollWidth > strip.clientWidth) strip.classList.add('icons-only');
	}
	window.addEventListener('resize', fitTasks);
	new MutationObserver(fitTasks).observe(strip, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
	fitTasks();

	/* clock */
	var clock = document.getElementById('clock');
	function tick() { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); fitTasks(); } /* the clock's width changes with the time */
	tick(); setInterval(tick, 30000);

	/* sparkle cursor trail */
	if (window.matchMedia('(pointer: fine)').matches && !reduce) {
		var lastSpark = 0, glyphs = ['✨', '✦', '★', '♡'];
		document.addEventListener('mousemove', function (e) {
			var now = Date.now();
			if (now - lastSpark < 45) return;
			lastSpark = now;
			var s = document.createElement('span');
			s.className = 'spark';
			s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
			s.style.left = e.clientX + 6 + 'px';
			s.style.top = e.clientY + 6 + 'px';
			document.body.appendChild(s);
			setTimeout(function () { s.remove(); }, 800);
		});
	}
})();

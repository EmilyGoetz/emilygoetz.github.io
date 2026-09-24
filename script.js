(function () {
	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Each window is declared in _layouts/desktop.html and described with data attributes:
	     data-win        its id, used by the buttons that open, minimize and close it
	     data-url        gives it its own address (/paint/): the address bar follows whichever window is on top, and that
	                     page opens with the window already in front
	     data-src        a document window that's empty here: its text is loaded from this page the first time it opens
	     data-landing    the window this page is for (Paint on /paint/): centered on the desktop until it's closed
	     data-page-title browser tab title (Emily Goetz | ...) while it's on top, if it differs from the name
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

	/* The address bar and tab title follow the window on top: its data-url if it has one (/paint/), / for the rest. It replaces
	   the current history entry rather than adding one, so Back leaves the site instead of stepping through windows. */
	var homeTitle = document.body.dataset.homeTitle || document.title, routed = false;
	function syncUrl() {
		if (!routed) return; /* until the page's own window has been opened, don't overwrite the address it loaded with */
		var url = active && active.dataset.url || '/';
		document.title = active && active.dataset.url ? 'Emily Goetz | ' + (active.dataset.pageTitle || active.dataset.name) : homeTitle;
		if (location.pathname === url) return;
		try { history.replaceState(null, '', url); } catch (e) {} /* not allowed from a file:// page */
	}

	function gone(w) { return w.classList.contains('is-gone'); }
	function setActive(w) {
		active = w;
		ids.forEach(function (id) { tasks[id].classList.toggle('on', wins[id] === w); });
		syncUrl();
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
			if (kind === 'close') { w.style.removeProperty('--sy'); w.style.removeProperty('--vp'); delete w.dataset.landing; }
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

	/* A document window's text lives in its own page, which has the same window written out open: copy its content across.
	   Until it arrives the window opens empty; if it fails, it says so and tries again the next time it's opened. */
	function load(w) {
		var src = w.dataset.src, box = w.querySelector('.content');
		if (!src || w.dataset.loading) return;
		w.dataset.loading = '1';
		fetch(src).then(function (r) {
			if (!r.ok) throw new Error(r.status);
			return r.text();
		}).then(function (html) {
			var page = new DOMParser().parseFromString(html, 'text/html');
			var text = page.querySelector('[data-win="' + w.dataset.win + '"] .content');
			if (!text) throw new Error('no window');
			box.replaceChildren.apply(box, Array.from(text.childNodes));
			delete w.dataset.src;
		}).catch(function () {
			box.replaceChildren(make('p', { text: 'Couldn’t open ' + w.dataset.name + '. Close it and try again?' }));
		}).then(function () { delete w.dataset.loading; });
	}

	/* a little bounce, so a window that's already open shows it's the one being asked for, even when nothing covered it
	   (not when the window itself is pressed: it's plain which one that is) */
	function bump(w) {
		if (reduce) return;
		w.classList.remove('bump'); void w.offsetWidth; /* restart it if it's already playing */
		play(w, 'bump');
	}

	/* instant: skip the animation, focus and scrolling (for the window a page loads with) */
	function show(id, instant) {
		var w = wins[id];
		if (w.dataset.busy) return;
		load(w);
		/* a button coming back joins the end of the strip, like a newly opened window */
		var wasClosed = tasks[id].hidden;
		if (wasClosed) { tasks[id].hidden = false; tasks[id].parentNode.appendChild(tasks[id]); }
		if (!gone(w)) {
			raise(w);
			if (instant) return; /* a document's own page, which is written out with its window already open */
			reveal(w, true);
			focusIn(w);
			bump(w);
			return;
		}
		if (wasClosed) { /* a window opened from closed starts fresh; a minimized one comes back just as it was */
			if (mq.matches) { /* on phones, where the page scrolls, floating windows open where you're looking */
				w.style.setProperty('--sy', window.scrollY + 'px');
				w.style.setProperty('--vp', window.innerHeight + 'px');
			}
			resetPosition(w); /* wherever it was dragged to last time */
			w.dispatchEvent(new CustomEvent('coldopen')); /* lets a window clear whatever it was holding */
		}
		w.classList.remove('is-gone');
		reveal(w, false); /* jump first (not smooth) so the animation below measures the window where it will end up */
		raise(w);
		if (!instant) focusIn(w);
		if (reduce || instant) return;
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
			else { raise(w); reveal(w, true); bump(w); }
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

	/* layout changes between desktop and phone: put the windows back where they started (and a floating window opened on
	   a scrolled phone page back on the desktop's one screen) */
	var mq = window.matchMedia('(max-width: 760px)'); /* the phone breakpoint from style.css */
	function resetPosition(w) { w.style.translate = ''; delete w.dataset.x; delete w.dataset.y; }
	function resetPositions() {
		ids.forEach(function (id) {
			resetPosition(wins[id]);
			wins[id].style.removeProperty('--sy');
			wins[id].style.removeProperty('--vp');
		});
	}
	if (mq.addEventListener) mq.addEventListener('change', resetPositions);

	/* a window's own page (/paint/) loads the same desktop with only that window open (the layout closes the rest) */
	var landing = wins[document.body.dataset.app];
	if (landing) show(landing.dataset.win, true); else raise(wins.about);
	routed = true;
	syncUrl();

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

	/* cat.exe */
	(function () {
		var win = wins.cat;
		if (!win) return;
		/* 22 × 14 pixel frames, facing right, feet on the bottom row. Each letter is a part of the cat, colored by its coat:
		   o outline, f fur, s stripes, m muzzle and chest, n nose and inner ears, e eyes (l shut), p paws, a and b patches */
		var FRAMES = {
			walk1: [
				'............o......o..',
				'.o.........ono....ono.',
				'obo........onnoooonno.',
				'oso........oaafffbbbo.',
				'obo........oaeaffbebo.',
				'ofo........oafmnnmfbo.',
				'.ofoooooooooffmmmmffo.',
				'..obbssaassfoooooooo..',
				'..obbfaaaffffmmmmo....',
				'..obfffaaffffmmmo.....',
				'..offfffffffffffo.....',
				'...offoffooffoffo.....',
				'...oppoppooppoppo.....',
				'...oooooooooooooo.....'
			],
			walk2: [
				'............o......o..',
				'oo.........ono....ono.',
				'obo........onnoooonno.',
				'.oso.......oaafffbbbo.',
				'.obo.......oaeaffbebo.',
				'.ofo.......oafmnnmfbo.',
				'.ofoooooooooffmmmmffo.',
				'..obbssaassfoooooooo..',
				'..obbfaaaffffmmmmo....',
				'..obfffaaffffmmmo.....',
				'..offfffffffffffo.....',
				'...oopoffooopoffo.....',
				'....oooppo.oooppo.....',
				'......oooo...oooo.....'
			],
			walk3: [
				'............o......o..',
				'.o.........ono....ono.',
				'obo........onnoooonno.',
				'oso........oaafffbbbo.',
				'obo........oaeaffbebo.',
				'ofo........oafmnnmfbo.',
				'.ofoooooooooffmmmmffo.',
				'..obbssaassfoooooooo..',
				'..obbfaaaffffmmmmo....',
				'..obfffaaffffmmmo.....',
				'..offfffffffffffo.....',
				'...offoffooffoffo.....',
				'...oppoppooppoppo.....',
				'...oooooooooooooo.....'
			],
			walk4: [
				'............o......o..',
				'oo.........ono....ono.',
				'obo........onnoooonno.',
				'.oso.......oaafffbbbo.',
				'.obo.......oaeaffbebo.',
				'.ofo.......oafmnnmfbo.',
				'.ofoooooooooffmmmmffo.',
				'..obbssaassfoooooooo..',
				'..obbfaaaffffmmmmo....',
				'..obfffaaffffmmmo.....',
				'..offfffffffffffo.....',
				'...offooppoffoppo.....',
				'...oppoooooppoooo.....',
				'...oooo...oooo........'
			],
			sit: [
				'.........o......o.....',
				'........ono....ono....',
				'........onnoooonno....',
				'........oaafffbbbo....',
				'........oaeaffbebo....',
				'........oafmnnmfbo....',
				'........offmmmmffo....',
				'........ooooooooo.....',
				'.......obssaafmmo.....',
				'......obbsaaffmmfo....',
				'......obbfaaffffo.....',
				'..ooooobffffffffo.....',
				'..ossbofffppooppo.....',
				'...ooooooooooooo......'
			],
			blink: [
				'.........o......o.....',
				'........ono....ono....',
				'........onnoooonno....',
				'........oaafffbbbo....',
				'........oallffllbo....',
				'........oafmnnmfbo....',
				'........offmmmmffo....',
				'........ooooooooo.....',
				'.......obssaafmmo.....',
				'......obbsaaffmmfo....',
				'......obbfaaffffo.....',
				'..ooooobffffffffo.....',
				'..ossbofffppooppo.....',
				'...ooooooooooooo......'
			],
			groom: [
				'.........o......o.....',
				'........ono....ono....',
				'........onnoooonno....',
				'........oaafffbbbo....',
				'........oallffllbo....',
				'........oafmnoofbo....',
				'........offmoppofo....',
				'........oooooffoo.....',
				'.......obssaoffoo.....',
				'......obbsaafffffo....',
				'......obbfaaffffo.....',
				'..ooooobfffffffo......',
				'..ossbofffppoooo......',
				'...ooooooooo..........'
			],
			sleep: [
				'......................',
				'......................',
				'......................',
				'......................',
				'......................',
				'............o......o..',
				'...........ono....ono.',
				'...........onnoooonno.',
				'...oooooooooaafffbbbo.',
				'..obbssaassoallffllbo.',
				'oobbbaaaaffoafmnnmfbo.',
				'oboooooofffoffmmmmffo.',
				'obbssfffoooooooooooo..',
				'.oooooooo.............'
			],
			fall: [
				'............o......o..',
				'...........ono....ono.',
				'oo.........onnoooonno.',
				'obo........oaafffbbbo.',
				'.oso.......oaeaffbebo.',
				'.oboooooooooafmnnmfbo.',
				'..obbssaassoffmmmmffo.',
				'..obbfaaafffoooooooo..',
				'..obfffaaffffmmmo.....',
				'.offofffffffffoffo....',
				'.ooppooffooffooppo....',
				'..oooooppooppooooo....',
				'......oooooooo........',
				'......................'
			],
			held: [
				'.......o......o.......',
				'......ono....ono......',
				'......onnoooonno......',
				'......oaafffbbbo......',
				'......oaeaffbebo......',
				'......oafmnnmfbo......',
				'......offmmmmffo......',
				'.......ooooooooo......',
				'...oo..obbfaamfo......',
				'...obo.obffffmfo......',
				'....osoofffffffo......',
				'.....oboofo.ofo.......',
				'......ooopo.opo.......',
				'........ooo.ooo.......'
			]
		};
		/* the coats to pick from in Cat.exe (swatch: how its button looks). Eyes, paws and patches are drawn in the outline
		   and fur colors (LIKE) unless a coat gives them their own. */
		var COATS = [
			{ id: 'orange', name: 'Orange tabby', swatch: 'linear-gradient(135deg, #f5a25d 50%, #d9622b 50%)',
				colors: { o: '#3a2f4a', f: '#f5a25d', s: '#d9622b', m: '#fff3d6', n: '#ff8fc8' } },
			{ id: 'black', name: 'Black cat with white socks', swatch: 'linear-gradient(135deg, #2e2836 60%, #f6f2f8 60%)',
				colors: { o: '#15111b', f: '#2e2836', s: '#2e2836', m: '#453d50', n: '#e58bb6', e: '#f2d45c', l: '#6b6179', p: '#f6f2f8' } },
			{ id: 'calico', name: 'Calico', swatch: 'linear-gradient(135deg, #fffaf2 33%, #f5a25d 33% 66%, #3b3340 66%)',
				colors: { o: '#3a2f4a', f: '#fffaf2', s: '#f5a25d', m: '#fffaf2', n: '#ff8fc8', a: '#f5a25d', b: '#3b3340' } },
			{ id: 'grey', name: 'Grey tabby', swatch: 'linear-gradient(135deg, #a9a6b8 50%, #6f6a82 50%)',
				colors: { o: '#3a2f4a', f: '#a9a6b8', s: '#6f6a82', m: '#eceaf2', n: '#ff8fc8' } }
		];
		var LIKE = { e: 'o', l: 'o', p: 'f', a: 'f', b: 'f' };
		/* frames drawn a pixel lower than they stand: asleep, the body lies flat on the ledge and the tail hangs over it */
		var SINK = { sleep: 1 };
		var FW = 22, FH = 14, art = {};
		function dress(coat) { /* draws every frame in this coat */
			Object.keys(FRAMES).forEach(function (n) {
				var c = art[n] || make('canvas', { width: FW, height: FH }), g = c.getContext('2d');
				g.clearRect(0, 0, FW, FH);
				FRAMES[n].forEach(function (row, y) {
					for (var x = 0; x < row.length; x++) {
						var col = coat.colors[row[x]] || coat.colors[LIKE[row[x]]];
						if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
					}
				});
				art[n] = c;
			});
		}

		var cat = make('canvas', { 'class': 'cat', width: FW, height: FH, 'aria-hidden': 'true' });
		cat.hidden = true;
		document.body.appendChild(cat);
		var pic = document.getElementById('catPic'), says = document.getElementById('catSays'), status = document.getElementById('catStatus');
		var homeBtn = document.getElementById('catHome');
		var g = cat.getContext('2d'), pg = pic.getContext('2d');

		/* where it is: x is the middle of its feet and y the line they stand on, both in screen pixels. While it stands on
		   something, `on` is that window (or the taskbar) and ox its distance from that window's left edge, so it moves
		   with the window. */
		var here = false, pending = false, raf = 0, last = 0, t = 0;
		var x = 0, y = 0, vx = 0, vy = 0, dir = 1, on = null, ox = 0, hop = null;
		var mode = 'sit', until = 0, shown = '', S = 0, spot = null; /* spot: the stretch of ledge it's standing on */
		var LABELS = { walk: 'Wandering', run: 'Zoomies!', sit: 'Sitting', groom: 'Grooming', sleep: 'Napping', jump: 'Jumping!', fall: 'Falling!', held: 'Being carried' };

		/* Everything it can stand on: the taskbar, and the top edge of every open window between the top of the screen and
		   the taskbar, minus the stretches another window in front covers */
		function above(a, b) { /* is window a in front of window b? */
			var za = +a.style.zIndex || 0, zb = +b.style.zIndex || 0;
			return za > zb || (za === zb && !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING));
		}
		function cut(segs, a, b) {
			var out = [];
			segs.forEach(function (s) {
				if (s[0] < a) out.push([s[0], Math.min(s[1], a)]);
				if (s[1] > b) out.push([Math.max(s[0], b), s[1]]);
			});
			return out.filter(function (s) { return s[1] - s[0] > 2; });
		}
		function ledges() {
			var floor = taskbar.getBoundingClientRect().top, list = [{ el: taskbar, left: 0, y: floor, segs: [[0, window.innerWidth]] }];
			var open = ids.map(function (id) { return wins[id]; }).filter(function (w) { return !gone(w) && !w.dataset.busy; });
			open.forEach(function (w) {
				var r = w.getBoundingClientRect();
				if (r.top < 0 || r.top >= floor) return;
				var segs = [[Math.max(r.left, 0), Math.min(r.right, window.innerWidth)]];
				open.forEach(function (o) {
					if (o === w || !above(o, w)) return;
					var q = o.getBoundingClientRect();
					if (q.top < r.top && q.bottom > r.top) segs = cut(segs, q.left, q.right);
				});
				if (segs.length) list.push({ el: w, left: r.left, y: r.top, segs: segs });
			});
			return list;
		}
		function segAt(l, px) {
			for (var i = 0; i < l.segs.length; i++) if (px >= l.segs[i][0] && px <= l.segs[i][1]) return l.segs[i];
			return null;
		}

		function rnd(a, b) { return a + Math.random() * (b - a); }
		function set(m, secs) {
			mode = m; until = t + (secs || 0);
			status.textContent = LABELS[m];
			cat.classList.toggle('held', m === 'held');
		}
		function moving() { return mode === 'walk' || mode === 'run'; }
		/* What to do once the current thing is done: a weighted pick, with whatever it did in its last two turns made less
		   likely, so it doesn't fall into a rut. With reduced motion it mostly sits and naps, and never runs. */
		var recent = [];
		function next() {
			var odds = moving() ? { walk: 4, sit: 3, groom: .6, run: .5, jump: 2 }
				: mode === 'sit' ? { walk: 6, run: .8, groom: 1, sleep: 1.5, sit: .8, jump: 2 }
				: { walk: 4, sit: 2, groom: mode === 'groom' ? 0 : .5, jump: 1 }; /* after grooming, a nap or a landing */
			var hops = targets();
			if (!hops.length) odds.jump = 0;
			if (reduce) { odds.run = odds.jump = 0; odds.walk /= 4; if (odds.sleep) odds.sleep *= 3; }
			var total = 0, pick = 'sit';
			Object.keys(odds).forEach(function (m) { if (recent.indexOf(m) >= 0) odds[m] *= m === 'walk' ? .7 : .35; total += odds[m]; });
			var r = Math.random() * total;
			Object.keys(odds).some(function (m) { pick = m; return (r -= odds[m]) <= 0; });
			recent = [pick].concat(recent).slice(0, 2);
			if (pick === 'jump') return leap(hops[Math.floor(Math.random() * hops.length)]);
			if (pick === 'walk' || pick === 'run') { dir = heading(); hop = null; }
			set(pick, { walk: rnd(3, 12), run: rnd(1, 2.5), sit: rnd(2, 5), groom: rnd(1.5, 3), sleep: rnd(20, 45) }[pick]);
		}
		/* which way to set off: more likely toward whichever side has more room, so it doesn't keep bumping into one edge */
		function heading() {
			if (!spot) return Math.random() < .5 ? 1 : -1;
			var half = FW * S * .3, left = Math.max(x - spot[0] - half, 0) + 10, right = Math.max(spot[1] - half - x, 0) + 10;
			return Math.random() * (left + right) < right ? 1 : -1;
		}
		function fall(speed) { on = null; spot = null; vx = speed || 0; vy = 0; set('fall'); }

		/* Jumping: another window's top (or a stretch of one) it could leap to from here, up to about six times its height
		   above it (as high as a real cat jumps; enough to get from the taskbar back onto the lowest windows), a bit more
		   below, and about four lengths across (all scaled down on phones along with the cat) */
		function targets() {
			var k = S / 3, half = FW * S * .3, list = [];
			ledges().forEach(function (l) {
				var dy = l.y - y;
				if (l.el === taskbar || l.el === on || dy < -260 * k || dy > 300 * k) return;
				l.segs.forEach(function (sg) {
					if (sg[1] - sg[0] < half * 2 + 4) return; /* too short to land on */
					var tx = Math.min(Math.max(x, sg[0] + half), sg[1] - half);
					if (Math.abs(tx - x) <= 240 * k) list.push({ el: l.el, x: tx, y: l.y, dir: tx === x ? dir : tx > x ? 1 : -1 });
				});
			});
			return list;
		}
		/* a leap in an arc peaking a little above the higher end, timed to come down right on the spot. Until it gets there
		   it only lands on the window it's aiming for (not back on the one it left, which the arc can pass through); if it
		   misses (that window moved), it just falls. */
		var aim = null;
		function leap(to) {
			var top = Math.min(y, to.y) - 34 * S / 3, up = Math.sqrt(2 * 2200 * (y - top)), down = Math.sqrt(2 * (to.y - top) / 2200);
			on = null; spot = null; aim = to; vy = -up; vx = (to.x - x) / (up / 2200 + down);
			if (Math.abs(vx) > 1) dir = vx > 0 ? 1 : -1;
			set('jump');
		}

		/* Shaking the window it's on (dragging it back and forth) knocks it off: a few quick reversals of the window's
		   smoothed speed within about a second, where an ordinary drag has one or two at most */
		var shakeOn = null, wv = [0, 0], signs = [0, 0], flips = [], prevL = 0, prevY = 0;
		function shaken(l, dt) {
			if (on === taskbar || !on.classList.contains('dragging') || !dt) { shakeOn = null; return false; }
			if (shakeOn !== on) { shakeOn = on; wv = [0, 0]; signs = [0, 0]; flips = []; prevL = l.left; prevY = l.y; }
			var a = 1 - Math.pow(.0001, dt), fast = 300 * S / 3;
			wv[0] += ((l.left - prevL) / dt - wv[0]) * a;
			wv[1] += ((l.y - prevY) / dt - wv[1]) * a;
			prevL = l.left; prevY = l.y;
			[0, 1].forEach(function (i) {
				var sign = Math.abs(wv[i]) > fast ? (wv[i] > 0 ? 1 : -1) : 0;
				if (sign && signs[i] && sign !== signs[i]) flips.push(t);
				if (sign) signs[i] = sign;
			});
			flips = flips.filter(function (f) { return t - f < 1.2; });
			return flips.length >= 3;
		}
		function knockOff() {
			var fling = Math.max(-600, Math.min(600, wv[0] * .5));
			shakeOn = null; fall(fling); vy = -300;
			status.textContent = 'Whoa!';
		}
		function land(l) { on = l.el; ox = x - l.left; y = l.y; vx = vy = 0; hop = null; set('sit', rnd(.8, 2)); }

		function frame() {
			if (moving()) return 'walk' + (1 + Math.floor(t * (mode === 'run' ? 22 : 7)) % 4);
			if (mode === 'sit') return t % 3.5 < .15 ? 'blink' : 'sit';
			if (mode === 'groom') return Math.floor(t * 3) % 2 ? 'groom' : 'blink';
			if (mode === 'jump') return 'fall'; /* legs out */
			return mode; /* sleep, fall, held */
		}
		function draw() {
			var s = mq.matches ? 2 : 3, w = FW * s, h = FH * s, name = frame();
			if (s !== S) { S = s; cat.style.width = w + 'px'; cat.style.height = h + 'px'; }
			if (name !== shown) {
				shown = name;
				g.clearRect(0, 0, FW, FH); g.drawImage(art[name], 0, 0);
				pg.clearRect(0, 0, FW, FH); pg.drawImage(art[name], 0, 0);
			}
			cat.style.transform = 'translate(' + Math.round(x - w / 2) + 'px, ' + Math.round(y - h + (SINK[name] || 0) * s) + 'px) scaleX(' + dir + ')';
		}

		function tick(now) {
			raf = requestAnimationFrame(tick);
			var dt = Math.min((now - last) / 1000 || 0, .05); /* a long pause (a background tab) doesn't turn into a leap */
			last = now; t += dt;
			var s = mq.matches ? 2 : 3, half = FW * s * .3, speed = 12 * s * (reduce ? .5 : 1);
			if (pending) { /* dropped in from above Cat.exe once its window has finished opening */
				if (gone(win) || win.dataset.busy) return;
				var r = win.getBoundingClientRect();
				pending = false; x = r.left + r.width / 2; y = Math.max(r.top - 160, -FH * s); fall();
				cat.hidden = false;
			}
			if (mode === 'fall' || mode === 'jump') {
				vy += 2200 * dt;
				if (mode === 'fall') vx *= Math.pow(.3, dt); /* a jump keeps its aim */
				x += vx * dt;
				if (x < half || x > window.innerWidth - half) { x = Math.min(Math.max(x, half), window.innerWidth - half); vx = -vx * .5; }
				var ny = y + vy * dt, landing = null;
				if (mode === 'jump' && vy > 0 && y > aim.y + 8) set('fall'); /* went past it */
				if (vy > 0) ledges().forEach(function (l) {
					if (mode === 'jump' && l.el !== aim.el) return;
					if (l.y >= y - 1 && l.y <= ny && segAt(l, x) && (!landing || l.y < landing.y)) landing = l;
				});
				if (landing) land(landing); else y = ny;
			} else if (mode !== 'held') {
				var l = null;
				ledges().forEach(function (c) { if (c.el === on) l = c; });
				x = l ? l.left + ox : x;
				var seg = l && segAt(l, x);
				var pace = speed * (mode === 'run' ? 5 : 1); /* zoomies: silly fast */
				if (l && shaken(l, dt)) knockOff();
				else if (!seg) fall(moving() ? dir * pace : 0); /* its window went away, moved, or got covered */
				else {
					y = l.y; spot = seg;
					if (moving()) {
						/* is there open screen past this end of the ledge to hop down into? (not where it runs off the screen) */
						var room = function (d) { return on !== taskbar && (d > 0 ? seg[1] < window.innerWidth - half : seg[0] > half); };
						if (seg[1] - seg[0] < half * 2 + 4) { /* too short to walk along: hop off whichever end has room, or stay put */
							if (hop === null) { if (!room(dir) && room(-dir)) dir = -dir; hop = room(dir); }
							if (hop) x += dir * pace * dt; else set('sit', rnd(2, 4));
						} else {
							x += dir * pace * dt;
							/* at the end of a ledge: often leap to another window ahead if there's one in reach, otherwise turn
							   around, or (with room past the end) sometimes hop down */
							if ((dir > 0 && x > seg[1] - half) || (dir < 0 && x < seg[0] + half)) {
								if (hop === null) {
									var ahead = reduce ? [] : targets().filter(function (tg) { return tg.dir === dir; });
									if (ahead.length && Math.random() < .5) leap(ahead[Math.floor(Math.random() * ahead.length)]);
									else hop = room(dir) && Math.random() < .3;
								}
								if (mode === 'jump') { /* off it goes */ }
								else if (!hop) { /* turned around: keep going a while, so it actually heads somewhere */
									dir = -dir; hop = null; x = Math.min(Math.max(x, seg[0] + half), seg[1] - half);
									until = Math.max(until, t + rnd(1.5, 3));
								}
							}
						}
					}
					ox = x - l.left;
				}
			}
			if (mode !== 'fall' && mode !== 'jump' && mode !== 'held' && t > until) next();
			draw();
		}

		function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
		function call() {
			pending = true; here = true;
			cat.classList.remove('leaving'); cat.hidden = true; /* until it's dropped in */
			says.textContent = 'Your cat is out on the desktop. Drag it around, or give it a pat.';
			homeBtn.disabled = false;
			start();
		}
		function home() {
			if (!here) return;
			here = false; pending = false;
			cancelAnimationFrame(raf); raf = 0;
			cat.classList.add('leaving'); /* fades out where it is */
			setTimeout(function () {
				if (here) return; /* called back in the meantime */
				cat.hidden = true;
				pg.clearRect(0, 0, FW, FH); shown = '';
			}, 300);
			says.textContent = 'Your cat went home for a nap.';
			status.textContent = 'Out';
			homeBtn.disabled = true;
		}
		function hearts() {
			if (reduce) return;
			var h = make('span', { 'class': 'cat-heart', text: '♡' });
			/* from somewhere around its head, so a few pats in a row don't all rise from the same spot */
			h.style.left = x - 6 + rnd(-4, 4) * S + 'px'; h.style.top = y - FH * S - 8 + rnd(-1, 1) * S + 'px';
			document.body.appendChild(h);
			setTimeout(function () { h.remove(); }, 1000);
		}

		/* picking it up: a press that doesn't move is a pat (wakes it, or earns a heart), one that moves carries it by the
		   scruff, and letting go drops it (thrown, if the pointer was moving) */
		var grab = null;
		cat.addEventListener('pointerdown', function (e) {
			if (e.button !== 0 || !here) return;
			e.preventDefault();
			cat.setPointerCapture(e.pointerId);
			grab = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, pt: e.timeStamp, vx: 0, vy: 0, moved: false };
		});
		cat.addEventListener('pointermove', function (e) {
			if (!grab || e.pointerId !== grab.id) return;
			if (!grab.moved) {
				if (Math.abs(e.clientX - grab.sx) + Math.abs(e.clientY - grab.sy) < 6) return;
				grab.moved = true; on = null; set('held'); buzz();
			}
			var dtp = Math.max(e.timeStamp - grab.pt, 8) / 1000;
			grab.vx = (e.clientX - grab.px) / dtp; grab.vy = (e.clientY - grab.py) / dtp;
			grab.px = e.clientX; grab.py = e.clientY; grab.pt = e.timeStamp;
			x = e.clientX; y = e.clientY + FH * S - S; /* held by the scruff, just under the pointer */
		});
		function letGo(e) {
			if (!grab || e.pointerId !== grab.id) return;
			var g0 = grab; grab = null;
			if (!g0.moved) { /* a pat */
				if (mode === 'sleep') set('sit', rnd(2, 4));
				else { hearts(); if (moving()) set('sit', rnd(2, 4)); }
				buzz();
				return;
			}
			var floor = taskbar.getBoundingClientRect().top, still = e.timeStamp - g0.pt > 80; /* held still before letting go: just dropped */
			if (y > floor) y = floor; /* let go over the taskbar: it lands right there */
			fall(still ? 0 : Math.max(-900, Math.min(900, g0.vx * .6)));
			vy = still ? 0 : Math.max(-700, Math.min(500, g0.vy * .5));
		}
		cat.addEventListener('pointerup', letGo);
		cat.addEventListener('pointercancel', letGo);
		cat.addEventListener('lostpointercapture', letGo);

		win.addEventListener('coldopen', function () { if (!here) call(); }); /* opening Cat.exe calls the cat */
		document.getElementById('catCall').addEventListener('click', function () { buzz(); call(); });
		homeBtn.addEventListener('click', function () { buzz(); home(); });
		document.getElementById('shutdown').addEventListener('click', home);
		/* the coat picker (remembered in this browser for next time) */
		var coat = COATS[0], coatBtns = [];
		try { coat = COATS.filter(function (c) { return c.id === localStorage.getItem('catCoat'); })[0] || coat; } catch (e) {}
		function mark() { coatBtns.forEach(function (b, i) { b.classList.toggle('on', COATS[i] === coat); b.setAttribute('aria-pressed', COATS[i] === coat); }); }
		function wear(c) {
			coat = c; dress(c); shown = ''; mark();
			if (here) draw(); else { pg.clearRect(0, 0, FW, FH); pg.drawImage(art.sit, 0, 0); } /* at home: show it off in the picture */
			try { localStorage.setItem('catCoat', c.id); } catch (e) {}
		}
		COATS.forEach(function (c) {
			var b = make('button', { 'class': 'sw', type: 'button', title: c.name, 'aria-label': c.name });
			b.style.background = c.swatch;
			b.addEventListener('click', function () { buzz(); if (c !== coat) wear(c); });
			document.getElementById('catCoats').appendChild(b);
			coatBtns.push(b);
		});
		dress(coat); mark();
		says.textContent = 'Your cat is at home.';
		homeBtn.disabled = true;
		if (!gone(win)) call(); /* this is Cat.exe's own page (/cat/), which opened the window before this could hear it */
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

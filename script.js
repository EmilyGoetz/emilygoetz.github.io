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

	function show(id) {
		var w = wins[id];
		if (w.dataset.busy) return;
		/* a button coming back joins the end of the strip, like a newly opened window */
		var wasClosed = tasks[id].hidden;
		if (wasClosed) { tasks[id].hidden = false; tasks[id].parentNode.appendChild(tasks[id]); }
		if (!gone(w)) {
			raise(w);
			reveal(w, true);
			if (!reduce) { w.classList.remove('bump'); void w.offsetWidth; play(w, 'bump'); }
			return;
		}
		if (wasClosed) { /* floating windows open where you're looking; a minimized one comes back where it was */
			w.style.setProperty('--sy', window.scrollY + 'px');
			w.style.setProperty('--vp', window.innerHeight + 'px');
		}
		w.classList.remove('is-gone');
		reveal(w, false); /* jump first (not smooth) so the animation below measures the window where it will end up */
		raise(w);
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
	function resetPositions() {
		ids.forEach(function (id) { var w = wins[id]; w.style.translate = ''; delete w.dataset.x; delete w.dataset.y; });
	}
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

	/* clock */
	var clock = document.getElementById('clock');
	function tick() { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
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

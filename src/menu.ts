/**
 * The game's menu (F.6), over the view: in the game it pauses it (Esc), with resume, save, the
 * options, the debug data that used to sit on the status lines, and save & quit to the title; from
 * the title it opens on the options alone. Plain DOM in the title screen's style; main fills it in
 * through the hooks.
 */
export interface Option { label: string; value: () => string; next: () => void }
export interface MenuHooks {
  options: Option[];
  /** The debug page's text (seed, position, frame times, the grid, the heat...). */
  debug: () => string;
  save: () => Promise<boolean>;
  resume: () => void;
  quit: () => void;
}
type Page = 'main' | 'options' | 'debug';

export class Menu {
  private el: HTMLDivElement;
  private body: HTMLDivElement;
  private note: HTMLParagraphElement;
  private page: Page = 'main';
  /** Opened from the title: only the options, and closing goes back to it. */
  private fromTitle = false;
  private debugTimer = 0;

  constructor(private hooks: MenuHooks) {
    this.el = document.createElement('div');
    this.el.id = 'menu';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="panel"><h2></h2><div class="body"></div><p class="note"></p></div>';
    document.body.appendChild(this.el);
    this.body = this.el.querySelector('.body')!;
    this.note = this.el.querySelector('.note')!;
    // clicks on the menu stay in it (the game listens for clicks on the window)
    for (const ev of ['mousedown', 'mouseup', 'click'] as const) this.el.addEventListener(ev, (e) => e.stopPropagation());
  }

  get isOpen() { return !this.el.hidden; }

  open(fromTitle: boolean) {
    this.fromTitle = fromTitle;
    this.el.hidden = false;
    this.show(fromTitle ? 'options' : 'main');
  }
  close() { this.el.hidden = true; clearInterval(this.debugTimer); }
  /** Gone for good (the title's, once the game is chosen). */
  dispose() { this.close(); this.el.remove(); }
  /** Esc: a page back, or out of the menu. */
  back() {
    if (this.page !== 'main' && !this.fromTitle) this.show('main');
    else if (this.fromTitle) this.close();
    else this.hooks.resume();
  }

  private button(label: string, act: () => void, alt = false) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; if (alt) b.className = 'alt';
    b.addEventListener('click', act);
    this.body.appendChild(b);
    return b;
  }

  private show(page: Page) {
    this.page = page;
    clearInterval(this.debugTimer);
    this.body.innerHTML = '';
    this.note.textContent = '';
    const h = this.el.querySelector('h2')!;
    if (page === 'main') {
      h.textContent = 'PAUSED';
      this.button('RESUME', () => this.hooks.resume());
      const s = this.button('SAVE GAME', async () => { s.disabled = true; this.note.textContent = (await this.hooks.save()) ? 'SAVED.' : 'COULD NOT SAVE.'; s.disabled = false; });
      this.button('OPTIONS', () => this.show('options'), true);
      this.button('DEBUG', () => this.show('debug'), true);
      this.button('SAVE & QUIT TO TITLE', () => this.hooks.quit(), true);
    } else if (page === 'options') {
      h.textContent = 'OPTIONS';
      for (const o of this.hooks.options) {
        const b = this.button('', () => { o.next(); set(); }, true);
        b.classList.add('row');
        const set = () => { b.innerHTML = `<span>${o.label}</span><span>${o.value()}</span>`; };
        set();
      }
      this.button('BACK', () => this.back());
    } else {
      h.textContent = 'DEBUG';
      const pre = document.createElement('pre');
      this.body.appendChild(pre);
      const fill = () => { pre.textContent = this.hooks.debug(); };
      fill();
      this.debugTimer = window.setInterval(fill, 500);
      this.button('BACK', () => this.back());
    }
  }
}

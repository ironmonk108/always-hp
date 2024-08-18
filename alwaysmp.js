import { registerSettings } from "./settings.js";

export let debug = (...args) => {
  if (debugEnabled > 1) console.log("DEBUG: alwayshp | ", ...args);
};
export let log = (...args) => console.log("alwayshp | ", ...args);
export let warn = (...args) => {
  if (debugEnabled > 0) console.warn("alwayshp | ", ...args);
};
export let error = (...args) => console.error("alwayshp | ", ...args);
export let i18n = key => {
  return game.i18n.localize(key);
};
export let setting = key => {
  return game.settings.get("always-hp", key);
};

export let patchFunc = (prop, func, type = "WRAPPER") => {
  let nonLibWrapper = () => {
    const oldFunc = eval(prop);
    eval(`${prop} = function (event) {
            return func.call(this, ${type != "OVERRIDE" ? "oldFunc.bind(this)," : ""} ...arguments);
        }`);
  }
  if (game.modules.get("lib-wrapper")?.active) {
    try {
      libWrapper.register("always-hp", prop, func, type);
    } catch (e) {
      nonLibWrapper();
    }
  } else {
    nonLibWrapper();
  }
}

export class AlwaysMP extends Application {
  tokenname = '';
  tokenstat = '';
  tokentooltip = '';
  color = "";
  valuePct = null;

  static get defaultOptions() {
    let pos = game.user.getFlag("always-hp", "alwayshp-mpPos");
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "always-hp-mp",
      template: "modules/always-hp/templates/alwaysmp.html",
      classes: ["always-hp-mp"],
      popOut: true,
      resizable: false,
      top: pos?.top || 60,
      left: pos?.left || (($('#board').width / 2) - 150),
      width: 300,
    });
  }

  async _render(force, options) {
    let that = this;
    return super._render(force, options).then((html) => {
      $('h4', this.element)
        .empty()
        .addClass('flexrow')
        .append($('<div>').addClass('character-name').html(this.tokenname))
        .append($('<div>').addClass('token-stats flexrow').attr('title', this.tokentooltip).html((this.tokenstat ? `<div class="stat">${this.tokenstat}</div>` : '')));
      delete ui.windows[that.appId];
      this.refreshSelected();
    });
  }

  async close(options) {
    if (options?.properClose) {
      super.close(options);
      game.AlwaysMP.app = null;
    }
  }

  getData() {
    return {
      tokenname: this.tokenname
    };
  }

  getResourceValue(resource) {
    return (resource instanceof Object ? resource.value : resource);
  }

  getResourceMax(resource) {
    return (resource instanceof Object ? resource.max : null);
  }

  getResValue(resource, property = "value", defvalue = null) {
    return (resource instanceof Object ? resource[property] : defvalue) ?? 0;
  }

  async changeMP(value) {
    let actors = canvas.tokens.controlled.flatMap((t) => {
      if (t.actor?.type == "group") {
        return Array.from(t.actor?.system.members);
      } else
        return t.actor;
    });
    for (let a of actors) {
      if (!a || !(a instanceof Actor))
        continue;

      let tValue = foundry.utils.duplicate(value);

      let resourcename = (setting("secondResourcename") || (game.system?.secondaryTokenAttribute ?? game.data?.secondaryTokenAttribute) || 'attributes.mp');
      let resource = foundry.utils.getProperty(a, `system.${resourcename}`);

      if (tValue.value == 'zero')
        tValue.value = this.getResValue(resource, "value", resource);
      if (value.value == 'full')
        tValue.value = (resource instanceof Object ? resource.value - resource.max : resource);

      log('applying mp loss', a, tValue);
      if (tValue.value != 0) {
        await this.removeMP(a, tValue);
      }
    };

    this.refreshSelected();
  }

  async removeMP(actor, amount, multiplier = 1) {
    let { value } = amount;
    let updates = {};
    let resourcename = (setting("secondResourcename") || (game.system?.secondaryTokenAttribute ?? game.data?.secondaryTokenAttribute) || 'attributes.mp');
    let resource = foundry.utils.getProperty(actor, `system.${resourcename}`);
    if (resource instanceof Object) {
      value = Math.floor(parseInt(value) * multiplier);
      const result = Math.clamp(resource.value - value, 0, resource.max);
      updates[`system.${resourcename}.value`] = result;
    } else {
      let val = Math.floor(parseInt(resource));
      updates[`system.${resourcename}`] = (val - value);
    }

    return await actor.update(updates);
  }

  sendMessage(dh, dt) {
    const speaker = ChatMessage.getSpeaker({ user: game.user.id });

    let messageData = {
      user: game.user.id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      content: `${actor.name} has changed MP by: ${dt + dh}`
    };

    ChatMessage.create(messageData);
  }

  refreshSelected() {
    this.valuePct = null;
    this.tokenstat = "";
    this.tokentooltip = "";
    $('.character-name', this.element).removeClass("single");
    if (canvas.tokens?.controlled.length == 0)
      this.tokenname = "";
    else if (canvas.tokens?.controlled.length == 1) {
      let a = canvas.tokens.controlled[0].actor;
      if (!a)
        this.tokenname = "";
      else {
        $('.character-name', this.element).addClass("single");
        let resourcename = setting("secondResourcename");
        let resource = foundry.utils.getProperty(a, `system.${resourcename}`);

        let value = this.getResValue(resource, "value", resource);
        let max = this.getResValue(resource, "max");

        const effectiveMax = Math.max(0, max);
        let displayMax = max;

        // Allocate percentages of the total
        const valuePct = Math.clamp(value, 0, effectiveMax) / displayMax;

        this.valuePct = valuePct;
        this.tokenname = canvas.tokens.controlled[0]?.name ?? canvas.tokens.controlled[0]?.data?.name ?? canvas.tokens.controlled[0]?.document?.name;
        this.tokenstat = value;
        this.tokentooltip = `MP: ${value}, Max: ${max}`;
      }
    }
    else {
      this.tokenname = `${i18n("ALWAYSHP.Multiple")} <span class="count">${canvas.tokens.controlled.length}</span>`;
    }

    this.changeToken();
  }

  changeToken() {
    $('.character-name', this.element).html(this.tokenname);
    $('.token-stats', this.element).attr('title', this.tokentooltip).html((this.tokenstat ? `<div class="stat">${this.tokenstat}</div>` : ''));
    $('.resource-mp', this.element).toggle(canvas.tokens.controlled.length == 1 && this.valuePct != undefined);
    if (this.valuePct != undefined) {
      $('.resource-mp .bar-mp', this.element).css({ width: (this.valuePct * 100) + '%'});
    }
  }

  get getValue() {
    let value = $('#alwayshp-mp', this.element).val();
    let result = { value: value };
    if (value.indexOf("r") > -1 || value.indexOf("R") > -1) {
      result.target = "regular";
      result.value = result.value.replace('r', '').replace('R', '');
    }
    if (value.indexOf("m") > -1 || value.indexOf("M") > -1) {
      result.target = "max";
      result.value = result.value.replace('m', '').replace('M', '');
    }

    result.value = parseInt(result.value);
    if (isNaN(result.value))
      result.value = 1;
    return result;
  }

  clearInput() {
    if (setting("clear-after-enter"))
      $('#alwayshp-mp', this.element).val('');
  }

  getChangeValue(perc) {
    let change = "";
    if (canvas.tokens.controlled.length == 1 && canvas.tokens.controlled[0].actor?.type != "group") {
      const actor = canvas.tokens.controlled[0].actor;

      if (!actor)
        return;

      let resourcename = (setting("secondResourcename") || (game.system?.secondaryTokenAttribute ?? game.data?.secondaryTokenAttribute) || 'attributes.mp');
      let resource = foundry.utils.getProperty(actor, `system.${resourcename}`);

      if (resource.hasOwnProperty("max")) {
        let max = this.getResValue(resource, "max");
        const effectiveMax = Math.max(0, max);
        let val = Math.floor(parseInt(effectiveMax * perc));
        if (val >= 0)
          val++;
        change = val - Math.floor(parseInt(resource.value));
      }
    }

    return change;
  }

  activateListeners(html) {
    super.activateListeners(html);

    let that = this;
    html.find('#alwayshp-btn-dead-mp').click(ev => {
      ev.preventDefault();
      if (ev.shiftKey == true)
        this.changeMP({ value: 0 }, 'toggle');
      else {
        log('set character to dead');
        this.changeMP({ value: 'zero' });
        this.clearInput();
      }
    }).contextmenu(ev => {
      ev.preventDefault();
      log('set character to hurt');
      this.changeMP({ value: 'zero' });
      this.clearInput();
    });
    html.find('#alwayshp-btn-recover-mp').click(ev => {
      ev.preventDefault();
      log('set character to recover');
      let value = this.getValue;
      if (value.value != '') {
        value.value = -Math.abs(value.value);
        this.changeMP(value);
      }
      this.clearInput();
    });
    html.find('#alwayshp-btn-fullrecover-mp').click(ev => {
      ev.preventDefault();
      log('set character to fullrecover');
      this.changeMP({ value: 'full' });
      this.clearInput();
    }).contextmenu(ev => {
      ev.preventDefault();
      log('set character to recover');
      this.changeMP({ value: 'full' });
      this.clearInput();
    });

    if (setting('double-click')) {
      html.find('#alwayshp-btn-hurt-mp').dblclick(ev => {
        ev.preventDefault();
        log('set character to hurt');
        this.changeMP({ value: 'zero' });
        this.clearInput();
      });

      html.find('#alwayshp-btn-recover-mp').dblclick(ev => {
        ev.preventDefault();
        log('set character to recover');
        this.changeMP({ value: 'full' });
        this.clearInput();
      });
    }
    html.find('#alwayshp-mp').focus(ev => {
      ev.preventDefault();
      let elem = ev.target;
      if (elem.setSelectionRange) {
        elem.focus();
        elem.setSelectionRange(0, $(elem).val().length);
      } else if (elem.createTextRange) {
        var range = elem.createTextRange();
        range.collapse(true);
        range.moveEnd('character', $(elem).val().length);
        range.moveStart('character', 0);
        range.select();
      }
    }).keypress(ev => {
      if (ev.which == 13) {
        let value = this.getValue;
        if (value.value != '' && value.value != 0) {
          ev.preventDefault();

          let rawvalue = $('#alwayshp-mp', this.element).val();
          value.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? -Math.abs(value.value) : Math.abs(value.value));
          this.changeMP(value); //recover with a + but everything else is a hurt
          this.clearInput();
        }
      }
    });

    html.find('.resource-mp').mousemove(ev => {
      if (!setting("allow-bar-click"))
        return;
      let perc = ev.offsetX / $(ev.currentTarget).width();
      let change = this.getChangeValue(perc);

      $('.bar-change-mp', html).html(change);
      log("resource change");
    }).click(ev => {
      if (!setting("allow-bar-click"))
        return;
      let perc = ev.offsetX / $(ev.currentTarget).width();
      let change = this.getChangeValue(perc);

      this.changeMP({ value: -change });
      $('.bar-change-mp', html).html('');
    });

    html.find('.bar-change-mp').mousemove(ev => {
      ev.preventDefault;
      ev.stopPropagation();
      log("bar change");
    });
  }
}

Hooks.on('init', () => {
  registerSettings();

  game.keybindings.register('always-hp', 'toggle-key-mp', {
    name: 'ALWAYSHP.toggle-key-mp.name',
    hint: 'ALWAYSHP.toggle-key-mp.hint',
    editable: [],
    onDown: () => {
      game.AlwaysMP.toggleApp();
    },
  });

  game.keybindings.register('always-hp', 'focus-key-mp', {
    name: 'ALWAYSHP.focus-key-mp.name',
    hint: 'ALWAYSHP.focus-key-mp.hint',
    editable: [],
    onDown: () => {
      if (!game.AlwaysMP.app)
        game.AlwaysMP.app = new AlwaysMP().render(true);
      else
        game.AlwaysMP.app.bringToTop();
      $('#alwayshp-mp', game.AlwaysMP.app.element).focus();
    },
  });

  game.AlwaysMP = {
    app: null,
    toggleApp: (show = 'toggle') => {
      if (show == 'toggle') show = !game.AlwaysMP.app;

      if (show && !game.AlwaysMP.app) {
        game.AlwaysMP.app = new AlwaysMP().render(true);
      } else if (!show && game.AlwaysMP.app)
        game.AlwaysMP.app.close({ properClose: true });
    },
    refresh: () => {
      if (game.AlwaysMP.app)
        game.AlwaysMP.app.refreshSelected();
    }
  };
});

Hooks.on('ready', () => {
  let r = document.querySelector(':root');
  r.style.setProperty('--ahp-heal-dark', setting("heal-dark"));
  r.style.setProperty('--ahp-heal-light', setting("heal-light"));
  r.style.setProperty('--ahp-hurt-dark', setting("hurt-dark"));
  r.style.setProperty('--ahp-hurt-light', setting("hurt-light"));

  if ((setting("show-option-mp") == 'on' || (setting("show-option-mp") == 'toggle' && setting("show-dialog-mp"))) && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM)))
    game.AlwaysMP.toggleApp(true);

  if (setting("show-option-mp") == "combat" && game.combats.active && game.combats.active.started && !game.AlwaysMP)
    game.AlwaysMP.toggleApp(true);

  if (!game.modules.get('monks-combat-details')?.active && !game.modules.get('monks-enhanced-journal')?.active && !game.modules.get('monks-common-display')?.active) {
    patchFunc("Draggable.prototype._onDragMouseUp", async function (wrapped, ...args) {
      try {
        if (this.app.constructor._getInheritanceChain) {
          for (const cls of this.app.constructor._getInheritanceChain()) {
            Hooks.callAll(`dragEnd${cls.name}`, this.app, this.app.position);
          }
        } else {
          Hooks.callAll(`dragEnd${this.app.constructor.name}`, this.app, this.app.position);
        }
      } catch (e) { }
      return wrapped(...args);
    });
  }
});

Hooks.on('controlToken', () => {
  if (setting("show-option-mp") == "token") {
    if (canvas.tokens.controlled.length == 0) // delay a second to make sure we aren't selecting a new token
      window.setTimeout(() => { if (canvas.tokens.controlled.length == 0) game.AlwaysMP.toggleApp(false); }, 100);
    else if (!game.AlwaysMP.app)
      game.AlwaysMP.toggleApp(true);
    else
      game.AlwaysMP.refresh();
  } else
    game.AlwaysMP.refresh();
});

Hooks.on('updateActor', (actor, data) => {
  //log('Updating actor', actor, data);
  if (canvas.tokens.controlled.length == 1
    && canvas.tokens.controlled[0]?.actor?.id == actor.id
    && foundry.utils.getProperty(data, `system.${setting("secondResourcename")}`)) {
    game.AlwaysMP.refresh();
  }
});

Hooks.on('updateCombat', (combat, data) => {
  if (setting("show-option-mp") == "combat") {
    game.AlwaysMP.toggleApp(game.combats.active && game.combats.active.started);
  }
});

Hooks.on('deleteCombat', (combat, data) => {
  if (setting("show-option-mp") == "combat") {
    game.AlwaysMP.toggleApp(game.combats.active && game.combats.active.started);
  }
});

Hooks.on('dragEndAlwaysMP', (app) => {
  game.user.setFlag("always-hp", "alwayshp-mpPos", { left: app.position.left, top: app.position.top });
})

Hooks.on("getSceneControlButtons", (controls) => {
  if (setting("show-option-mp") == 'toggle' && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM))) {
    let tokenControls = controls.find(control => control.name === "token")
    tokenControls.tools.push({
      name: "toggledialog-mp",
      title: "ALWAYSHP.toggledialog-mp",
      icon: "fas fa-car-battery",
      toggle: true,
      active: setting('show-dialog-mp'),
      onClick: (toggled) => {
        game.settings.set('always-hp', 'show-dialog-mp', toggled);
        game.AlwaysMP.toggleApp(toggled);
      }
    });
  }
});
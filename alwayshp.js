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

export class AlwaysHP extends Application {
    tokenname = '';
    tokenstat = '';
    tokentemp = '';
    tokentooltip = '';
    color = "";
    valuePct = null;
    tempPct = null;

    static get defaultOptions() {
        let pos = game.user.getFlag("always-hp", "alwayshpPos");
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "always-hp",
            template: "modules/always-hp/templates/alwayshp.html",
            classes: ["always-hp"],
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
                .append($('<div>').addClass('token-stats flexrow').attr('title', this.tokentooltip).html((this.tokentemp ? `<div class="stat temp">${this.tokentemp}</div>` : '') + (this.tokenstat ? `<div class="stat" style="background-color:${this.color}">${this.tokenstat}</div>` : '')));
            delete ui.windows[that.appId];
            this.refreshSelected();
        });
    }

    async close(options) {
        if (options?.properClose) {
            super.close(options);
            game.AlwaysHP.app = null;
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

    async changeHP(value, active) {
        if (setting("wounds-system")) {
            switch(value.value) {
                case 'zero':
                    value.value = 'full';
                    break;
                case 'full':
                    value.value = 'zero';
                    break;
                }
        }

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

            let resourcename = (setting("resourcename") || (game.system?.primaryTokenAttribute ?? game.data?.primaryTokenAttribute) || 'attributes.hp');
            let resource = foundry.utils.getProperty(a, `system.${resourcename}`);

            if (tValue.value == 'zero')
                tValue.value = this.getResValue(resource, "value", resource) + this.getResValue(resource, "temp");
            if (value.value == 'full')
                tValue.value = (resource instanceof Object ? resource.value - resource.max : resource);

            let defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;

            if (active != undefined && setting("add-defeated")) {
                let status = CONFIG.statusEffects.find(e => e.id === defeatedStatus);
                let effect = game.system.id == "pf2e" ? game.settings.get("pf2e", "deathIcon") : a && status ? status : CONFIG.controlIcons.defeated;

                const exists = a.statuses.has(effect.id);

                if (exists != active)
                    await a.toggleStatusEffect(effect.id, { active: (active == 'toggle' ? !exists : active) });
            }

            if (active === false && setting("clear-savingthrows")) {
                a.update({
                    "system.attributes.death.failure": 0,
                    "system.attributes.death.success": 0
                });
            }

            log('applying damage', a, tValue);
            if (tValue.value != 0) {
                await this.applyDamage(a, tValue);
            }
        };

        this.refreshSelected();
    }

    async applyDamage(actor, amount, multiplier = 1) {
        let { value, target } = amount;
        let updates = {};
        let resourcename = (setting("resourcename") || (game.system?.primaryTokenAttribute ?? game.data?.primaryTokenAttribute) || 'attributes.hp');
        let resource = foundry.utils.getProperty(actor, `system.${resourcename}`);
        if (resource instanceof Object) {
            value = Math.floor(parseInt(value) * multiplier);

            // Deduct damage from temp HP first
            if (resource.hasOwnProperty("tempmax") && target == "max") {
                const dm = (resource.tempmax ?? 0) - value;
                updates[`system.${resourcename}.tempmax`] = dm;
            } else {
                let dt = 0;
                let tmpMax = 0;
                if (resource.hasOwnProperty("temp")) {
                    const tmp = parseInt(resource.temp) || 0;
                    dt = (value > 0 || target == 'temp') && target != 'regular' && target != 'max' ? Math.min(tmp, value) : 0;
                    // Remaining goes to health

                    tmpMax = parseInt(resource.tempmax) || 0;

                    updates[`system.${resourcename}.temp`] = tmp - dt;
                }

                // Update the Actor
                if (target != 'temp' && target != 'max' && dt >= 0) {
                    let change = (value - dt);
                    const dh = Math.clamp(resource.value - change, (game.system.id == 'D35E' || game.system.id == 'pf1' ? -2000 : 0), resource.max + tmpMax);
                    updates[`system.${resourcename}.value`] = dh;
                }
            }
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
            content: `${actor.name} has changed HP by: ${dt + dh}` + (dt != 0 ? `<small><br/>Temporary: ${dt}<br/>HP: ${dh}</small>` : '')
        };

        ChatMessage.create(messageData);
    }

    refreshSelected() {
        this.valuePct = null;
        this.tokenstat = "";
        this.tokentemp = "";
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
                let resourcename = setting("resourcename");
                let resource = foundry.utils.getProperty(a, `system.${resourcename}`);

                let value = this.getResValue(resource, "value", resource);
                let max = this.getResValue(resource, "max");
                if (setting("wounds-system")) value =  max - value;
                let temp = this.getResValue(resource, "temp");
                let tempmax = this.getResValue(resource, "tempmax");

                // Differentiate between effective maximum and displayed maximum
                const effectiveMax = Math.max(0, max + tempmax);
                let displayMax = max + (tempmax > 0 ? tempmax : 0);

                // Allocate percentages of the total
                const tempPct = Math.clamp(temp, 0, displayMax) / displayMax;
                const valuePct = Math.clamp(value, 0, effectiveMax) / displayMax;

                this.valuePct = valuePct;
                this.tempPct = tempPct;
                const color = [(1 - (this.valuePct / 2)), this.valuePct, 0];
                this.color = `rgba(${parseInt(color[0] * 255)},${parseInt(color[1] * 255)},${parseInt(color[2] * 255)}, 0.7)`;

                this.tokenname = canvas.tokens.controlled[0]?.name ?? canvas.tokens.controlled[0]?.data?.name;
                this.tokenstat = value;
                this.tokentemp = temp;
                this.tokentooltip = `HP: ${value}, Temp: ${temp}, Max: ${max}`;
            }
        }
        else {
            this.tokenname = `${i18n("ALWAYSHP.Multiple")} <span class="count">${canvas.tokens.controlled.length}</span>`;
        }

        this.changeToken();
    }

    addDeathST(save, value) {
        if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                return;

            let prop = a.system.attributes.death;
            prop[save ? 'success' : 'failure'] = Math.max(0, Math.min(3, prop[save ? 'success' : 'failure'] + value));

            let updates = {};
            updates["system.attributes.death." + (save ? 'success' : 'failure')] = prop[save ? 'success' : 'failure'];
            canvas.tokens.controlled[0].actor.update(updates);

            this.changeToken();
        }
    }

    changeToken() {
        $('.character-name', this.element).html(this.tokenname);
        $('.token-stats', this.element).attr('title', this.tokentooltip).html((this.tokentemp ? `<div class="stat temp">${this.tokentemp}</div>` : '') + (this.tokenstat ? `<div class="stat" style="background-color:${this.color}">${this.tokenstat}</div>` : ''));

        let actor = (canvas.tokens.controlled.length == 1 ? canvas.tokens.controlled[0].actor : null);
        let data = actor?.system;
        let showST = (actor != undefined && game.system.id == "dnd5e" && data?.attributes?.hp?.value == 0 && actor?.hasPlayerOwner && setting("show-savingthrows"));
        $('.death-savingthrow', this.element).css({ display: (showST ? 'inline-block' : 'none') });
        if (showST && data.attributes.death) {
            $('.death-savingthrow.fail > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.failure) });
            $('.death-savingthrow.save > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.success) });
        }

        $('.resource', this.element).toggle(canvas.tokens.controlled.length == 1 && this.valuePct != undefined);
        if (this.valuePct != undefined) {
            $('.resource .bar', this.element).css({ width: (this.valuePct * 100) + '%', backgroundColor: this.color });
            $('.resource .temp-bar', this.element).toggle(this.tempPct > 0).css({ width: (this.tempPct * 100) + '%' });
        }
    }

    get getValue() {
        let value = $('#alwayshp-hp', this.element).val();
        let result = { value: value };
        if (value.indexOf("r") > -1 || value.indexOf("R") > -1) {
            result.target = "regular";
            result.value = result.value.replace('r', '').replace('R', '');
        }
        if (value.indexOf("t") > -1 || value.indexOf("T") > -1) {
            result.target = "temp";
            result.value = result.value.replace('t', '').replace('T', '');
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
            $('#alwayshp-hp', this.element).val('');
    }

    getChangeValue(perc) {
        let change = "";
        if (canvas.tokens.controlled.length == 1 && canvas.tokens.controlled[0].actor?.type != "group") {
            const actor = canvas.tokens.controlled[0].actor;

            if (!actor)
                return;

            let resourcename = (setting("resourcename") || (game.system.primaryTokenAttribute ?? game.system.data.primaryTokenAttribute) || 'attributes.hp');
            let resource = foundry.utils.getProperty(actor, `system.${resourcename}`);

            if (resource.hasOwnProperty("max")) {
                let max = this.getResValue(resource, "max");
                let tempmax = this.getResValue(resource, "tempmax");
                const effectiveMax = Math.max(0, max + tempmax);
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
        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            if (ev.shiftKey == true)
                this.changeHP({ value: 0 }, 'toggle');
            else {
                log('set character to dead');
                this.changeHP({ value: 'zero' }, true);
                this.clearInput();
            }
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to hurt');
            this.changeHP({ value: 'zero' });
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let value = this.getValue;
            if (value.value != '') {
                value.value = Math.abs(value.value);
                if (setting("wounds-system")) value.value = value.value * -1;
                this.changeHP(value);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let value = this.getValue;
            if (value.value != '') {
                value.value = -Math.abs(value.value);
                if (setting("wounds-system")) value.value = value.value * -1;                
                this.changeHP(value, false);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            this.changeHP({ value: 'full' }, false);
            this.clearInput();
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to heal');
            this.changeHP({ value: 'full' });
            this.clearInput();
        });

        if (setting('double-click')) {
            html.find('#alwayshp-btn-hurt').dblclick(ev => {
                ev.preventDefault();
                log('set character to hurt');
                this.changeHP({ value: 'zero' });
                this.clearInput();
            });

            html.find('#alwayshp-btn-heal').dblclick(ev => {
                ev.preventDefault();
                log('set character to heal');
                this.changeHP({ value: 'full' });
                this.clearInput();
            });
        }
        html.find('#alwayshp-hp').focus(ev => {
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

                    let rawvalue = $('#alwayshp-hp', this.element).val();

                    if (setting("wounds-system"))
                        value.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? Math.abs(value.value) : -Math.abs(value.value));    
                    else
                        value.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? -Math.abs(value.value) : Math.abs(value.value));
                    this.changeHP(value); //Heal with a + but everything else is a hurt
                    this.clearInput();
                }
            }
        });

        html.find('.death-savingthrow').click(ev => {
            ev.preventDefault();
            log('add death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), 1);
        }).contextmenu(ev => {
            ev.preventDefault();
            log('remove death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), -1);
        });

        
        html.find('.resource').mousemove(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            if (setting("wounds-system"))  perc = 1 - perc;            
            let change = this.getChangeValue(perc);

            if (setting("wounds-system"))  change = change * -1;      
            $('.bar-change', html).html(change);
            log("resource change");
        }).click(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            if (setting("wounds-system"))  perc = 1 - perc;
            let change = this.getChangeValue(perc);

            this.changeHP({ value: -change, target: 'regular' });
            $('.bar-change', html).html('');
        });

        html.find('.bar-change').mousemove(ev => {
            ev.preventDefault;
            ev.stopPropagation();
            log("bar change");
        });
    }
}

Hooks.on('init', () => {
    registerSettings();

    game.keybindings.register('always-hp', 'toggle-key', {
        name: 'ALWAYSHP.toggle-key.name',
        hint: 'ALWAYSHP.toggle-key.hint',
        editable: [],
        onDown: () => {
            game.AlwaysHP.toggleApp();
        },
    });

    game.keybindings.register('always-hp', 'focus-key', {
        name: 'ALWAYSHP.focus-key.name',
        hint: 'ALWAYSHP.focus-key.hint',
        editable: [],
        onDown: () => {
            if (!game.AlwaysHP.app)
                game.AlwaysHP.app = new AlwaysHP().render(true);
            else
                game.AlwaysHP.app.bringToTop();
            $('#alwayshp-hp', game.AlwaysHP.app.element).focus();
        },
    });

    game.AlwaysHP = {
        app: null,
        toggleApp: (show = 'toggle') => {
            if (show == 'toggle') show = !game.AlwaysHP.app;

            if (show && !game.AlwaysHP.app) {
                game.AlwaysHP.app = new AlwaysHP().render(true);
            } else if (!show && game.AlwaysHP.app)
                game.AlwaysHP.app.close({ properClose: true });
        },
        refresh: () => {
            if (game.AlwaysHP.app)
                game.AlwaysHP.app.refreshSelected();
        }
    };
});

Hooks.on('ready', () => {
    let r = document.querySelector(':root');
    r.style.setProperty('--ahp-heal-dark', setting("heal-dark"));
    r.style.setProperty('--ahp-heal-light', setting("heal-light"));
    r.style.setProperty('--ahp-hurt-dark', setting("hurt-dark"));
    r.style.setProperty('--ahp-hurt-light', setting("hurt-light"));

    if ((setting("show-option") == 'on' || (setting("show-option") == 'toggle' && setting("show-dialog"))) && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM)))
        game.AlwaysHP.toggleApp(true);

    if (setting("show-option") == "combat" && game.combats.active && game.combats.active.started && !game.AlwaysHP)
        game.AlwaysHP.toggleApp(true);

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
    if (setting("show-option") == "token") {
        if (canvas.tokens.controlled.length == 0) // delay a second to make sure we aren't selecting a new token
            window.setTimeout(() => { if (canvas.tokens.controlled.length == 0) game.AlwaysHP.toggleApp(false); }, 100);
        else if (!game.AlwaysHP.app)
            game.AlwaysHP.toggleApp(true);
        else
            game.AlwaysHP.refresh();
    } else
        game.AlwaysHP.refresh();
});

Hooks.on('updateActor', (actor, data) => {
    //log('Updating actor', actor, data);
    if (canvas.tokens.controlled.length == 1
        && canvas.tokens.controlled[0]?.actor?.id == actor.id
        && (foundry.utils.getProperty(data, "system.attributes.death") != undefined || foundry.utils.getProperty(data, `system.${setting("resourcename") }`))) {
        game.AlwaysHP.refresh();
    }
});

Hooks.on('updateCombat', (combat, data) => {
    if (setting("show-option") == "combat") {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on('deleteCombat', (combat, data) => {
    if (setting("show-option") == "combat") {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on('dragEndAlwaysHP', (app) => {
    game.user.setFlag("always-hp", "alwayshpPos", { left: app.position.left, top: app.position.top });
})

Hooks.on("getSceneControlButtons", (controls) => {
    if (setting("show-option") == 'toggle' && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM))) {
        let tokenControls = controls.find(control => control.name === "token")
        tokenControls.tools.push({
            name: "toggledialog",
            title: "ALWAYSHP.toggledialog",
            icon: "fas fa-briefcase-medical",
            toggle: true,
            active: setting('show-dialog'),
            onClick: (toggled) => {
                game.settings.set('always-hp', 'show-dialog', toggled);
                game.AlwaysHP.toggleApp(toggled);
            }
        });
    }
});

Hooks.on("renderSettingsConfig", (app, html, user) => {
    $("input[name='always-hp.heal-dark']", html).replaceWith(`
    <color-picker name="always-hp.heal-light" value="${setting('heal-light') || '#15838d'}"></color-picker>
    <color-picker name="always-hp.heal-dark" value="${setting('heal-dark') || '#4dd0e1'}"></color-picker>
    `);
    $("input[name='always-hp.hurt-dark']", html).replaceWith(`
    <color-picker name="always-hp.hurt-light" value="${setting('hurt-light') || '#ff6400'}"></color-picker>
    <color-picker name="always-hp.hurt-dark" value="${setting('hurt-dark') || '#ff0000'}"></color-picker>
    `);
});

